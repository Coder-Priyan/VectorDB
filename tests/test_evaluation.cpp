#include "test_harness.hpp"
#include "vectordb/evaluation.hpp"
#include "vectordb/rag_eval.hpp"
#include <vector>

using namespace vectordb;

TEST(EvaluationTest, RecallAtKPerfectMatch) {
    const std::vector<SearchResult> gt = {
        {1, 0.1f}, {2, 0.2f}, {3, 0.3f}, {4, 0.4f}
    };
    const std::vector<SearchResult> approx = {
        {1, 0.1f}, {2, 0.2f}, {3, 0.3f}, {4, 0.4f}
    };

    CHECK_NEAR(recallAtK(gt, approx), 1.0, 1e-6);
}

TEST(EvaluationTest, RecallAtKZeroMatch) {
    const std::vector<SearchResult> gt = {
        {1, 0.1f}, {2, 0.2f}, {3, 0.3f}
    };
    const std::vector<SearchResult> approx = {
        {10, 0.1f}, {20, 0.2f}, {30, 0.3f}
    };

    CHECK_NEAR(recallAtK(gt, approx), 0.0, 1e-6);
}

TEST(EvaluationTest, RecallAtKPartialMatch) {
    // 2 out of 4 match: IDs 1 and 3
    const std::vector<SearchResult> gt = {
        {1, 0.1f}, {2, 0.2f}, {3, 0.3f}, {4, 0.4f}
    };
    const std::vector<SearchResult> approx = {
        {1, 0.1f}, {99, 0.15f}, {3, 0.3f}, {88, 0.5f}
    };

    CHECK_NEAR(recallAtK(gt, approx), 0.5, 1e-6);
}

TEST(EvaluationTest, RecallAtKEdgeCases) {
    const std::vector<SearchResult> empty;
    const std::vector<SearchResult> nonZero = {{1, 0.1f}, {2, 0.2f}};

    // Vacuously perfect when groundTruth is empty
    CHECK_NEAR(recallAtK(empty, empty), 1.0, 1e-6);
    CHECK_NEAR(recallAtK(empty, nonZero), 1.0, 1e-6);

    // Empty approx gives 0 recall when groundTruth has items
    CHECK_NEAR(recallAtK(nonZero, empty), 0.0, 1e-6);
}

TEST(EvaluationTest, MeanRecallAtK) {
    const std::vector<std::vector<SearchResult>> gtList = {
        {{1, 0.1f}, {2, 0.2f}}, // Query 0: 2 items
        {{3, 0.1f}, {4, 0.2f}}, // Query 1: 2 items
        {{5, 0.1f}, {6, 0.2f}}  // Query 2: 2 items
    };

    const std::vector<std::vector<SearchResult>> approxList = {
        {{1, 0.1f}, {2, 0.2f}}, // Recall = 1.0
        {{3, 0.1f}, {9, 0.2f}}, // Recall = 0.5
        {{8, 0.1f}, {9, 0.2f}}  // Recall = 0.0
    };

    // Expected mean: (1.0 + 0.5 + 0.0) / 3 = 0.5
    CHECK_NEAR(meanRecallAtK(gtList, approxList), 0.5, 1e-6);

    // Size mismatch throws
    const std::vector<std::vector<SearchResult>> shortList = {
        {{1, 0.1f}}
    };
    CHECK_THROWS(meanRecallAtK(gtList, shortList), std::invalid_argument);

    // Empty list returns 1.0
    const std::vector<std::vector<SearchResult>> emptyList;
    CHECK_NEAR(meanRecallAtK(emptyList, emptyList), 1.0, 1e-6);
}

TEST(RagEvalTest, ScoreAnswerableCorrect) {
    EvalQuestion q;
    q.id = "q1";
    q.question = "Who introduced KD-Tree?";
    q.answerable = true;
    q.expectAny = {"Bentley", "1975"};
    q.forbidAny = {"refusal", "Malkov"};

    // Contains Bentley (case-insensitive) -> pass
    CHECK(scoreRagAnswer(q, "Jon Bentley introduced the KD-tree in 1975 [1]."));
    // Contains lowercase bentley -> pass
    CHECK(scoreRagAnswer(q, "It was introduced by bentley."));
}

TEST(RagEvalTest, ScoreAnswerableFailRefusal) {
    EvalQuestion q;
    q.id = "q1";
    q.question = "Who introduced KD-Tree?";
    q.answerable = true;
    q.expectAny = {"Bentley"};

    // Fallback refusal on answerable question -> fail
    CHECK(!scoreRagAnswer(q, "I could not find this in the provided documents."));
    CHECK(!scoreRagAnswer(q, "  \"I could not find this in the provided documents.\" \n"));
}

TEST(RagEvalTest, ScoreAnswerableFailMissingExpect) {
    EvalQuestion q;
    q.id = "q1";
    q.question = "Who introduced KD-Tree?";
    q.answerable = true;
    q.expectAny = {"Bentley", "1975"};

    // Neither Bentley nor 1975 present
    CHECK(!scoreRagAnswer(q, "KD-Trees partition multidimensional vector space [1]."));
}

TEST(RagEvalTest, ScoreAnswerableFailForbiddenWord) {
    EvalQuestion q;
    q.id = "q1";
    q.question = "Who introduced KD-Tree?";
    q.answerable = true;
    q.expectAny = {"Bentley"};
    q.forbidAny = {"hallucination", "untrusted"};

    CHECK(!scoreRagAnswer(q, "Bentley created it, but this is a hallucination."));
}

TEST(RagEvalTest, ScoreUnanswerableExactRefusal) {
    EvalQuestion q;
    q.id = "q2";
    q.question = "What is the capital of Australia?";
    q.answerable = false;
    q.forbidAny = {"Canberra", "Sydney"};

    CHECK(scoreRagAnswer(q, "I could not find this in the provided documents."));
    CHECK(scoreRagAnswer(q, " \"I could not find this in the provided documents.\""));
    CHECK(scoreRagAnswer(q, "I could not find this in the provided documents\n"));
}

TEST(RagEvalTest, ScoreUnanswerableFailHallucination) {
    EvalQuestion q;
    q.id = "q2";
    q.question = "What is the capital of Australia?";
    q.answerable = false;
    q.forbidAny = {"Canberra"};

    // Model attempts to answer instead of refusing
    CHECK(!scoreRagAnswer(q, "The capital of Australia is Canberra."));
    CHECK(!scoreRagAnswer(q, "Australia is a country."));
}


