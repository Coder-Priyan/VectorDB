#include "test_harness.hpp"
#include "fake_ollama.hpp"
#include "vectordb/ollama_client.hpp"

#include <vector>
#include <string>

using namespace vectordb;
using namespace vectordb::testing;

TEST(OllamaClientTest, UrlValidationAndRemoteRules) {
    // 1. https rejected
    {
        OllamaConfig cfg;
        cfg.baseUrl = "https://127.0.0.1:11434";
        CHECK_THROWS(OllamaClient c(cfg), std::invalid_argument);
    }

    // 2. non-loopback rejected by default
    {
        OllamaConfig cfg;
        cfg.baseUrl = "http://192.168.1.100:11434";
        CHECK_THROWS(OllamaClient c(cfg), std::invalid_argument);
    }
    {
        OllamaConfig cfg;
        cfg.baseUrl = "http://api.openai.com:80";
        CHECK_THROWS(OllamaClient c(cfg), std::invalid_argument);
    }

    // 3. non-loopback allowed when allowRemote = true
    {
        OllamaConfig cfg;
        cfg.baseUrl = "http://192.168.1.100:11434";
        cfg.allowRemote = true;
        OllamaClient c(cfg);
        CHECK(c.config().baseUrl == "http://192.168.1.100:11434");
    }

    // 4. loopback forms accepted
    for (const auto& url : {"http://127.0.0.1:11434", "http://localhost:11434", "http://[::1]:11434"}) {
        OllamaConfig cfg;
        cfg.baseUrl = url;
        OllamaClient c(cfg);
        CHECK(c.config().baseUrl == url);
    }
}

TEST(OllamaClientTest, StatusReportingNeverThrows) {
    FakeOllamaServer fake;
    fake.models = {"nomic-embed-text:latest", "llama3.2:latest"};

    OllamaConfig cfg;
    cfg.baseUrl = fake.baseUrl();
    cfg.embedModel = "nomic-embed-text";
    cfg.chatModel = "llama3.2";

    OllamaClient client(cfg);
    auto st = client.status();
    CHECK(st.reachable);
    CHECK(st.embedModelPresent);
    CHECK(st.chatModelPresent);
    CHECK(!st.version.empty());
    CHECK(st.error.empty());

    // Test with missing model
    cfg.chatModel = "nonexistent-model";
    OllamaClient client2(cfg);
    auto st2 = client2.status();
    CHECK(st2.reachable);
    CHECK(st2.embedModelPresent);
    CHECK(!st2.chatModelPresent);

    // Test with dead/closed port (never throws)
    OllamaConfig deadCfg;
    deadCfg.baseUrl = "http://127.0.0.1:1";
    deadCfg.connectTimeoutSec = 1;
    OllamaClient deadClient(deadCfg);
    auto deadSt = deadClient.status();
    CHECK(!deadSt.reachable);
    CHECK(!deadSt.error.empty());
    CHECK(!deadSt.embedModelPresent);
    CHECK(!deadSt.chatModelPresent);
}

TEST(OllamaClientTest, EmbedBatchingOrderingAndPrefixes) {
    FakeOllamaServer fake;

    OllamaConfig cfg;
    cfg.baseUrl = fake.baseUrl();
    cfg.embedModel = "nomic-embed-text";
    cfg.useNomicPrefixes = true;
    cfg.embedBatchSize = 2; // small batch size to force multi-batch requests

    OllamaClient client(cfg);

    std::vector<std::string> docTexts = {
        "First document paragraph on HNSW algorithm.",
        "Second document paragraph discussing KD-Trees.",
        "Third document paragraph on Cosine distance."
    };

    auto embeddings = client.embed(docTexts, EmbedKind::Document);
    CHECK(embeddings.size() == 3);
    for (const auto& vec : embeddings) {
        CHECK(vec.size() == 768);
    }

    // Verify prefixes sent to fake server
    {
        std::lock_guard<std::mutex> lock(fake.dataMutex);
        CHECK(fake.receivedEmbedInputs.size() == 3);
        CHECK(fake.receivedEmbedInputs[0] == "search_document: First document paragraph on HNSW algorithm.");
        CHECK(fake.receivedEmbedInputs[1] == "search_document: Second document paragraph discussing KD-Trees.");
        CHECK(fake.receivedEmbedInputs[2] == "search_document: Third document paragraph on Cosine distance.");
    }

    // Now test Query embedding (search_query: prefix)
    fake.reset();
    auto qEmb = client.embed({"nearest neighbor query"}, EmbedKind::Query);
    CHECK(qEmb.size() == 1);
    CHECK(qEmb[0].size() == 768);
    {
        std::lock_guard<std::mutex> lock(fake.dataMutex);
        CHECK(fake.receivedEmbedInputs.size() == 1);
        CHECK(fake.receivedEmbedInputs[0] == "search_query: nearest neighbor query");
    }

    // Test non-nomic model has NO prefix
    fake.reset();
    cfg.embedModel = "bge-large";
    OllamaClient nonNomicClient(cfg);
    nonNomicClient.embed({"hello world"}, EmbedKind::Document);
    {
        std::lock_guard<std::mutex> lock(fake.dataMutex);
        CHECK(fake.receivedEmbedInputs.size() == 1);
        CHECK(fake.receivedEmbedInputs[0] == "hello world");
    }
}

TEST(OllamaClientTest, ChatStreamingReassemblyAndSplitLines) {
    FakeOllamaServer fake;
    fake.chatMode = "normal";

    OllamaConfig cfg;
    cfg.baseUrl = fake.baseUrl();
    cfg.chatModel = "llama3.2";

    OllamaClient client(cfg);

    std::vector<std::string> streamedTokens;
    std::string fullAnswer = client.chat(
        {{"user", "What are vector databases?"}},
        {},
        [&streamedTokens](const std::string& token) {
            streamedTokens.push_back(token);
            return true;
        }
    );

    CHECK(!fullAnswer.empty());
    CHECK(fullAnswer.find("According to document [1]") != std::string::npos);
    CHECK(!streamedTokens.empty());
}

TEST(OllamaClientTest, OnTokenEarlyStopAbortsStream) {
    FakeOllamaServer fake;
    fake.chatMode = "normal";

    OllamaConfig cfg;
    cfg.baseUrl = fake.baseUrl();
    OllamaClient client(cfg);

    int tokenCount = 0;
    std::string answer = client.chat(
        {{"user", "Tell me about RAG"}},
        {},
        [&tokenCount](const std::string&) {
            ++tokenCount;
            // Stop immediately after first token
            return false;
        }
    );

    CHECK(tokenCount == 1);
    CHECK(!answer.empty());
}

TEST(OllamaClientTest, ModelNotFoundIncludesPullHint) {
    FakeOllamaServer fake;
    fake.chatMode = "model_not_found";

    OllamaConfig cfg;
    cfg.baseUrl = fake.baseUrl();
    OllamaClient client(cfg);

    bool caught = false;
    try {
        client.chat({{"user", "Hi"}});
    } catch (const OllamaError& e) {
        caught = true;
        std::string msg = e.what();
        CHECK(msg.find("hint: run: ollama pull") != std::string::npos);
    }
    CHECK(caught);
}

TEST(OllamaClientTest, ClosedPortThrowsOllamaUnavailable) {
    OllamaConfig cfg;
    cfg.baseUrl = "http://127.0.0.1:1";
    cfg.connectTimeoutSec = 1;
    OllamaClient client(cfg);

    CHECK_THROWS(client.embed({"test"}, EmbedKind::Query), OllamaUnavailable);
    CHECK_THROWS(client.chat({{"user", "hi"}}), OllamaUnavailable);
}
