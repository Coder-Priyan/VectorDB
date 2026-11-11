#include "test_harness.hpp"
#include "fake_ollama.hpp"
#include "vectordb/collection.hpp"
#include "vectordb/api.hpp"
#include "vectordb/rag.hpp"

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

    RagConfig rCfg;
    rCfg.dimension = 4;
    vectordb::testing::FakeOllamaServer fakeOllama;
    OllamaConfig oCfg;
    oCfg.baseUrl = fakeOllama.baseUrl();
    OllamaClient oClient(oCfg);
    RagPipeline rag(rCfg, oClient);

    svr.Get("/api/docs/hnsw/info", [&](const httplib::Request&, httplib::Response& res) {
        sendResponse(res, handleHnswInfo(rag.collection()));
    });

    svr.set_post_routing_handler([](const httplib::Request&, httplib::Response& res) {
        res.set_header("X-Content-Type-Options", "nosniff");
        res.set_header("X-Frame-Options", "DENY");
        res.set_header("Referrer-Policy", "no-referrer");
        res.set_header("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");
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

        // Verify security response headers on /api/health
        CHECK(healthRes->get_header_value("X-Content-Type-Options") == "nosniff");
        CHECK(healthRes->get_header_value("X-Frame-Options") == "DENY");
        CHECK(healthRes->get_header_value("Referrer-Policy") == "no-referrer");
        CHECK(healthRes->get_header_value("Content-Security-Policy") ==
              "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");
    }

    // 1b. Test GET /api/docs/hnsw/info (empty docs collection)
    auto docsHnswRes = cli.Get("/api/docs/hnsw/info");
    CHECK(docsHnswRes != nullptr);
    if (docsHnswRes) {
        CHECK(docsHnswRes->status == 200);
        json dhj = json::parse(docsHnswRes->body);
        CHECK(dhj["numNodes"] == 0);
        CHECK(dhj["maxLevel"] == -1);
        CHECK(docsHnswRes->get_header_value("X-Content-Type-Options") == "nosniff");
        CHECK(docsHnswRes->get_header_value("X-Frame-Options") == "DENY");
        CHECK(docsHnswRes->get_header_value("Referrer-Policy") == "no-referrer");
        CHECK(docsHnswRes->get_header_value("Content-Security-Policy") ==
              "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");
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

namespace {

struct ParsedSseEvent {
    std::string name;
    std::string data;
};

std::vector<ParsedSseEvent> parseSseStream(const std::string& raw) {
    std::vector<ParsedSseEvent> events;
    std::istringstream stream(raw);
    std::string line;
    std::string curEvent;
    std::string curData;

    while (std::getline(stream, line)) {
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }
        if (line.empty()) {
            if (!curEvent.empty() || !curData.empty()) {
                events.push_back({curEvent, curData});
                curEvent.clear();
                curData.clear();
            }
        } else if (line.rfind("event: ", 0) == 0) {
            curEvent = line.substr(7);
        } else if (line.rfind("data: ", 0) == 0) {
            if (!curData.empty()) curData += "\n";
            curData += line.substr(6);
        }
    }
    if (!curEvent.empty() || !curData.empty()) {
        events.push_back({curEvent, curData});
    }
    return events;
}

std::string formatSseHelper(const std::string& event, const std::string& data) {
    return "event: " + event + "\ndata: " + data + "\n\n";
}

} // namespace

TEST(ServerHttpTest, SseRealIntegrationEventOrderAndTimings) {
    using namespace vectordb::testing;

    FakeOllamaServer fakeOllama;
    fakeOllama.version = "0.4.0";
    fakeOllama.models = {"nomic-embed-text:latest", "llama3.2:latest"};

    OllamaConfig oCfg;
    oCfg.baseUrl = fakeOllama.baseUrl();
    OllamaClient oClient(oCfg);

    RagConfig rCfg;
    rCfg.dimension = 768;
    RagPipeline rag(rCfg, oClient);

    rag.ingest("TestDoc", "Vector databases enable high-speed similarity search across high dimensions.");

    httplib::Server svr;
    auto sendResponse = [](httplib::Response& res, const ApiResponse& apiRes) {
        res.status = apiRes.status;
        res.set_content(apiRes.body, apiRes.contentType);
    };

    svr.Post("/api/ask", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleAsk(rag, req.body));
    });

    svr.set_post_routing_handler([](const httplib::Request&, httplib::Response& res) {
        res.set_header("X-Content-Type-Options", "nosniff");
        res.set_header("X-Frame-Options", "DENY");
        res.set_header("Referrer-Policy", "no-referrer");
        res.set_header("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");
    });

    svr.Post("/api/ask/stream", [&](const httplib::Request& req, httplib::Response& res) {
        AskRequest askReq;
        if (auto err = parseAskRequest(req.body, askReq)) {
            sendResponse(res, *err);
            return;
        }

        res.set_header("Cache-Control", "no-cache");
        res.set_header("Connection", "keep-alive");

        res.set_chunked_content_provider(
            "text/event-stream; charset=utf-8",
            [&rag, askReq](size_t /*offset*/, httplib::DataSink& sink) -> bool {
                auto onSources = [&](const std::vector<RagSource>& sources) {
                    json sDoc;
                    json sArr = json::array();
                    for (const auto& s : sources) {
                        json item;
                        item["n"] = s.n;
                        item["title"] = s.title;
                        item["text"] = s.text;
                        sArr.push_back(std::move(item));
                    }
                    sDoc["sources"] = std::move(sArr);
                    std::string sseData = formatSseHelper("sources", sDoc.dump());
                    sink.write(sseData.data(), sseData.size());
                };

                auto onToken = [&](const std::string& tokenPiece) -> bool {
                    json tDoc;
                    tDoc["t"] = tokenPiece;
                    tDoc["token"] = tokenPiece;
                    std::string sseData = formatSseHelper("token", tDoc.dump());
                    return sink.write(sseData.data(), sseData.size());
                };

                AskResult askRes = rag.ask(askReq.question, askReq.k, askReq.algorithm, askReq.ef, askReq.chatOpt, askReq.debug, onToken, onSources);

                json dDoc;
                dDoc["answer"] = askRes.answer;
                dDoc["model"] = askRes.model;
                dDoc["timings"] = {
                    {"embed_ms", askRes.timings.embedMs},
                    {"search_ms", askRes.timings.searchMs},
                    {"generate_ms", askRes.timings.generateMs},
                    {"first_token_ms", askRes.timings.firstTokenMs},
                    {"total_ms", askRes.timings.totalMs}
                };
                std::string sseDone = formatSseHelper("done", dDoc.dump());
                sink.write(sseDone.data(), sseDone.size());
                sink.done();
                return false;
            }
        );
    });

    int port = svr.bind_to_any_port("127.0.0.1");
    CHECK(port > 0);

    std::thread serverThread([&svr]() {
        svr.listen_after_bind();
    });
    std::this_thread::sleep_for(std::chrono::milliseconds(50));

    httplib::Client cli("127.0.0.1", port);
    cli.set_connection_timeout(5, 0);
    cli.set_read_timeout(5, 0);

    // 1. Check SSE stream with events order: sources -> token* -> done
    std::string rawStream;
    httplib::Request streamHttpReq;
    streamHttpReq.method = "POST";
    streamHttpReq.path = "/api/ask/stream";
    streamHttpReq.set_header("Content-Type", "application/json");
    streamHttpReq.body = R"({"question":"What is vector search?"})";
    streamHttpReq.content_receiver = [&](const char* data, size_t len, uint64_t /*offset*/, uint64_t /*total*/) -> bool {
        rawStream.append(data, len);
        return true;
    };
    auto res = cli.send(streamHttpReq);

    CHECK(res != nullptr);
    if (res) {
        CHECK(res->status == 200);

        // Verify security response headers on SSE stream
        CHECK(res->get_header_value("X-Content-Type-Options") == "nosniff");
        CHECK(res->get_header_value("X-Frame-Options") == "DENY");
        CHECK(res->get_header_value("Referrer-Policy") == "no-referrer");
        CHECK(res->get_header_value("Content-Security-Policy") ==
              "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");

        auto events = parseSseStream(rawStream);
        CHECK(events.size() >= 3);
        if (events.size() >= 3) {
            // First event: sources
            CHECK(events.front().name == "sources");
            json sourcesJson = json::parse(events.front().data);
            CHECK(sourcesJson.contains("sources"));
            CHECK(!sourcesJson["sources"].empty());

            // Last event: done
            CHECK(events.back().name == "done");
            json doneJson = json::parse(events.back().data);
            CHECK(doneJson.contains("answer"));
            CHECK(doneJson.contains("timings"));
            CHECK(doneJson["timings"].contains("first_token_ms"));
            CHECK(doneJson["timings"]["first_token_ms"].is_number());
            CHECK(doneJson["timings"]["first_token_ms"].get<double>() >= 0.0);

            // Middle events: token
            for (size_t i = 1; i + 1 < events.size(); ++i) {
                CHECK(events[i].name == "token");
                json tokJson = json::parse(events[i].data);
                CHECK(tokJson.contains("t"));
                CHECK(tokJson.contains("token"));
            }
        }
    }

    // 2. Pre-stream error: missing 'question' must return HTTP 400 application/json
    auto errRes = cli.Post("/api/ask/stream", "{}", "application/json");
    CHECK(errRes != nullptr);
    if (errRes) {
        CHECK(errRes->status == 400);
        CHECK(errRes->get_header_value("Content-Type").find("application/json") != std::string::npos);
        json errJson = json::parse(errRes->body);
        CHECK(errJson.contains("error"));
        CHECK(errJson["error"]["code"] == "validation_error");
    }

    // 3. Option equality test: /api/ask and /api/ask/stream send identical ChatOptions and prompt messages
    fakeOllama.reset();
    std::string customReq = R"({
        "question": "What is vector search?",
        "temperature": 0.35,
        "seed": 999,
        "num_ctx": 2048,
        "num_predict": 256
    })";

    auto askRes = cli.Post("/api/ask", customReq, "application/json");
    CHECK(askRes != nullptr && askRes->status == 200);

    httplib::Request customStreamReq;
    customStreamReq.method = "POST";
    customStreamReq.path = "/api/ask/stream";
    customStreamReq.set_header("Content-Type", "application/json");
    customStreamReq.body = customReq;
    auto streamRes = cli.send(customStreamReq);
    CHECK(streamRes != nullptr && streamRes->status == 200);

    {
        std::lock_guard<std::mutex> lock(fakeOllama.dataMutex);
        CHECK(fakeOllama.receivedChatRequests.size() == 2);
        if (fakeOllama.receivedChatRequests.size() == 2) {
            const auto& askChat = fakeOllama.receivedChatRequests[0];
            const auto& streamChat = fakeOllama.receivedChatRequests[1];

            // Options must be identical
            CHECK(askChat["options"] == streamChat["options"]);
            CHECK_NEAR(askChat["options"]["temperature"].get<double>(), 0.35, 1e-6);
            CHECK(askChat["options"]["seed"] == 999);
            CHECK(askChat["options"]["num_ctx"] == 2048);
            CHECK(askChat["options"]["num_predict"] == 256);

            // Prompt messages must be identical
            CHECK(askChat["messages"] == streamChat["messages"]);
        }
    }

    svr.stop();
    if (serverThread.joinable()) {
        serverThread.join();
    }
}

