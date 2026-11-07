#include "vectordb/chunker.hpp"

#include <algorithm>
#include <cctype>
#include <stdexcept>

namespace vectordb {

namespace {

// Helper: check if a byte is a UTF-8 continuation byte (10xxxxxx)
inline bool isUtf8Continuation(unsigned char byte) {
    return (byte & 0xC0) == 0x80;
}

// Ensure pos is a valid UTF-8 character boundary by stepping backward
std::size_t snapToUtf8BoundaryBackward(const std::string& text, std::size_t pos) {
    if (pos >= text.size()) {
        return text.size();
    }
    while (pos > 0 && isUtf8Continuation(static_cast<unsigned char>(text[pos]))) {
        --pos;
    }
    return pos;
}

// Ensure pos is a valid UTF-8 character boundary by stepping forward
std::size_t snapToUtf8BoundaryForward(const std::string& text, std::size_t pos) {
    while (pos < text.size() && isUtf8Continuation(static_cast<unsigned char>(text[pos]))) {
        ++pos;
    }
    return pos;
}

// Trim whitespace from both ends of a string
std::string trimString(const std::string& s) {
    auto start = s.begin();
    while (start != s.end() && std::isspace(static_cast<unsigned char>(*start))) {
        ++start;
    }
    auto end = s.end();
    do {
        if (end == start) break;
        --end;
    } while (std::isspace(static_cast<unsigned char>(*end)));

    return std::string(start, end + (start == end ? 0 : 1));
}

// Sentence span within the original text [start, end)
struct RawSentence {
    std::size_t start = 0;
    std::size_t end = 0;
};

// Check if position points to a Devanagari danda (U+0964: \xE0\xA5\x84)
bool isDevanagariDanda(const std::string& text, std::size_t pos) {
    if (pos + 2 < text.size()) {
        auto b0 = static_cast<unsigned char>(text[pos]);
        auto b1 = static_cast<unsigned char>(text[pos + 1]);
        auto b2 = static_cast<unsigned char>(text[pos + 2]);
        return (b0 == 0xE0 && b1 == 0xA5 && b2 == 0x84);
    }
    return false;
}

// Implementation of Fixed chunking on a byte range [baseOffset, baseOffset + length)
std::vector<Chunk> chunkFixedRange(const std::string& text,
                                   std::size_t rangeStart,
                                   std::size_t rangeEnd,
                                   const ChunkOptions& opt) {
    std::vector<Chunk> chunks;
    std::size_t cur = rangeStart;

    while (cur < rangeEnd) {
        std::size_t remaining = rangeEnd - cur;
        if (remaining <= opt.maxChars) {
            std::size_t cutEnd = rangeEnd;
            std::string rawSlice = text.substr(cur, cutEnd - cur);
            std::string trimmed = trimString(rawSlice);
            if (!trimmed.empty()) {
                chunks.push_back({0, cur, cutEnd, std::move(trimmed)});
            }
            break;
        }

        // Target ideal cut at cur + maxChars
        std::size_t idealEnd = cur + opt.maxChars;
        idealEnd = snapToUtf8BoundaryBackward(text, idealEnd);
        if (idealEnd <= cur) {
            idealEnd = snapToUtf8BoundaryForward(text, cur + 1);
            if (idealEnd > rangeEnd) idealEnd = rangeEnd;
        }

        // Look for whitespace in the last 15% of the window
        std::size_t minSearchPos = cur + opt.maxChars - (opt.maxChars * 15 / 100);
        std::size_t cutEnd = idealEnd;
        bool foundWs = false;

        for (std::size_t p = idealEnd; p > minSearchPos && p > cur; --p) {
            if (std::isspace(static_cast<unsigned char>(text[p - 1]))) {
                cutEnd = p - 1; // cut at the whitespace boundary
                foundWs = true;
                break;
            }
        }

        if (!foundWs) {
            cutEnd = idealEnd;
        }

        // Avoid empty slice
        if (cutEnd <= cur) {
            cutEnd = snapToUtf8BoundaryForward(text, cur + 1);
            if (cutEnd > rangeEnd) cutEnd = rangeEnd;
        }

        std::string rawSlice = text.substr(cur, cutEnd - cur);
        std::string trimmed = trimString(rawSlice);
        if (!trimmed.empty()) {
            chunks.push_back({0, cur, cutEnd, std::move(trimmed)});
        }

        // Advance with overlap
        std::size_t nextStart = (cutEnd > opt.overlapChars + rangeStart)
                                    ? (cutEnd - opt.overlapChars)
                                    : rangeStart;

        if (nextStart <= cur) {
            nextStart = cur + 1;
        }
        nextStart = snapToUtf8BoundaryForward(text, nextStart);
        if (nextStart >= cutEnd) {
            nextStart = cutEnd;
        }
        cur = nextStart;
    }

    return chunks;
}

// Split text into consecutive sentence spans covering the entire text
std::vector<RawSentence> splitIntoSentences(const std::string& text) {
    std::vector<RawSentence> sentences;
    const std::size_t n = text.size();
    if (n == 0) return sentences;

    std::size_t sentStart = 0;
    std::size_t i = 0;

    while (i < n) {
        // 1. Check for blank line / paragraph break (e.g. \n\s*\n)
        if (text[i] == '\n') {
            std::size_t look = i + 1;
            while (look < n && (text[look] == ' ' || text[look] == '\t' || text[look] == '\r')) {
                ++look;
            }
            if (look < n && text[look] == '\n') {
                // Found paragraph break! Consume trailing newlines/whitespace
                while (look < n && (text[look] == '\n' || text[look] == '\r' || text[look] == ' ' || text[look] == '\t')) {
                    ++look;
                }
                sentences.push_back({sentStart, look});
                sentStart = look;
                i = look;
                continue;
            }
        }

        // 2. Check for Devanagari danda (U+0964: \xE0\xA5\x84)
        if (isDevanagariDanda(text, i)) {
            i += 3;
            // Consume consecutive dandas
            while (isDevanagariDanda(text, i)) {
                i += 3;
            }
            // Consume trailing whitespace
            while (i < n && (text[i] == ' ' || text[i] == '\t' || text[i] == '\r')) {
                ++i;
            }
            sentences.push_back({sentStart, i});
            sentStart = i;
            continue;
        }

        // 3. Check for . ! ? followed by whitespace or EOF
        if (text[i] == '.' || text[i] == '!' || text[i] == '?') {
            std::size_t p = i;
            while (p < n && (text[p] == '.' || text[p] == '!' || text[p] == '?' ||
                             text[p] == '"' || text[p] == '\'' || text[p] == ')' || text[p] == ']')) {
                ++p;
            }
            if (p == n || std::isspace(static_cast<unsigned char>(text[p]))) {
                while (p < n && (text[p] == ' ' || text[p] == '\t' || text[p] == '\r')) {
                    ++p;
                }
                sentences.push_back({sentStart, p});
                sentStart = p;
                i = p;
                continue;
            }
        }

        ++i;
    }

    if (sentStart < n) {
        sentences.push_back({sentStart, n});
    }

    return sentences;
}

} // anonymous namespace

std::string chunkStrategyToString(ChunkStrategy strategy) {
    switch (strategy) {
        case ChunkStrategy::Fixed: return "fixed";
        case ChunkStrategy::Sentence: return "sentence";
    }
    return "sentence";
}

ChunkStrategy chunkStrategyFromString(const std::string& str) {
    std::string lower;
    lower.reserve(str.size());
    for (char c : str) {
        lower.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
    }
    if (lower == "fixed") return ChunkStrategy::Fixed;
    if (lower == "sentence") return ChunkStrategy::Sentence;
    throw std::invalid_argument("Unknown ChunkStrategy: '" + str + "'. Expected 'fixed' or 'sentence'.");
}

std::vector<Chunk> chunkText(const std::string& text, const ChunkOptions& opt) {
    if (opt.maxChars < 100) {
        throw std::invalid_argument("chunkText: maxChars must be >= 100 (got " + std::to_string(opt.maxChars) + ")");
    }
    if (opt.overlapChars >= opt.maxChars / 2) {
        throw std::invalid_argument("chunkText: overlapChars must be < maxChars / 2 (got maxChars=" +
                                    std::to_string(opt.maxChars) + ", overlapChars=" + std::to_string(opt.overlapChars) + ")");
    }

    if (text.empty()) {
        return {};
    }

    std::vector<Chunk> result;

    if (opt.strategy == ChunkStrategy::Fixed) {
        result = chunkFixedRange(text, 0, text.size(), opt);
    } else {
        // Sentence Strategy
        auto rawSentences = splitIntoSentences(text);
        if (rawSentences.empty()) {
            return {};
        }

        // Flatten any oversized sentences using Fixed hard-split
        std::vector<RawSentence> units;
        units.reserve(rawSentences.size());

        for (const auto& s : rawSentences) {
            std::size_t spanLen = s.end - s.start;
            if (spanLen > opt.maxChars) {
                // Hard-split like Fixed
                auto subChunks = chunkFixedRange(text, s.start, s.end, opt);
                for (const auto& sc : subChunks) {
                    units.push_back({sc.startByte, sc.endByte});
                }
            } else {
                units.push_back(s);
            }
        }

        if (units.empty()) {
            return {};
        }

        // Greedily pack whole sentences up to maxChars
        std::size_t startIdx = 0;
        const std::size_t numUnits = units.size();

        while (startIdx < numUnits) {
            std::size_t endIdx = startIdx + 1;
            while (endIdx < numUnits) {
                std::size_t combinedLen = units[endIdx].end - units[startIdx].start;
                if (combinedLen > opt.maxChars) {
                    break;
                }
                ++endIdx;
            }

            std::size_t chunkStartByte = units[startIdx].start;
            std::size_t chunkEndByte = units[endIdx - 1].end;

            std::string rawSlice = text.substr(chunkStartByte, chunkEndByte - chunkStartByte);
            std::string trimmed = trimString(rawSlice);
            if (!trimmed.empty()) {
                result.push_back({0, chunkStartByte, chunkEndByte, std::move(trimmed)});
            }

            if (endIdx >= numUnits) {
                break;
            }

            // Carry trailing sentence(s) totalling at most overlapChars into next chunk
            std::size_t nextStartIdx = endIdx; // default: no overlap carried
            std::size_t carryIdx = endIdx;

            while (carryIdx > startIdx + 1) {
                std::size_t candidateCarryLen = units[endIdx - 1].end - units[carryIdx - 1].start;
                if (candidateCarryLen <= opt.overlapChars) {
                    --carryIdx;
                    nextStartIdx = carryIdx;
                } else {
                    break;
                }
            }

            // Guarantee forward progress
            if (nextStartIdx <= startIdx) {
                nextStartIdx = startIdx + 1;
            }

            startIdx = nextStartIdx;
        }
    }

    // Assign consecutive 0-based indices and drop any trailing empty chunks
    std::size_t validIndex = 0;
    std::vector<Chunk> cleanResult;
    cleanResult.reserve(result.size());

    for (auto& ch : result) {
        if (!ch.text.empty()) {
            ch.index = validIndex++;
            cleanResult.push_back(std::move(ch));
        }
    }

    return cleanResult;
}

} // namespace vectordb
