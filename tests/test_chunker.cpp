#include "test_harness.hpp"
#include "vectordb/chunker.hpp"

#include <cctype>
#include <string>
#include <vector>

using namespace vectordb;

namespace {

// Verify if a string is valid UTF-8
bool isStringValidUtf8(const std::string& str) {
    std::size_t i = 0;
    std::size_t n = str.size();
    while (i < n) {
        unsigned char c = static_cast<unsigned char>(str[i]);
        if (c <= 0x7F) {
            i += 1;
        } else if ((c & 0xE0) == 0xC0) {
            if (i + 1 >= n) return false;
            if ((static_cast<unsigned char>(str[i + 1]) & 0xC0) != 0x80) return false;
            if (c < 0xC2) return false; // Overlong encoding
            i += 2;
        } else if ((c & 0xF0) == 0xE0) {
            if (i + 2 >= n) return false;
            if ((static_cast<unsigned char>(str[i + 1]) & 0xC0) != 0x80 ||
                (static_cast<unsigned char>(str[i + 2]) & 0xC0) != 0x80) return false;
            i += 3;
        } else if ((c & 0xF8) == 0xF0) {
            if (i + 3 >= n) return false;
            if ((static_cast<unsigned char>(str[i + 1]) & 0xC0) != 0x80 ||
                (static_cast<unsigned char>(str[i + 2]) & 0xC0) != 0x80 ||
                (static_cast<unsigned char>(str[i + 3]) & 0xC0) != 0x80) return false;
            i += 4;
        } else {
            return false;
        }
    }
    return true;
}

std::string trimTestString(const std::string& s) {
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

} // anonymous namespace

TEST(ChunkerTest, ValidationAndInvalidOptions) {
    ChunkOptions opt;

    // maxChars < 100 throws std::invalid_argument
    opt.maxChars = 99;
    opt.overlapChars = 20;
    CHECK_THROWS(chunkText("Valid input string with enough characters.", opt), std::invalid_argument);

    // overlapChars >= maxChars / 2 throws std::invalid_argument
    opt.maxChars = 200;
    opt.overlapChars = 100;
    CHECK_THROWS(chunkText("Valid input string with enough characters.", opt), std::invalid_argument);

    opt.overlapChars = 101;
    CHECK_THROWS(chunkText("Valid input string with enough characters.", opt), std::invalid_argument);

    // Strategy string conversion
    CHECK(chunkStrategyToString(ChunkStrategy::Fixed) == "fixed");
    CHECK(chunkStrategyToString(ChunkStrategy::Sentence) == "sentence");
    CHECK(chunkStrategyFromString("fixed") == ChunkStrategy::Fixed);
    CHECK(chunkStrategyFromString("FIXED") == ChunkStrategy::Fixed);
    CHECK(chunkStrategyFromString("sentence") == ChunkStrategy::Sentence);
    CHECK(chunkStrategyFromString("Sentence") == ChunkStrategy::Sentence);
    CHECK_THROWS(chunkStrategyFromString("invalid"), std::invalid_argument);
}

TEST(ChunkerTest, EmptyAndWhitespaceOnly) {
    ChunkOptions opt;
    opt.maxChars = 200;
    opt.overlapChars = 30;

    auto chunks1 = chunkText("", opt);
    CHECK(chunks1.empty());

    auto chunks2 = chunkText("   \t\n\r  \n   \t ", opt);
    CHECK(chunks2.empty());
}

TEST(ChunkerTest, ShortTextGivesOneChunk) {
    ChunkOptions opt;
    opt.maxChars = 300;
    opt.overlapChars = 40;

    std::string text = "Vector databases provide sub-millisecond similarity search.";
    opt.strategy = ChunkStrategy::Sentence;
    auto sChunks = chunkText(text, opt);
    CHECK(sChunks.size() == 1);
    CHECK(sChunks[0].index == 0);
    CHECK(sChunks[0].startByte == 0);
    CHECK(sChunks[0].endByte == text.size());
    CHECK(sChunks[0].text == text);

    opt.strategy = ChunkStrategy::Fixed;
    auto fChunks = chunkText(text, opt);
    CHECK(fChunks.size() == 1);
    CHECK(fChunks[0].index == 0);
    CHECK(fChunks[0].startByte == 0);
    CHECK(fChunks[0].endByte == text.size());
    CHECK(fChunks[0].text == text);
}

TEST(ChunkerTest, NoChunkExceedsMaxCharsAndOffsetsNonDecreasing) {
    std::string sample =
        "Hierarchical Navigable Small World (HNSW) graphs are multi-layer proximity graphs. "
        "At layer 0, all elements are stored with fine-grained links. "
        "Upper layers contain exponentially fewer elements and act as express skip-lists. "
        "Search starts at the top layer with greedy routing, finding local minima. "
        "Once a local minimum is reached at layer l, the search continues at layer l-1. "
        "At layer 0, a beam search is performed with priority queue of size efSearch. "
        "This achieves logarithmic search complexity O(log N) with very high recall. "
        "KD-Trees, in contrast, partition vector space using orthogonal hyperplanes. "
        "While KD-Trees work well in low dimensions, they degrade in high dimensions due to the curse of dimensionality.";

    for (auto strat : {ChunkStrategy::Fixed, ChunkStrategy::Sentence}) {
        ChunkOptions opt;
        opt.strategy = strat;
        opt.maxChars = 250;
        opt.overlapChars = 50;

        auto chunks = chunkText(sample, opt);
        CHECK(!chunks.empty());

        std::size_t prevStart = 0;
        std::vector<bool> covered(sample.size(), false);

        for (std::size_t i = 0; i < chunks.size(); ++i) {
            const auto& ch = chunks[i];
            CHECK(ch.index == i);
            CHECK(ch.startByte <= ch.endByte);
            CHECK(ch.endByte <= sample.size());
            CHECK((ch.endByte - ch.startByte) <= opt.maxChars);

            // Start offsets are non-decreasing
            if (i > 0) {
                CHECK(ch.startByte >= prevStart);
            }
            prevStart = ch.startByte;

            // Trimmed original slice matches chunk text
            std::string slice = sample.substr(ch.startByte, ch.endByte - ch.startByte);
            CHECK(trimTestString(slice) == ch.text);
            CHECK(!ch.text.empty());

            // Mark covered bytes
            for (std::size_t b = ch.startByte; b < ch.endByte; ++b) {
                covered[b] = true;
            }
        }

        // All non-whitespace content in original is covered
        for (std::size_t b = 0; b < sample.size(); ++b) {
            if (!std::isspace(static_cast<unsigned char>(sample[b]))) {
                CHECK(covered[b]);
            }
        }
    }
}

TEST(ChunkerTest, OverlapBehaviour) {
    std::string text =
        "First sentence discussing vector indexes in modern database design. "
        "Second sentence covering metric spaces such as Euclidean and Cosine distances. "
        "Third sentence describing KD-Trees and hyper-plane space decomposition. "
        "Fourth sentence introducing HNSW graphs and skip-list layers. "
        "Fifth sentence summarizing retrieval-augmented generation pipelines.";

    ChunkOptions opt;
    opt.strategy = ChunkStrategy::Sentence;
    opt.maxChars = 220;
    opt.overlapChars = 80;

    auto chunks = chunkText(text, opt);
    CHECK(chunks.size() >= 2);

    // Verify overlap exists between consecutive chunks
    for (std::size_t i = 1; i < chunks.size(); ++i) {
        CHECK(chunks[i].startByte < chunks[i - 1].endByte);
    }
}

TEST(ChunkerTest, DevanagariDandaAndBlankLineSplitting) {
    // Test Devanagari danda: U+0964 (\xE0\xA5\x84)
    std::string hindiText =
        "वेक्टर डेटाबेस उच्च-आयामी सदिशों को कुशलतापूर्वक संग्रहीत करते हैं। "
        "यह सिमेंटिक खोज और समानता खोज के लिए अत्यंत उपयोगी तकनीक है। "
        "एचएनएसडब्ल्यू एल्गोरिदम उच्च सटीकता और गति प्रदान करता है। "
        "ओलामा स्थानीय एलएलएम निष्पादन को संभव बनाता है।";

    ChunkOptions opt;
    opt.strategy = ChunkStrategy::Sentence;
    opt.maxChars = 200;
    opt.overlapChars = 40;

    auto chunks = chunkText(hindiText, opt);
    CHECK(!chunks.empty());
    for (const auto& ch : chunks) {
        CHECK(isStringValidUtf8(ch.text));
        CHECK(ch.endByte - ch.startByte <= opt.maxChars);
    }

    // Test blank line / paragraph break splitting
    std::string paraText =
        "Section 1: Introduction to Information Retrieval.\n\n"
        "Section 2: Dense representations with deep neural embeddings.\n\n"
        "Section 3: Approximate nearest neighbor indexing techniques.";

    opt.maxChars = 100;
    opt.overlapChars = 20;
    auto pChunks = chunkText(paraText, opt);
    CHECK(pChunks.size() >= 3);
    for (const auto& ch : pChunks) {
        CHECK(trimTestString(paraText.substr(ch.startByte, ch.endByte - ch.startByte)) == ch.text);
    }
}

TEST(ChunkerTest, VeryLongSingleSentenceHardSplit) {
    // Single sentence exceeding maxChars without any punctuation or paragraph break
    std::string longSentence(600, 'x');
    for (std::size_t i = 50; i < longSentence.size(); i += 60) {
        longSentence[i] = ' '; // add occasional spaces
    }

    ChunkOptions opt;
    opt.strategy = ChunkStrategy::Sentence;
    opt.maxChars = 150;
    opt.overlapChars = 30;

    auto chunks = chunkText(longSentence, opt);
    CHECK(chunks.size() >= 4);

    for (const auto& ch : chunks) {
        CHECK(ch.endByte - ch.startByte <= opt.maxChars);
        CHECK(!ch.text.empty());
        CHECK(isStringValidUtf8(ch.text));
    }
}

TEST(ChunkerTest, Utf8SafetyWithMultibyteAndEmojis) {
    // Text containing French/German accents, Hindi text, and multi-byte emojis (4-byte code points)
    std::string complexText =
        "RAG pipelines 🚀 combine retrieval and generation 💡. "
        "Modèles de langage multilingues: français, deutsch (Größe, Überläufer), español (niño). "
        "हिंदी पाठ: कृत्रिम बुद्धिमत्ता और मशीन लर्निंग बहुत लोकप्रिय विषय हैं। "
        "Icons and symbols: 🔥 ⚡ 🎯 🤖 are represented with four bytes in UTF-8 encoding.";

    for (auto strat : {ChunkStrategy::Fixed, ChunkStrategy::Sentence}) {
        ChunkOptions opt;
        opt.strategy = strat;
        opt.maxChars = 160;
        opt.overlapChars = 35;

        auto chunks = chunkText(complexText, opt);
        CHECK(!chunks.empty());

        for (const auto& ch : chunks) {
            // Must be valid UTF-8, no severed code points
            CHECK(isStringValidUtf8(ch.text));
            CHECK(ch.endByte - ch.startByte <= opt.maxChars);
            CHECK(trimTestString(complexText.substr(ch.startByte, ch.endByte - ch.startByte)) == ch.text);
        }
    }
}

TEST(ChunkerTest, Determinism) {
    std::string text =
        "Semantic search engines convert unstructured textual queries into dense vector embeddings. "
        "Cosine similarity measures the angle between query and document vectors in metric space.";

    ChunkOptions opt;
    opt.maxChars = 120;
    opt.overlapChars = 25;

    auto run1 = chunkText(text, opt);
    auto run2 = chunkText(text, opt);

    CHECK(run1.size() == run2.size());
    for (std::size_t i = 0; i < run1.size(); ++i) {
        CHECK(run1[i].index == run2[i].index);
        CHECK(run1[i].startByte == run2[i].startByte);
        CHECK(run1[i].endByte == run2[i].endByte);
        CHECK(run1[i].text == run2[i].text);
    }
}
