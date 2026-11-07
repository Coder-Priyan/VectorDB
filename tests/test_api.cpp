#include "test_harness.hpp"
#include "vectordb/api.hpp"
#include "nlohmann/json.hpp"

using namespace vectordb;
using json = nlohmann::json;

TEST(ApiTest, HealthAndConfigEndpoints) {
    ApiResponse res = handleHealth();
    CHECK(res.status == 200);
    json j = json::parse(res.body);
    CHECK(j["status"] == "ok");
    CHECK(j["version"] == "0.4.0");

    CollectionConfig cfg;
    cfg.dimension = 4;
    cfg.metric = Metric::Euclidean;
    Collection col(cfg);

    ApiResponse cfgRes = handleGetConfig(col);
    CHECK(cfgRes.status == 200);
    json cj = json::parse(cfgRes.body);
    CHECK(cj["dimension"] == 4);
    CHECK(cj["metric"] == "euclidean");
    CHECK(cj["hnsw"]["M"] == 16);
}

TEST(ApiTest, ResetAndStatsEndpoints) {
    CollectionConfig cfg;
    cfg.dimension = 3;
    Collection col(cfg);

    col.insert(std::nullopt, {1.0f, 2.0f, 3.0f});
    col.insert(std::nullopt, {4.0f, 5.0f, 6.0f});

    ApiResponse st1 = handleGetStats(col);
    CHECK(st1.status == 200);
    json sj1 = json::parse(st1.body);
    CHECK(sj1["count"] == 2);
    CHECK(sj1["dimension"] == 3);

    // Reset with partial config
    std::string resetBody = R"({
        "dimension": 2,
        "metric": "manhattan",
        "hnsw": {"M": 8, "efSearch": 60}
    })";

    ApiResponse resetRes = handleReset(col, resetBody);
    CHECK(resetRes.status == 200);
    json rj = json::parse(resetRes.body);
    CHECK(rj["dimension"] == 2);
    CHECK(rj["metric"] == "manhattan");
    CHECK(rj["hnsw"]["M"] == 8);
    CHECK(rj["hnsw"]["efSearch"] == 60);

    // Verify stats after reset
    ApiResponse st2 = handleGetStats(col);
    CHECK(st2.status == 200);
    json sj2 = json::parse(st2.body);
    CHECK(sj2["count"] == 0);
    CHECK(sj2["dimension"] == 2);
    CHECK(sj2["metric"] == "manhattan");

    // Invalid JSON reset
    ApiResponse badReset = handleReset(col, "{invalid_json");
    CHECK(badReset.status == 400);
    json bj = json::parse(badReset.body);
    CHECK(bj["error"]["code"] == "invalid_json");
}

TEST(ApiTest, InsertVectorAndGetVector) {
    CollectionConfig cfg;
    cfg.dimension = 2;
    Collection col(cfg);

    // 1. Insert with explicit ID and object metadata
    std::string insert1 = R"({
        "id": 101,
        "vector": [1.0, 2.0],
        "metadata": {"title": "Doc 1", "author": "Alice"}
    })";
    ApiResponse res1 = handleInsertVector(col, insert1);
    CHECK(res1.status == 201);
    json j1 = json::parse(res1.body);
    CHECK(j1["id"] == 101);

    // 2. Get existing vector
    ApiResponse getRes1 = handleGetVector(col, 101);
    CHECK(getRes1.status == 200);
    json gj1 = json::parse(getRes1.body);
    CHECK(gj1["id"] == 101);
    CHECK(gj1["vector"].size() == 2);
    CHECK(gj1["vector"][0] == 1.0f);
    CHECK(gj1["metadata"]["author"] == "Alice");

    // 3. Insert with auto ID
    std::string insert2 = R"({"vector": [3.0, 4.0]})";
    ApiResponse res2 = handleInsertVector(col, insert2);
    CHECK(res2.status == 201);
    json j2 = json::parse(res2.body);
    VectorId autoId = j2["id"].get<VectorId>();
    CHECK(autoId > 0);

    // 4. Duplicate ID returns 400 duplicate_id
    ApiResponse dupRes = handleInsertVector(col, insert1);
    CHECK(dupRes.status == 400);
    json dj = json::parse(dupRes.body);
    CHECK(dj["error"]["code"] == "duplicate_id");

    // 5. Unknown ID returns 404 not_found
    ApiResponse missingRes = handleGetVector(col, 9999);
    CHECK(missingRes.status == 404);
    json mj = json::parse(missingRes.body);
    CHECK(mj["error"]["code"] == "not_found");

    // 6. Dimension mismatch
    std::string badDim = R"({"vector": [1.0, 2.0, 3.0]})";
    ApiResponse dimErr = handleInsertVector(col, badDim);
    CHECK(dimErr.status == 400);
    json dej = json::parse(dimErr.body);
    CHECK(dej["error"]["code"] == "validation_error");
}

