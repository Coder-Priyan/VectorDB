#include "test_harness.hpp"
#include "fake_ollama.hpp"
#include "vectordb/api.hpp"
#include "vectordb/rag.hpp"
#include "nlohmann/json.hpp"

#include <string>
#include <vector>

using namespace vectordb;
using namespace vectordb::testing;
using json = nlohmann::json;

TEST(ApiRagTest, OllamaStatusEndpoint) {
    FakeOllamaServer fake;
    fake.version = "0.4.0";
    fake.models = {"nomic-embed-text:latest", "llama3.2:latest"};

    OllamaConfig ollamaCfg;
    ollamaCfg.baseUrl = fake.baseUrl();
    OllamaClient client(ollamaCfg);

    RagConfig ragCfg;
    ragCfg.dimension = 768;
    RagPipeline pipeline(ragCfg, client);

    auto res = handleOllamaStatus(pipeline);
    CHECK(res.status == 200);

    auto j = json::parse(res.body);
    CHECK(j["reachable"] == true);
    CHECK(j["version"] == "0.4.0");
    CHECK(j["embed_model_present"] == true);
    CHECK(j["chat_model_present"] == true);
}

TEST(ApiRagTest, IngestAndListAndGetDocHappyPath) {
    FakeOllamaServer fake;

    OllamaConfig ollamaCfg;
    ollamaCfg.baseUrl = fake.baseUrl();
    OllamaClient client(ollamaCfg);

    RagConfig ragCfg;
    ragCfg.dimension = 768;
    RagPipeline pipeline(ragCfg, client);

    std::string body = R"({
        "title": "Machine Learning Overview",
        "text": "Supervised learning fits a model to labeled examples. Unsupervised learning discovers patterns in unlabeled data.",
        "chunking": {
            "strategy": "sentence",
            "max_chars": 200,
            "overlap_chars": 30
        }
    })";

    auto postRes = handleIngestDoc(pipeline, body);
    CHECK(postRes.status == 201);
    auto pj = json::parse(postRes.body);
    CHECK(pj.contains("doc_id"));
    CHECK(pj["doc_id"] == 1);
    CHECK(pj["dimension"] == 768);
    CHECK(pj["chunks"] >= 1);
    CHECK(pj["embed_ms"] >= 0.0);

    // List docs
    auto listRes = handleListDocs(pipeline);
    CHECK(listRes.status == 200);
    auto lj = json::parse(listRes.body);
    CHECK(lj["documents"].size() == 1);
    CHECK(lj["documents"][0]["id"] == 1);
    CHECK(lj["documents"][0]["title"] == "Machine Learning Overview");

    // Get doc by ID
    auto getRes = handleGetDoc(pipeline, 1);
    CHECK(getRes.status == 200);
    auto gj = json::parse(getRes.body);
    CHECK(gj["id"] == 1);
    CHECK(gj["title"] == "Machine Learning Overview");
    CHECK(gj["chunks"].size() >= 1);
    CHECK(gj["chunks"][0]["index"] == 0);
}

TEST(ApiRagTest, ValidationErrorsAnd404) {
    FakeOllamaServer fake;

    OllamaConfig ollamaCfg;
    ollamaCfg.baseUrl = fake.baseUrl();
    OllamaClient client(ollamaCfg);

    RagConfig ragCfg;
    ragCfg.dimension = 768;
    ragCfg.maxDocBytes = 500; // Small limit for testing 413
    RagPipeline pipeline(ragCfg, client);

    // 1. Malformed JSON
    auto err1 = handleIngestDoc(pipeline, "not a valid json");
    CHECK(err1.status == 400);

    // 2. Missing title
    auto err2 = handleIngestDoc(pipeline, R"({"text": "Hello world"})");
    CHECK(err2.status == 400);

    // 3. Missing text
    auto err3 = handleIngestDoc(pipeline, R"({"title": "Hello"})");
    CHECK(err3.status == 400);

    // 4. Invalid chunking strategy
    auto err4 = handleIngestDoc(pipeline, R"({
        "title": "Title",
        "text": "Text",
        "chunking": {"strategy": "unsupported_strategy"}
    })");
    CHECK(err4.status == 400);

    // 5. 413 Payload Too Large
    std::string hugeText(1000, 'A');
    json hugeBody;
    hugeBody["title"] = "Huge Doc";
    hugeBody["text"] = hugeText;
    auto err5 = handleIngestDoc(pipeline, hugeBody.dump());
    CHECK(err5.status == 413);

    // 6. 404 Not Found on GET /api/docs/:id
    auto err6 = handleGetDoc(pipeline, 9999);
    CHECK(err6.status == 404);
}