TEST(ServerHttpTest, StaticFileServingAndPathTraversalSafety) {
    httplib::Server svr;

    // Mount web directory as in server_main.cpp
    std::string webDir = "web";
    CHECK(std::filesystem::exists(webDir));
    CHECK(svr.set_mount_point("/", webDir));

    svr.set_post_routing_handler([](const httplib::Request&, httplib::Response& res) {
        res.set_header("X-Content-Type-Options", "nosniff");
        res.set_header("X-Frame-Options", "DENY");
        res.set_header("Referrer-Policy", "no-referrer");
        res.set_header("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");
    });

    int port = svr.bind_to_any_port("127.0.0.1");
    CHECK(port > 0);

    std::thread serverThread([&svr]() {
        svr.listen_after_bind();
    });

    httplib::Client cli("127.0.0.1", port);
    cli.set_connection_timeout(5);
    cli.set_read_timeout(5);

    // 1. Root GET / serves index.html with text/html
    auto resRoot = cli.Get("/");
    CHECK(resRoot != nullptr);
    CHECK(resRoot->status == 200);
    CHECK(resRoot->get_header_value("Content-Type").find("text/html") != std::string::npos);
    CHECK(resRoot->body.find("VectorDB") != std::string::npos);
    CHECK(resRoot->body.find("Content-Security-Policy") != std::string::npos);

    // Verify security response headers on static file serving
    CHECK(resRoot->get_header_value("X-Content-Type-Options") == "nosniff");
    CHECK(resRoot->get_header_value("X-Frame-Options") == "DENY");
    CHECK(resRoot->get_header_value("Referrer-Policy") == "no-referrer");
    CHECK(resRoot->get_header_value("Content-Security-Policy") ==
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");

    // 2. Direct GET /index.html
    auto resIndex = cli.Get("/index.html");
    CHECK(resIndex != nullptr);
    CHECK(resIndex->status == 200);
    CHECK(resIndex->get_header_value("Content-Type").find("text/html") != std::string::npos);

    // 3. CSS file: text/css
    auto resCss = cli.Get("/css/app.css");
    CHECK(resCss != nullptr);
    CHECK(resCss->status == 200);
    CHECK(resCss->get_header_value("Content-Type").find("text/css") != std::string::npos);

    // 4. JS file: text/javascript
    auto resJs = cli.Get("/js/main.js");
    CHECK(resJs != nullptr);
    CHECK(resJs->status == 200);
    CHECK(resJs->get_header_value("Content-Type").find("text/javascript") != std::string::npos);

    // 5. Test suite HTML: /tests.html
    auto resTests = cli.Get("/tests.html");
    CHECK(resTests != nullptr);
    CHECK(resTests->status == 200);
    CHECK(resTests->get_header_value("Content-Type").find("text/html") != std::string::npos);

    // 6. Path Traversal Safety: GET /../README.md
    auto resTrav1 = cli.Get("/../README.md");
    CHECK(resTrav1 != nullptr);
    CHECK(resTrav1->status == 404 || resTrav1->status == 403);
    CHECK(resTrav1->body.find("# VectorDB") == std::string::npos);

    // 7. Path Traversal Safety: encoded /%2e%2e%2fREADME.md
    auto resTrav2 = cli.Get("/%2e%2e%2fREADME.md");
    CHECK(resTrav2 != nullptr);
    CHECK(resTrav2->status == 404 || resTrav2->status == 403);
    CHECK(resTrav2->body.find("# VectorDB") == std::string::npos);

    // 8. Path Traversal Safety: mixed /%2e%2e/README.md
    auto resTrav3 = cli.Get("/%2e%2e/README.md");
    CHECK(resTrav3 != nullptr);
    CHECK(resTrav3->status == 404 || resTrav3->status == 403);
    CHECK(resTrav3->body.find("# VectorDB") == std::string::npos);

    // 9. Path Traversal Safety: mixed /..%2fREADME.md
    auto resTrav4 = cli.Get("/..%2fREADME.md");
    CHECK(resTrav4 != nullptr);
    CHECK(resTrav4->status == 404 || resTrav4->status == 403);
    CHECK(resTrav4->body.find("# VectorDB") == std::string::npos);

    svr.stop();
    if (serverThread.joinable()) {
        serverThread.join();
    }
}