TEST(ApiTest, BatchInsertAllOrNothing) {
    CollectionConfig cfg;
    cfg.dimension = 2;
    Collection col(cfg);

    // Initial item
    col.insert(10, {0.0f, 0.0f});
    CHECK(col.stats().count == 1);

    // 1. Batch where item at index 2 has dimension mismatch (3 instead of 2)
    std::string badBatch = R"({
        "items": [
            {"id": 1, "vector": [1.0, 0.0]},
            {"id": 2, "vector": [0.0, 1.0]},
            {"id": 3, "vector": [1.0, 1.0, 1.0]},
            {"id": 4, "vector": [-1.0, 0.0]}
        ]
    })";

    ApiResponse errRes = handleBatchInsert(col, badBatch);
    CHECK(errRes.status == 400);
    json ej = json::parse(errRes.body);
    CHECK(ej["error"]["code"] == "validation_error");
    CHECK(ej["error"]["index"] == 2);

    // PROVE all-or-nothing: collection count MUST still be 1!
    CHECK(col.stats().count == 1);
    CHECK(!col.contains(1));
    CHECK(!col.contains(2));

    // 2. Batch where item at index 1 collides with existing ID 10
    std::string dupBatch = R"({
        "items": [
            {"id": 5, "vector": [0.5, 0.5]},
            {"id": 10, "vector": [0.2, 0.8]}
        ]
    })";
    ApiResponse dupErr = handleBatchInsert(col, dupBatch);
    CHECK(dupErr.status == 400);
    json dej = json::parse(dupErr.body);
    CHECK(dej["error"]["code"] == "duplicate_id");
    CHECK(dej["error"]["index"] == 1);
    CHECK(col.stats().count == 1);
    CHECK(!col.contains(5));

    // 3. Valid batch
    std::string goodBatch = R"({
        "items": [
            {"id": 1, "vector": [1.0, 0.0], "metadata": "item1"},
            {"id": 2, "vector": [0.0, 1.0], "metadata": {"tag": "item2"}},
            {"vector": [-1.0, 0.0]}
        ]
    })";
    ApiResponse goodRes = handleBatchInsert(col, goodBatch);
    CHECK(goodRes.status == 201);
    json gj = json::parse(goodRes.body);
    CHECK(gj["inserted"] == 3);
    CHECK(gj["ids"].size() == 3);
    CHECK(col.stats().count == 4);
}