TEST(ApiRagTest, SearchBenchmarkAndAskEndpoints) {
    FakeOllamaServer fake;

    OllamaConfig ollamaCfg;
    ollamaCfg.baseUrl = fake.baseUrl();
    OllamaClient client(ollamaCfg);

    RagConfig ragCfg;
    ragCfg.dimension = 768;
    RagPipeline pipeline(ragCfg, client);

    pipeline.ingest("VectorDB Architecture",
                    "VectorDB implements brute force, KD-Tree and HNSW indexing for nearest neighbor queries.");

    // POST /api/docs/search
    std::string searchReq = R"({"query": "nearest neighbor search", "k": 3, "algorithm": "hnsw"})";
    auto sRes = handleSearchDocs(pipeline, searchReq);
    CHECK(sRes.status == 200);
    auto sj = json::parse(sRes.body);
    CHECK(sj["count"] >= 1);
    CHECK(sj["results"][0]["title"] == "VectorDB Architecture");
    CHECK(sj["results"][0]["similarity"] > 0.0f);

    // POST /api/docs/benchmark
    std::string benchReq = R"({"query": "indexing queries", "k": 2})";
    auto bRes = handleBenchmarkDocs(pipeline, benchReq);
    CHECK(bRes.status == 200);
    auto bj = json::parse(bRes.body);
    CHECK(bj["algorithms"].contains("brute"));
    CHECK(bj["algorithms"].contains("kdtree"));
    CHECK(bj["algorithms"].contains("hnsw"));

    // POST /api/ask
    std::string askReq = R"({
        "question": "What algorithms does VectorDB implement?",
        "k": 2,
        "debug": true
    })";
    auto aRes = handleAsk(pipeline, askReq);
    CHECK(aRes.status == 200);
    auto aj = json::parse(aRes.body);
    CHECK(!aj["answer"].get<std::string>().empty());
    CHECK(!aj["sources"].empty());
    CHECK(aj["sources"][0]["n"] == 1);
    CHECK(aj.contains("prompt"));
    CHECK(!aj["prompt"].get<std::string>().empty());
    CHECK(aj["timings"]["embed_ms"] >= 0.0);

    // POST /api/docs/reset
    auto rRes = handleResetDocs(pipeline);
    CHECK(rRes.status == 200);
    auto listAfter = handleListDocs(pipeline);
    auto laj = json::parse(listAfter.body);
    CHECK(laj["documents"].empty());
}

TEST(ApiRagTest, OllamaUnavailable503AndError502) {
    // Point Ollama client to closed port
    OllamaConfig deadCfg;
    deadCfg.baseUrl = "http://127.0.0.1:1";
    deadCfg.connectTimeoutSec = 1;
    OllamaClient deadClient(deadCfg);

    RagConfig ragCfg;
    ragCfg.dimension = 768;
    RagPipeline pipeline(ragCfg, deadClient);

    // Ingest with dead Ollama -> 503
    auto resIngest = handleIngestDoc(pipeline, R"({"title": "Test", "text": "Some text"})");
    CHECK(resIngest.status == 503);
    auto jIngest = json::parse(resIngest.body);
    CHECK(jIngest["error"]["code"] == "ollama_unavailable");

    // Search with dead Ollama -> 503
    auto resSearch = handleSearchDocs(pipeline, R"({"query": "test query"})");
    CHECK(resSearch.status == 503);

    // Now test 502 with simulated Ollama error
    FakeOllamaServer fake;
    fake.chatMode = "model_not_found";

    OllamaConfig liveCfg;
    liveCfg.baseUrl = fake.baseUrl();
    OllamaClient client(liveCfg);

    RagPipeline pipe2(ragCfg, client);
    pipe2.ingest("Doc 1", "Content for live doc.");

    auto ask502 = handleAsk(pipe2, R"({"question": "Any question?"})");
    CHECK(ask502.status == 502);
    auto j502 = json::parse(ask502.body);
    CHECK(j502["error"]["code"] == "ollama_error");
}

