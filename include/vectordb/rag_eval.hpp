#pragma once

#include <string>
#include <vector>

namespace vectordb {

/// Evaluation question definition
struct EvalQuestion {
    std::string id;
    std::string question;
    bool answerable = false;
    std::vector<std::string> expectAny;
    std::vector<std::string> forbidAny;
};

/**
 * @brief Pure scoring function for RAG evaluation.
 *
 * - Answerable:
 *     - Must NOT be the refusal sentence.
 *     - If expectAny is non-empty, must contain at least one expectAny string (case-insensitive).
 *     - If forbidAny is non-empty, must NOT contain any forbidAny string (case-insensitive).
 * - Unanswerable:
 *     - Must match the refusal sentence ("I could not find this in the provided documents.").
 *     - If forbidAny is non-empty, must NOT contain any forbidAny string (case-insensitive).
 */
bool scoreRagAnswer(const EvalQuestion& q, const std::string& answer);

} // namespace vectordb