TEST(ApiTest, SearchAndBenchmarkEndpoints) {
    CollectionConfig cfg;
    cfg.dimension = 2;
    cfg.metric = Metric::Euclidean;
    Collection col(cfg);

    col.insert(1, {1.0f, 0.0f}, "{\"name\":\"x+\"}");
    col.insert(2, {0.0f, 1.0f}, "{\"name\":\"y+\"}");
    col.insert(3, {-1.0f, 0.0f}, "{\"name\":\"x-\"}");
    col.insert(4, {0.0f, -1.0f}, "{\"name\":\"y-\"}");

    // Search endpoint
    std::string searchBody = R"({
        "vector": [0.9, 0.1],
        "k": 2,
        "algorithm": "hnsw",
        "ef": 20
    })";

    ApiResponse sRes = handleSearch(col, searchBody);
    CHECK(sRes.status == 200);
    json sj = json::parse(sRes.body);
    CHECK(sj["algorithm"] == "hnsw");
    CHECK(sj["k"] == 2);
    CHECK(sj["results"].size() == 2);
    CHECK(sj["results"][0]["id"] == 1);
    CHECK(sj["results"][0]["metadata"]["name"] == "x+");

    // Benchmark endpoint
    std::string benchBody = R"({
        "vector": [0.9, 0.1],
        "k": 2,
        "ef": 30
    })";

    ApiResponse bRes = handleBenchmark(col, benchBody);
    CHECK(bRes.status == 200);
    json bj = json::parse(bRes.body);
    CHECK(bj["ground_truth"] == "brute");
    CHECK(bj["algorithms"].contains("brute"));
    CHECK(bj["algorithms"].contains("kdtree"));
    CHECK(bj["algorithms"].contains("hnsw"));
    CHECK(bj["algorithms"]["brute"]["recall_at_k"] == 1.0);
    CHECK(bj["algorithms"]["kdtree"]["recall_at_k"] == 1.0);
}

TEST(ApiTest, HnswInfoNodeAndTraceEndpoints) {
    CollectionConfig cfg;
    cfg.dimension = 2;
    Collection col(cfg);

    for (std::size_t i = 1; i <= 20; ++i) {
        col.insert(i, {static_cast<float>(i), 1.0f});
    }

    // Info
    ApiResponse infoRes = handleHnswInfo(col);
    CHECK(infoRes.status == 200);
    json ij = json::parse(infoRes.body);
    CHECK(ij["numNodes"] == 20);
    CHECK(ij["maxLevel"] >= 0);

    // Node
    ApiResponse nodeRes = handleHnswNode(col, 1);
    CHECK(nodeRes.status == 200);
    json nj = json::parse(nodeRes.body);
    CHECK(nj["id"] == 1);
    CHECK(nj["neighbors"].contains("0"));

    ApiResponse badNode = handleHnswNode(col, 9999);
    CHECK(badNode.status == 404);

    // Trace
    std::string traceBody = R"({
        "vector": [5.0, 1.0],
        "k": 3,
        "ef": 20
    })";
    ApiResponse traceRes = handleHnswTrace(col, traceBody);
    CHECK(traceRes.status == 200);
    json tj = json::parse(traceRes.body);
    CHECK(tj["results"].size() == 3);
    CHECK(tj["stats"]["distanceComputations"] > 0);
    CHECK(!tj["trace"].empty());
}

TEST(ApiTest, DemoRandomEndpoint) {
    CollectionConfig cfg;
    cfg.dimension = 4;
    Collection col(cfg);

    std::string randomBody = R"({
        "n": 50,
        "seed": 123
    })";

    ApiResponse rRes = handleDemoRandom(col, randomBody);
    CHECK(rRes.status == 200);
    json rj = json::parse(rRes.body);
    CHECK(rj["inserted"] == 50);
    CHECK(col.stats().count == 50);

    // Reject > 100000
    std::string tooBig = R"({"n": 100001})";
    ApiResponse bigErr = handleDemoRandom(col, tooBig);
    CHECK(bigErr.status == 400);

    // Reject <= 0
    std::string zeroN = R"({"n": 0})";
    ApiResponse zeroErr = handleDemoRandom(col, zeroN);
    CHECK(zeroErr.status == 400);
}