TEST(ApiRagTest, OldEndpointsStillWorkWhenOllamaIsDown) {
    CollectionConfig colCfg;
    colCfg.dimension = 4;
    Collection collection(colCfg);

    // 1. Health check works
    auto hRes = handleHealth();
    CHECK(hRes.status == 200);

    // 2. Collection config works
    auto cRes = handleGetConfig(collection);
    CHECK(cRes.status == 200);

    // 3. Vector insert works
    auto insRes = handleInsertVector(collection, R"({"id": 1, "vector": [1.0, 2.0, 3.0, 4.0]})");
    CHECK(insRes.status == 201);

    // 4. Vector search works
    auto sRes = handleSearch(collection, R"({"vector": [1.0, 2.0, 3.0, 4.0], "k": 1})");
    CHECK(sRes.status == 200);
}

TEST(ApiRagTest, FormatSseEvent) {
    std::string sseToken = formatSseEvent("token", R"({"token":"hello"})");
    CHECK(sseToken == "event: token\ndata: {\"token\":\"hello\"}\n\n");

    std::string sseSources = formatSseEvent("sources", R"({"sources":[]})");
    CHECK(sseSources == "event: sources\ndata: {\"sources\":[]}\n\n");

    std::string sseDone = formatSseEvent("done", R"({"answer":"done"})");
    CHECK(sseDone == "event: done\ndata: {\"answer\":\"done\"}\n\n");

    std::string sseErr = formatSseEvent("error", R"({"error":{"code":"err"}})");
    CHECK(sseErr == "event: error\ndata: {\"error\":{\"code\":\"err\"}}\n\n");
}

TEST(ApiRagTest, AskStreamEmptyIndexZeroLLMCalls) {
    // Closed port to guarantee zero Ollama calls are made
    OllamaConfig deadCfg;
    deadCfg.baseUrl = "http://127.0.0.1:1";
    OllamaClient deadClient(deadCfg);

    RagConfig ragCfg;
    ragCfg.dimension = 768;
    RagPipeline pipeline(ragCfg, deadClient);

    bool sourcesCalled = false;
    std::string streamedToken;

    auto onSources = [&](const std::vector<RagSource>& s) {
        sourcesCalled = true;
        CHECK(s.empty());
    };

    auto onToken = [&](const std::string& tok) -> bool {
        streamedToken += tok;
        return true;
    };

    AskResult res = pipeline.ask("Any question?", 4, Algorithm::Hnsw, std::nullopt, {}, false, onToken, onSources);
    CHECK(sourcesCalled == true);
    CHECK(streamedToken == "No documents have been ingested yet.");
    CHECK(res.answer == "No documents have been ingested yet.");
    CHECK(res.sources.empty());
}

TEST(ApiRagTest, AskStreamWithTokensAndEarlyAbort) {
    FakeOllamaServer fake;

    OllamaConfig liveCfg;
    liveCfg.baseUrl = fake.baseUrl();
    OllamaClient client(liveCfg);

    RagConfig ragCfg;
    ragCfg.dimension = 768;
    RagPipeline pipeline(ragCfg, client);

    pipeline.ingest("VectorDB Doc", "Vector databases index high dimensional vectors efficiently using HNSW.");

    std::vector<RagSource> receivedSources;
    std::vector<std::string> receivedTokens;

    auto onSources = [&](const std::vector<RagSource>& s) {
        receivedSources = s;
    };

    auto onToken = [&](const std::string& tok) -> bool {
        receivedTokens.push_back(tok);
        // Abort after 1st token
        return false;
    };

    AskResult res = pipeline.ask("How does VectorDB index vectors?", 2, Algorithm::Hnsw, std::nullopt, {}, false, onToken, onSources);

    CHECK(!receivedSources.empty());
    CHECK(receivedSources[0].title == "VectorDB Doc");
    CHECK(receivedTokens.size() == 1);
}
