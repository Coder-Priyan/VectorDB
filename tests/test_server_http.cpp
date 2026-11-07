#include "test_harness.hpp"
#include "vectordb/collection.hpp"
#include "vectordb/api.hpp"

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#endif

#include "httplib.h"
#include "nlohmann/json.hpp"

#include <thread>
#include <chrono>

using namespace vectordb;
using json = nlohmann::json;

TEST(ServerHttpTest, RealIntegrationTestEphemeralPort) {
    CollectionConfig config;
    config.dimension = 4;
    config.metric = Metric::Euclidean;
    config.hnswParams.M = 8;
    config.hnswParams.efConstruction = 50;
    config.hnswParams.efSearch = 20;

    Collection collection(config);

    httplib::Server svr;

    // Helper to wire response
    auto sendResponse = [](httplib::Response& res, const ApiResponse& apiRes) {
        res.status = apiRes.status;
        res.set_content(apiRes.body, apiRes.contentType);
    };

    svr.Get("/api/health", [&](const httplib::Request&, httplib::Response& res) {
        sendResponse(res, handleHealth());
    });

    svr.Post("/api/vectors", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleInsertVector(collection, req.body));
    });

    svr.Post("/api/search", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleSearch(collection, req.body));
    });

    svr.Post("/api/benchmark", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleBenchmark(collection, req.body));
    });

    // Bind to an ephemeral OS-assigned port on loopback
    int port = svr.bind_to_any_port("127.0.0.1");
    CHECK(port > 0);

    // Launch server in background thread
    std::thread serverThread([&svr]() {
        svr.listen_after_bind();
    });

    // Give server a moment to start
    std::this_thread::sleep_for(std::chrono::milliseconds(50));

    // Connect client to 127.0.0.1:port with strict timeouts to prevent hanging
    httplib::Client cli("127.0.0.1", port);
    cli.set_connection_timeout(5, 0); // 5 sec
    cli.set_read_timeout(5, 0);
    cli.set_write_timeout(5, 0);

    // 1. Test GET /api/health
    auto healthRes = cli.Get("/api/health");
    CHECK(healthRes != nullptr);
    if (healthRes) {
        CHECK(healthRes->status == 200);
        json hj = json::parse(healthRes->body);
        CHECK(hj["status"] == "ok");
        CHECK(hj["version"] == "0.4.0");
    }

    // 2. Test POST /api/vectors
    std::string insertBody = R"({
        "id": 101,
        "vector": [1.0, 2.0, 3.0, 4.0],
        "metadata": {"source": "integration_test"}
    })";
    auto insertRes = cli.Post("/api/vectors", insertBody, "application/json");
    CHECK(insertRes != nullptr);
    if (insertRes) {
        CHECK(insertRes->status == 201);
        json ij = json::parse(insertRes->body);
        CHECK(ij["id"] == 101);
    }

    // Insert 4 more vectors
    cli.Post("/api/vectors", R"({"id": 102, "vector": [1.1, 2.1, 3.1, 4.1]})", "application/json");
    cli.Post("/api/vectors", R"({"id": 103, "vector": [5.0, 5.0, 5.0, 5.0]})", "application/json");
    cli.Post("/api/vectors", R"({"id": 104, "vector": [0.0, 0.0, 0.0, 0.0]})", "application/json");

    // 3. Test POST /api/search
    std::string searchBody = R"({
        "vector": [1.05, 2.05, 3.05, 4.05],
        "k": 2,
        "algorithm": "hnsw"
    })";
    auto searchRes = cli.Post("/api/search", searchBody, "application/json");
    CHECK(searchRes != nullptr);
    if (searchRes) {
        CHECK(searchRes->status == 200);
        json sj = json::parse(searchRes->body);
        CHECK(sj["algorithm"] == "hnsw");
        CHECK(sj["results"].size() == 2);
        CHECK(sj["results"][0]["id"] == 101 || sj["results"][0]["id"] == 102);
    }

    // 4. Test POST /api/benchmark
    std::string benchBody = R"({
        "vector": [1.0, 2.0, 3.0, 4.0],
        "k": 2
    })";
    auto benchRes = cli.Post("/api/benchmark", benchBody, "application/json");
    CHECK(benchRes != nullptr);
    if (benchRes) {
        CHECK(benchRes->status == 200);
        json bj = json::parse(benchRes->body);
        CHECK(bj["ground_truth"] == "brute");
        CHECK(bj["algorithms"]["brute"]["recall_at_k"] == 1.0);
        CHECK(bj["algorithms"]["kdtree"]["recall_at_k"] == 1.0);
        CHECK(bj["algorithms"]["hnsw"]["recall_at_k"] >= 0.5);
    }

    // Cleanly stop server and join thread
    svr.stop();
    if (serverThread.joinable()) {
        serverThread.join();
    }
}