TEST(ApiTest, PcaAndPcaQueryEndpoints) {
    CollectionConfig cfg;
    cfg.dimension = 4;
    cfg.metric = Metric::Cosine;
    Collection col(cfg);

    for (std::size_t i = 1; i <= 15; ++i) {
        col.insert(i, {static_cast<float>(i), 1.0f, 2.0f, 3.0f}, "{\"label\":\"item_" + std::to_string(i) + "\"}");
    }

    PcaCache cache;
    ApiResponse pcaRes = handleGetPca(col, cache, std::nullopt, false);
    CHECK(pcaRes.status == 200);
    json pj = json::parse(pcaRes.body);
    CHECK(pj["dim"] == 4);
    CHECK(pj["points"].size() == 15);
    CHECK(pj["explained_ratio"].size() == 2);
    CHECK(pj["total_variance"].get<double>() > 0.0);
    CHECK(pj["points"][0].contains("x"));
    CHECK(pj["points"][0].contains("y"));
    CHECK(pj["points"][0].contains("metadata"));

    // Cache verification: version matches, cache remains populated
    CHECK(cache.cachedVersion == col.version());
    CHECK(cache.nodeCoords.size() == 15);

    // POST /api/pca/query
    std::string queryBody = R"({
        "vector": [5.0, 1.0, 2.0, 3.0],
        "k": 3,
        "algorithm": "hnsw"
    })";
    ApiResponse qRes = handlePcaQuery(col, cache, queryBody);
    CHECK(qRes.status == 200);
    json qj = json::parse(qRes.body);
    CHECK(qj.contains("query_projected"));
    CHECK(qj["query_projected"].contains("x"));
    CHECK(qj["query_projected"].contains("y"));
    CHECK(qj["results"].size() == 3);
    CHECK(qj["results"][0].contains("id"));
    CHECK(qj["results"][0].contains("x"));
    CHECK(qj["results"][0].contains("y"));
    CHECK(qj["results"][0].contains("distance"));

    // Validation errors
    ApiResponse dimErr = handlePcaQuery(col, cache, R"({"vector": [1.0, 2.0]})");
    CHECK(dimErr.status == 400);

    ApiResponse kErr = handlePcaQuery(col, cache, R"({"vector": [1.0, 2.0, 3.0, 4.0], "k": -1})");
    CHECK(kErr.status == 400);
}

TEST(ApiTest, HnswGraphEndpoint) {
    CollectionConfig cfg;
    cfg.dimension = 4;
    Collection col(cfg);

    for (std::size_t i = 1; i <= 25; ++i) {
        col.insert(i, {static_cast<float>(i), 2.0f, 3.0f, 4.0f});
    }

    PcaCache cache;
    ApiResponse gRes = handleHnswGraph(col, cache, 0, 50, false);
    CHECK(gRes.status == 200);
    json gj = json::parse(gRes.body);
    CHECK(gj["layer"] == 0);
    CHECK(gj["nodes"].size() == 25);
    CHECK(!gj["edges"].empty());
    CHECK(gj["nodes"][0].contains("x"));
    CHECK(gj["nodes"][0].contains("y"));
    CHECK(gj["edges"][0].contains("source"));
    CHECK(gj["edges"][0].contains("target"));

    // Negative layer returns 400
    ApiResponse negErr = handleHnswGraph(col, cache, -1, 50, false);
    CHECK(negErr.status == 400);
}

TEST(ApiTest, HostHeaderSecurityCheck) {
    // Valid loopback hosts on port 8080
    CHECK(isAllowedLoopbackHost("127.0.0.1:8080", 8080) == true);
    CHECK(isAllowedLoopbackHost("localhost:8080", 8080) == true);
    CHECK(isAllowedLoopbackHost("[::1]:8080", 8080) == true);
    CHECK(isAllowedLoopbackHost("LOCALHOST:8080", 8080) == true); // Case-insensitive
    CHECK(isAllowedLoopbackHost("LocalHost:8080", 8080) == true);

    // DNS rebinding attack vectors rejected
    CHECK(isAllowedLoopbackHost("attacker.com:8080", 8080) == false);
    CHECK(isAllowedLoopbackHost("evil.com", 8080) == false);
    CHECK(isAllowedLoopbackHost("192.168.1.100:8080", 8080) == false);
    CHECK(isAllowedLoopbackHost("example.com", 8080) == false);

    // Wrong port rejected
    CHECK(isAllowedLoopbackHost("127.0.0.1:9090", 8080) == false);
    CHECK(isAllowedLoopbackHost("localhost:3000", 8080) == false);

    // Empty rejected
    CHECK(isAllowedLoopbackHost("", 8080) == false);

    // Port 80 allows bare hostnames
    CHECK(isAllowedLoopbackHost("127.0.0.1", 80) == true);
    CHECK(isAllowedLoopbackHost("localhost", 80) == true);
    CHECK(isAllowedLoopbackHost("[::1]", 80) == true);
}

