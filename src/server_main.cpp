#include "vectordb/collection.hpp"
#include "vectordb/api.hpp"
#include "vectordb/rag.hpp"

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#endif

#include "httplib.h"

#include <iostream>
#include <string>
#include <filesystem>
#include <csignal>
#include <atomic>

using namespace vectordb;

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

    httplib::Server svr;
    g_serverPtr = &svr;
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    // 4-thread pool as specified
    svr.new_task_queue = [] { return new httplib::ThreadPool(4); };

    // Request body limit 20 MB
    svr.set_payload_max_length(20 * 1024 * 1024);

    // Global CORS headers
    svr.set_post_routing_handler([](const httplib::Request&, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    });

    // OPTIONS preflight handler
    svr.Options(R"(/api/.*)", [](const httplib::Request&, httplib::Response& res) {
        res.status = 204;
    });

    // Helper to send ApiResponse
    auto sendResponse = [](httplib::Response& res, const ApiResponse& apiRes) {
        res.status = apiRes.status;
        res.set_content(apiRes.body, apiRes.contentType);
    };

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

    // Route: POST /api/docs/reset
    svr.Post("/api/docs/reset", [&](const httplib::Request&, httplib::Response& res) {
        sendResponse(res, handleResetDocs(ragPipeline));
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
