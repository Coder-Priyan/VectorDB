#include "vectordb/rag_eval.hpp"

#include <algorithm>
#include <cctype>

namespace vectordb {

namespace {

std::string toLower(const std::string& s) {
    std::string out = s;
    for (char& c : out) {
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
    return out;
}

std::string trim(const std::string& s) {
    std::size_t start = 0;
    while (start < s.size() && std::isspace(static_cast<unsigned char>(s[start]))) {
        start++;
    }
    std::size_t end = s.size();
    while (end > start && std::isspace(static_cast<unsigned char>(s[end - 1]))) {
        end--;
    }
    return s.substr(start, end - start);
}

bool isRefusalSentence(const std::string& raw) {
    std::string t = trim(raw);
    if (t.size() >= 2 && t.front() == '"' && t.back() == '"') {
        t = trim(t.substr(1, t.size() - 2));
    }
    std::string lower = toLower(t);
    return lower == "i could not find this in the provided documents." ||
           lower == "i could not find this in the provided documents";
}

bool containsSubstringIgnoreCase(const std::string& haystack, const std::string& needle) {
    if (needle.empty()) return true;
    std::string h = toLower(haystack);
    std::string n = toLower(needle);
    return h.find(n) != std::string::npos;
}

} // namespace

bool scoreRagAnswer(const EvalQuestion& q, const std::string& answer) {
    bool refusal = isRefusalSentence(answer);

    if (q.answerable) {
        if (refusal) {
            return false;
        }

        if (!q.expectAny.empty()) {
            bool foundAny = false;
            for (const auto& expect : q.expectAny) {
                if (containsSubstringIgnoreCase(answer, expect)) {
                    foundAny = true;
                    break;
                }
            }
            if (!foundAny) {
                return false;
            }
        }

        if (!q.forbidAny.empty()) {
            for (const auto& forbid : q.forbidAny) {
                if (containsSubstringIgnoreCase(answer, forbid)) {
                    return false;
                }
            }
        }

        return true;
    } else {
        if (!refusal) {
            return false;
        }

        if (!q.forbidAny.empty()) {
            for (const auto& forbid : q.forbidAny) {
                if (containsSubstringIgnoreCase(answer, forbid)) {
                    return false;
                }
            }
        }

        return true;
    }
}

} // namespace vectordb

