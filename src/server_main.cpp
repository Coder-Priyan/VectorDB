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

#include <iostream>
#include <string>
#include <filesystem>
#include <csignal>
#include <atomic>

using namespace vectordb;
using json = nlohmann::json;

namespace {
std::atomic<bool> g_running{true};
httplib::Server* g_serverPtr = nullptr;

void signalHandler(int) {
    g_running = false;
    if (g_serverPtr) {
        g_serverPtr->stop();
    }
}
} // namespace

int main(int argc, char* argv[]) {
    int port = 8080;
    std::string host = "127.0.0.1";
    std::string webDir = "web";

    // Demo collection config
    CollectionConfig config;
    config.dimension = 128;
    config.metric = Metric::Cosine;
    config.hnswParams.M = 16;
    config.hnswParams.efConstruction = 200;
    config.hnswParams.efSearch = 50;
    config.hnswParams.seed = 42;
    config.leafSize = 8;

    // RAG & Ollama config
    std::string ollamaUrl = "http://127.0.0.1:11434";
    std::string embedModel = "nomic-embed-text";
    std::string chatModel = "llama3.2";
    std::size_t ragDim = 768;
    bool allowRemoteOllama = false;
    std::string corsOrigin = "";

    // Parse CLI arguments
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--port" && i + 1 < argc) {
            port = std::stoi(argv[++i]);
        } else if (arg == "--host" && i + 1 < argc) {
            host = argv[++i];
        } else if (arg == "--dim" && i + 1 < argc) {
            config.dimension = std::stoull(argv[++i]);
        } else if (arg == "--metric" && i + 1 < argc) {
            config.metric = metricFromString(argv[++i]);
        } else if (arg == "--M" && i + 1 < argc) {
            config.hnswParams.M = std::stoull(argv[++i]);
        } else if (arg == "--efConstruction" && i + 1 < argc) {
            config.hnswParams.efConstruction = std::stoull(argv[++i]);
        } else if (arg == "--efSearch" && i + 1 < argc) {
            config.hnswParams.efSearch = std::stoull(argv[++i]);
        } else if (arg == "--seed" && i + 1 < argc) {
            config.hnswParams.seed = static_cast<unsigned>(std::stoul(argv[++i]));
        } else if (arg == "--web-dir" && i + 1 < argc) {
            webDir = argv[++i];
        } else if (arg == "--ollama-url" && i + 1 < argc) {
            ollamaUrl = argv[++i];
        } else if (arg == "--embed-model" && i + 1 < argc) {
            embedModel = argv[++i];
        } else if (arg == "--chat-model" && i + 1 < argc) {
            chatModel = argv[++i];
        } else if (arg == "--rag-dim" && i + 1 < argc) {
            ragDim = std::stoull(argv[++i]);
        } else if (arg == "--allow-remote-ollama") {
            allowRemoteOllama = true;
        } else if (arg == "--cors-origin" && i + 1 < argc) {
            corsOrigin = argv[++i];
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: vectordb_server [OPTIONS]\n"
                      << "Options:\n"
                      << "  --port <PORT>               Port to listen on (default: 8080)\n"
                      << "  --host <HOST>               Host to bind to (default: 127.0.0.1)\n"
                      << "  --dim <DIM>                 Default vector dimension (default: 128)\n"
                      << "  --metric <METRIC>           Metric: cosine, euclidean, manhattan (default: cosine)\n"
                      << "  --M <M>                     HNSW max neighbours M (default: 16)\n"
                      << "  --efConstruction <EFC>      HNSW construction beam size (default: 200)\n"
                      << "  --efSearch <EFS>            HNSW search beam size (default: 50)\n"
                      << "  --seed <SEED>               PRNG seed for HNSW levels (default: 42)\n"
                      << "  --web-dir <DIR>             Static web directory to mount at '/' (default: web)\n"
                      << "  --ollama-url <URL>          Ollama base URL (default: http://127.0.0.1:11434)\n"
                      << "  --embed-model <NAME>        Ollama embedding model (default: nomic-embed-text)\n"
                      << "  --chat-model <NAME>         Ollama chat model (default: llama3.2)\n"
                      << "  --rag-dim <DIM>             Embedding dimension for RAG documents (default: 768)\n"
                      << "  --allow-remote-ollama       Allow connecting to non-loopback Ollama hosts (default: off)\n"
                      << "  --cors-origin <ORIGIN>      Allowed CORS origin header (default: disabled / same-origin only)\n"
                      << "  --help, -h                  Display this help message\n";
            return 0;
        }
    }

    Collection collection(config);

    OllamaConfig ollamaConfig;
    ollamaConfig.baseUrl = ollamaUrl;
    ollamaConfig.embedModel = embedModel;
    ollamaConfig.chatModel = chatModel;
    ollamaConfig.allowRemote = allowRemoteOllama;

    RagConfig ragConfig;
    ragConfig.dimension = ragDim;
    ragConfig.metric = Metric::Cosine;

    OllamaClient ollamaClient(ollamaConfig);
    RagPipeline ragPipeline(ragConfig, ollamaClient);

    PcaCache mainPcaCache;
    PcaCache docsPcaCache;

    httplib::Server svr;
    g_serverPtr = &svr;
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    // 4-thread pool as specified
    svr.new_task_queue = [] { return new httplib::ThreadPool(4); };

    // Request body limit 20 MB
    svr.set_payload_max_length(20 * 1024 * 1024);

    // Helper to send ApiResponse
    auto sendResponse = [](httplib::Response& res, const ApiResponse& apiRes) {
        res.status = apiRes.status;
        res.set_content(apiRes.body, apiRes.contentType);
    };

    // Pre-routing security checks: Host header, Origin header, and Content-Type validation
    bool isLoopback = (host == "127.0.0.1" || host == "localhost" || host == "::1" || host == "[::1]");
    svr.set_pre_routing_handler([port, isLoopback, corsOrigin, sendResponse](const httplib::Request& req, httplib::Response& res) {
        // 1. Host header DNS rebinding check on loopback
        if (isLoopback) {
            if (!req.has_header("Host")) {
                sendResponse(res, makeErrorResponse(403, "forbidden_host", "Missing Host header"));
                return httplib::Server::HandlerResponse::Handled;
            }
            std::string hostVal = req.get_header_value("Host");
            if (!isAllowedLoopbackHost(hostVal, port)) {
                sendResponse(res, makeErrorResponse(403, "forbidden_host", "Forbidden Host header: " + hostVal));
                return httplib::Server::HandlerResponse::Handled;
            }
        }

        // 2. Origin header check: If Origin is present, it must equal a server origin or --cors-origin
        if (req.has_header("Origin")) {
            std::string originVal = req.get_header_value("Origin");
            if (!isAllowedOrigin(originVal, port, corsOrigin)) {
                sendResponse(res, makeErrorResponse(403, "forbidden_origin", "Forbidden Origin header: " + originVal));
                return httplib::Server::HandlerResponse::Handled;
            }
        }

        // 3. Content-Type check: Every POST, and any request with a body, must have application/json
        bool isPost = (req.method == "POST");
        bool hasBody = (!req.body.empty() || (req.has_header("Content-Length") && std::stoull(req.get_header_value("Content-Length")) > 0));
        if ((isPost || hasBody) && req.method != "OPTIONS" && req.method != "GET" && req.method != "HEAD") {
            if (!req.has_header("Content-Type")) {
                sendResponse(res, makeErrorResponse(415, "unsupported_media_type", "Content-Type header must be application/json"));
                return httplib::Server::HandlerResponse::Handled;
            }
            std::string ct = req.get_header_value("Content-Type");
            std::string ctLower = ct;
            for (char& c : ctLower) {
                c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
            }
            if (ctLower.find("application/json") != 0) {
                sendResponse(res, makeErrorResponse(415, "unsupported_media_type", "Content-Type must be application/json, got " + ct));
                return httplib::Server::HandlerResponse::Handled;
            }
        }

        return httplib::Server::HandlerResponse::Unhandled;
    });

    // CORS headers: same-origin by default; enabled only if --cors-origin is provided
    if (!corsOrigin.empty()) {
        svr.set_post_routing_handler([corsOrigin](const httplib::Request&, httplib::Response& res) {
            res.set_header("Access-Control-Allow-Origin", corsOrigin);
            res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
            res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        });

        svr.Options(R"(/api/.*)", [corsOrigin](const httplib::Request&, httplib::Response& res) {
            res.set_header("Access-Control-Allow-Origin", corsOrigin);
            res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
            res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.status = 204;
        });
    }

    // -------------------------------------------------------------------------
    // Core Collection Endpoints
    // -------------------------------------------------------------------------

    // Route: GET /api/health
    svr.Get("/api/health", [&](const httplib::Request&, httplib::Response& res) {
        sendResponse(res, handleHealth());
    });

    // Route: GET /api/config
    svr.Get("/api/config", [&](const httplib::Request&, httplib::Response& res) {
        sendResponse(res, handleGetConfig(collection));
    });

    // Route: POST /api/reset
    svr.Post("/api/reset", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleReset(collection, req.body));
    });

    // Route: GET /api/stats
    svr.Get("/api/stats", [&](const httplib::Request&, httplib::Response& res) {
        sendResponse(res, handleGetStats(collection));
    });

    // Route: POST /api/vectors
    svr.Post("/api/vectors", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleInsertVector(collection, req.body));
    });

    // Route: POST /api/vectors/batch
    svr.Post("/api/vectors/batch", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleBatchInsert(collection, req.body));
    });

    // Route: GET /api/vectors/:id
    svr.Get(R"(/api/vectors/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        uint64_t id = std::stoull(req.matches[1]);
        sendResponse(res, handleGetVector(collection, static_cast<VectorId>(id)));
    });

    // Route: POST /api/search
    svr.Post("/api/search", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleSearch(collection, req.body));
    });

    // Route: POST /api/benchmark
    svr.Post("/api/benchmark", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleBenchmark(collection, req.body));
    });

    // Route: GET /api/hnsw/info
    svr.Get("/api/hnsw/info", [&](const httplib::Request&, httplib::Response& res) {
        sendResponse(res, handleHnswInfo(collection));
    });

    // Route: GET /api/hnsw/node/:id
    svr.Get(R"(/api/hnsw/node/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        uint64_t id = std::stoull(req.matches[1]);
        sendResponse(res, handleHnswNode(collection, static_cast<VectorId>(id)));
    });

    // Route: POST /api/hnsw/trace
    svr.Post("/api/hnsw/trace", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleHnswTrace(collection, req.body));
    });

    // Route: POST /api/demo/random
    svr.Post("/api/demo/random", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleDemoRandom(collection, req.body));
    });

    // Route: GET /api/pca
    svr.Get("/api/pca", [&](const httplib::Request& req, httplib::Response& res) {
        std::optional<std::size_t> limit;
        if (req.has_param("limit")) {
            try {
                limit = std::stoull(req.get_param_value("limit"));
            } catch (...) {
                sendResponse(res, makeErrorResponse(400, "validation_error", "Parameter 'limit' must be an integer"));
                return;
            }
        }
        sendResponse(res, handleGetPca(collection, mainPcaCache, limit, false));
    });

    // Route: POST /api/pca/query
    svr.Post("/api/pca/query", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handlePcaQuery(collection, mainPcaCache, req.body));
    });

    // Route: GET /api/hnsw/graph
    svr.Get("/api/hnsw/graph", [&](const httplib::Request& req, httplib::Response& res) {
        std::optional<int> layer;
        if (req.has_param("layer")) {
            try {
                layer = std::stoi(req.get_param_value("layer"));
            } catch (...) {
                sendResponse(res, makeErrorResponse(400, "validation_error", "Parameter 'layer' must be an integer"));
                return;
            }
        }
        std::optional<std::size_t> maxEdges;
        if (req.has_param("max_edges")) {
            try {
                maxEdges = std::stoull(req.get_param_value("max_edges"));
            } catch (...) {
                sendResponse(res, makeErrorResponse(400, "validation_error", "Parameter 'max_edges' must be an integer"));
                return;
            }
        }
        sendResponse(res, handleHnswGraph(collection, mainPcaCache, layer, maxEdges, false));
    });

    // -------------------------------------------------------------------------
    // RAG Pipeline Endpoints
    // -------------------------------------------------------------------------

    // Route: GET /api/ollama/status
    svr.Get("/api/ollama/status", [&](const httplib::Request&, httplib::Response& res) {
        sendResponse(res, handleOllamaStatus(ragPipeline));
    });

    // Route: POST /api/docs
    svr.Post("/api/docs", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleIngestDoc(ragPipeline, req.body));
    });

    // Route: GET /api/docs
    svr.Get("/api/docs", [&](const httplib::Request&, httplib::Response& res) {
        sendResponse(res, handleListDocs(ragPipeline));
    });

    // Route: GET /api/docs/:id
    svr.Get(R"(/api/docs/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        uint64_t id = std::stoull(req.matches[1]);
        sendResponse(res, handleGetDoc(ragPipeline, id));
    });

    // Route: POST /api/docs/search
    svr.Post("/api/docs/search", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleSearchDocs(ragPipeline, req.body));
    });

    // Route: POST /api/docs/benchmark
    svr.Post("/api/docs/benchmark", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleBenchmarkDocs(ragPipeline, req.body));
    });

    // Route: POST /api/ask
    svr.Post("/api/ask", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleAsk(ragPipeline, req.body));
    });

    // Route: POST /api/ask/stream (SSE streaming)
    svr.Post("/api/ask/stream", [&](const httplib::Request& req, httplib::Response& res) {
        json reqJson = json::parse(req.body, nullptr, false);
        if (reqJson.is_discarded() || !reqJson.is_object()) {
            sendResponse(res, makeErrorResponse(400, "invalid_json", "Malformed JSON request body"));
            return;
        }

        if (!reqJson.contains("question") || !reqJson["question"].is_string()) {
            sendResponse(res, makeErrorResponse(400, "validation_error", "Missing or invalid 'question' string field"));
            return;
        }
        std::string question = reqJson["question"].get<std::string>();
        if (question.empty() || question.size() > 2000) {
            sendResponse(res, makeErrorResponse(400, "validation_error", "Parameter 'question' must be between 1 and 2000 characters"));
            return;
        }

        std::size_t k = 4;
        if (reqJson.contains("k")) {
            if (!reqJson["k"].is_number_integer() || reqJson["k"].get<long long>() < 1 || reqJson["k"].get<long long>() > 20) {
                sendResponse(res, makeErrorResponse(400, "validation_error", "'k' must be between 1 and 20"));
                return;
            }
            k = static_cast<std::size_t>(reqJson["k"].get<long long>());
        }

        Algorithm algo = Algorithm::Hnsw;
        if (reqJson.contains("algorithm")) {
            if (!reqJson["algorithm"].is_string()) {
                sendResponse(res, makeErrorResponse(400, "validation_error", "'algorithm' must be a string"));
                return;
            }
            try {
                algo = stringToAlgorithm(reqJson["algorithm"].get<std::string>());
            } catch (const std::invalid_argument& e) {
                sendResponse(res, makeErrorResponse(400, "validation_error", e.what()));
                return;
            }
        }

        std::optional<std::size_t> efOpt = std::nullopt;
        if (reqJson.contains("ef")) {
            if (!reqJson["ef"].is_number_integer() || reqJson["ef"].get<long long>() <= 0) {
                sendResponse(res, makeErrorResponse(400, "validation_error", "'ef' must be a positive integer"));
                return;
            }
            efOpt = static_cast<std::size_t>(reqJson["ef"].get<long long>());
        }

        ChatOptions chatOpt;
        if (reqJson.contains("model") && reqJson["model"].is_string()) {
            chatOpt.model = reqJson["model"].get<std::string>();
        }
        if (reqJson.contains("temperature") && reqJson["temperature"].is_number()) {
            chatOpt.temperature = reqJson["temperature"].get<double>();
            if (chatOpt.temperature < 0.0) {
                sendResponse(res, makeErrorResponse(400, "validation_error", "'temperature' must be non-negative"));
                return;
            }
        }
        if (reqJson.contains("seed") && reqJson["seed"].is_number_integer()) {
            chatOpt.seed = reqJson["seed"].get<int>();
        }

        bool debug = false;
        if (reqJson.contains("debug") && reqJson["debug"].is_boolean()) {
            debug = reqJson["debug"].get<bool>();
        }

        // Pre-stream reachability check if index is not empty
        if (ragPipeline.collection().stats().count > 0) {
            auto st = ragPipeline.ollama().status();
            if (!st.reachable) {
                sendResponse(res, makeErrorResponse(503, "ollama_unavailable", "Cannot connect to Ollama: " + st.error));
                return;
            }
            if (!st.embedModelPresent || !st.chatModelPresent) {
                sendResponse(res, makeErrorResponse(502, "ollama_error", "Required Ollama model not found: " + st.error));
                return;
            }
        }

        res.set_header("Cache-Control", "no-cache");
        res.set_header("Connection", "keep-alive");

        res.set_chunked_content_provider(
            "text/event-stream; charset=utf-8",
            [&ragPipeline, question, k, algo, efOpt, chatOpt, debug](size_t /*offset*/, httplib::DataSink& sink) -> bool {
                bool sourcesSent = false;
                try {
                    auto onSources = [&](const std::vector<RagSource>& sources) {
                        json sDoc;
                        json sArr = json::array();
                        for (const auto& s : sources) {
                            json item;
                            item["n"] = s.n;
                            item["doc_id"] = s.docId;
                            item["title"] = s.title;
                            item["chunk_index"] = s.chunkIndex;
                            item["text"] = s.text;
                            item["distance"] = s.distance;
                            item["similarity"] = s.similarity;
                            sArr.push_back(std::move(item));
                        }
                        sDoc["sources"] = std::move(sArr);
                        std::string sseData = formatSseEvent("sources", sDoc.dump());
                        sink.write(sseData.data(), sseData.size());
                        sourcesSent = true;
                    };

                    auto onToken = [&](const std::string& tokenPiece) -> bool {
                        json tDoc;
                        tDoc["t"] = tokenPiece;
                        tDoc["token"] = tokenPiece;
                        std::string sseData = formatSseEvent("token", tDoc.dump());
                        return sink.write(sseData.data(), sseData.size());
                    };

                    AskResult askRes = ragPipeline.ask(question, k, algo, efOpt, chatOpt, debug, onToken, onSources);

                    json dDoc;
                    dDoc["answer"] = askRes.answer;
                    dDoc["model"] = askRes.model;
                    dDoc["timings"] = {
                        {"embed_ms", askRes.timings.embedMs},
                        {"search_ms", askRes.timings.searchMs},
                        {"generate_ms", askRes.timings.generateMs},
                        {"total_ms", askRes.timings.totalMs}
                    };
                    dDoc["prompt_chars"] = askRes.promptChars;
                    if (debug) {
                        dDoc["prompt"] = askRes.prompt;
                    }
                    std::string sseDone = formatSseEvent("done", dDoc.dump());
                    sink.write(sseDone.data(), sseDone.size());
                } catch (const std::exception& e) {
                    if (sourcesSent) {
                        json errDoc;
                        errDoc["error"]["code"] = "streaming_error";
                        errDoc["error"]["message"] = e.what();
                        std::string sseErr = formatSseEvent("error", errDoc.dump());
                        sink.write(sseErr.data(), sseErr.size());
                    }
                }

                sink.done();
                return false;
            }
        );
    });

    // Route: POST /api/docs/reset
    svr.Post("/api/docs/reset", [&](const httplib::Request&, httplib::Response& res) {
        sendResponse(res, handleResetDocs(ragPipeline));
    });

    // Route: GET /api/docs/pca
    svr.Get("/api/docs/pca", [&](const httplib::Request& req, httplib::Response& res) {
        std::optional<std::size_t> limit;
        if (req.has_param("limit")) {
            try {
                limit = std::stoull(req.get_param_value("limit"));
            } catch (...) {
                sendResponse(res, makeErrorResponse(400, "validation_error", "Parameter 'limit' must be an integer"));
                return;
            }
        }
        sendResponse(res, handleGetPca(ragPipeline.collection(), docsPcaCache, limit, true));
    });

    // Route: POST /api/docs/pca/query
    svr.Post("/api/docs/pca/query", [&](const httplib::Request& req, httplib::Response& res) {
        sendResponse(res, handleDocsPcaQuery(ragPipeline, docsPcaCache, req.body));
    });

    // Route: GET /api/docs/hnsw/graph
    svr.Get("/api/docs/hnsw/graph", [&](const httplib::Request& req, httplib::Response& res) {
        std::optional<int> layer;
        if (req.has_param("layer")) {
            try {
                layer = std::stoi(req.get_param_value("layer"));
            } catch (...) {
                sendResponse(res, makeErrorResponse(400, "validation_error", "Parameter 'layer' must be an integer"));
                return;
            }
        }
        std::optional<std::size_t> maxEdges;
        if (req.has_param("max_edges")) {
            try {
                maxEdges = std::stoull(req.get_param_value("max_edges"));
            } catch (...) {
                sendResponse(res, makeErrorResponse(400, "validation_error", "Parameter 'max_edges' must be an integer"));
                return;
            }
        }
        sendResponse(res, handleHnswGraph(ragPipeline.collection(), docsPcaCache, layer, maxEdges, true));
    });

    // Serve static files from webDir
    if (std::filesystem::exists(webDir)) {
        svr.set_mount_point("/", webDir);
    }

    // Check Ollama status at startup
    auto ollamaStatus = ragPipeline.ollama().status();

    // Startup banner
    std::cout << "=========================================================================================\n";
    std::cout << "   VectorDB REST API Server (v0.4.0 with Offline RAG)\n";
    std::cout << "=========================================================================================\n";
    std::cout << "  Status           : Listening\n";
    std::cout << "  Host             : " << host << "\n";
    std::cout << "  Port             : " << port << "\n";
    std::cout << "  URL              : http://" << host << ":" << port << "/\n";
    std::cout << "  Demo Dim         : " << config.dimension << "\n";
    std::cout << "  Demo Metric      : " << metricToString(config.metric) << "\n";
    std::cout << "  HNSW Parameters  : M = " << config.hnswParams.M
              << ", efConstruction = " << config.hnswParams.efConstruction
              << ", efSearch = " << config.hnswParams.efSearch
              << ", seed = " << config.hnswParams.seed << "\n";
    std::cout << "  Ollama URL       : " << ollamaUrl << "\n";
    std::cout << "  Embed Model      : " << embedModel << " (RAG dim = " << ragDim << ")\n";
    std::cout << "  Chat Model       : " << chatModel << "\n";
    std::cout << "  Remote Ollama    : " << (allowRemoteOllama ? "Allowed" : "Off (loopback only)") << "\n";
    std::cout << "  Static Web Dir   : " << webDir << (std::filesystem::exists(webDir) ? " (Mounted)" : " (Not found)") << "\n";
    std::cout << "  Press Ctrl+C to shut down cleanly.\n";
    std::cout << "=========================================================================================\n";

    if (!ollamaStatus.reachable) {
        std::cout << "  [WARNING] Ollama is not reachable at " << ollamaUrl
                  << ". RAG endpoints will return 503 until Ollama is started.\n";
    } else {
        if (!ollamaStatus.embedModelPresent) {
            std::cout << "  [WARNING] Embedding model '" << embedModel
                      << "' is not installed in Ollama. (hint: run: ollama pull " << embedModel << ")\n";
        }
        if (!ollamaStatus.chatModelPresent) {
            std::cout << "  [WARNING] Chat model '" << chatModel
                      << "' is not installed in Ollama. (hint: run: ollama pull " << chatModel << ")\n";
        }
    }
    std::cout << "\n";

    if (!svr.listen(host, port)) {
        std::cerr << "Failed to bind and listen on " << host << ":" << port << "\n";
        return 1;
    }

    return 0;
}
