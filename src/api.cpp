#include "vectordb/api.hpp"
#include "vectordb/dataset.hpp"
#include "nlohmann/json.hpp"

#include <chrono>
#include <unordered_set>
#include <sstream>

namespace vectordb {

using json = nlohmann::json;

ApiResponse makeErrorResponse(int status, const std::string& code, const std::string& message) {
    json doc;
    doc["error"]["code"] = code;
    doc["error"]["message"] = message;
    return {status, doc.dump()};
}

static ApiResponse makeBatchErrorResponse(int status, const std::string& code, const std::string& message, std::size_t index) {
    json doc;
    doc["error"]["code"] = code;
    doc["error"]["message"] = message;
    doc["error"]["index"] = index;
    return {status, doc.dump()};
}

static json parseMetadata(const std::string& metaStr) {
    if (metaStr.empty()) {
        return nullptr;
    }
    json parsed = json::parse(metaStr, nullptr, false);
    if (parsed.is_discarded()) {
        return metaStr;
    }
    return parsed;
}

ApiResponse handleHealth() {
    json doc;
    doc["status"] = "ok";
    doc["version"] = "0.4.0";
    return {200, doc.dump()};
}

ApiResponse handleGetConfig(const Collection& collection) {
    try {
        CollectionConfig cfg = collection.getConfig();
        json doc;
        doc["dimension"] = cfg.dimension;
        doc["metric"] = metricToString(cfg.metric);
        doc["hnsw"]["M"] = cfg.hnswParams.M;
        doc["hnsw"]["efConstruction"] = cfg.hnswParams.efConstruction;
        doc["hnsw"]["efSearch"] = cfg.hnswParams.efSearch;
        doc["hnsw"]["seed"] = cfg.hnswParams.seed;
        doc["hnsw"]["useHeuristic"] = cfg.hnswParams.useHeuristic;
        doc["leafSize"] = cfg.leafSize;
        return {200, doc.dump()};
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleReset(Collection& collection, const std::string& body) {
    try {
        CollectionConfig cfg = collection.getConfig();

        if (!body.empty()) {
            json req = json::parse(body, nullptr, false);
            if (req.is_discarded() || !req.is_object()) {
                return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
            }

            if (req.contains("dimension")) {
                if (!req["dimension"].is_number_unsigned() || req["dimension"] == 0) {
                    return makeErrorResponse(400, "validation_error", "Dimension must be a positive integer");
                }
                cfg.dimension = req["dimension"].get<std::size_t>();
            }

            if (req.contains("metric")) {
                if (!req["metric"].is_string()) {
                    return makeErrorResponse(400, "validation_error", "Metric must be a string");
                }
                cfg.metric = metricFromString(req["metric"].get<std::string>());
            }

            if (req.contains("leafSize")) {
                if (!req["leafSize"].is_number_unsigned() || req["leafSize"] == 0) {
                    return makeErrorResponse(400, "validation_error", "leafSize must be a positive integer");
                }
                cfg.leafSize = req["leafSize"].get<std::size_t>();
            }

            if (req.contains("hnsw") && req["hnsw"].is_object()) {
                const auto& h = req["hnsw"];
                if (h.contains("M")) {
                    if (!h["M"].is_number_unsigned() || h["M"] < 2) {
                        return makeErrorResponse(400, "validation_error", "HNSW M must be >= 2");
                    }
                    cfg.hnswParams.M = h["M"].get<std::size_t>();
                }
                if (h.contains("efConstruction")) {
                    if (!h["efConstruction"].is_number_unsigned() || h["efConstruction"] < cfg.hnswParams.M) {
                        return makeErrorResponse(400, "validation_error", "efConstruction must be >= M");
                    }
                    cfg.hnswParams.efConstruction = h["efConstruction"].get<std::size_t>();
                }
                if (h.contains("efSearch")) {
                    if (!h["efSearch"].is_number_unsigned() || h["efSearch"] == 0) {
                        return makeErrorResponse(400, "validation_error", "efSearch must be > 0");
                    }
                    cfg.hnswParams.efSearch = h["efSearch"].get<std::size_t>();
                }
                if (h.contains("seed")) {
                    if (!h["seed"].is_number_unsigned()) {
                        return makeErrorResponse(400, "validation_error", "seed must be an unsigned integer");
                    }
                    cfg.hnswParams.seed = h["seed"].get<unsigned>();
                }
                if (h.contains("useHeuristic")) {
                    if (!h["useHeuristic"].is_boolean()) {
                        return makeErrorResponse(400, "validation_error", "useHeuristic must be a boolean");
                    }
                    cfg.hnswParams.useHeuristic = h["useHeuristic"].get<bool>();
                }
            }
        }

        collection.reset(cfg);
        return handleGetConfig(collection);
    } catch (const std::invalid_argument& e) {
        return makeErrorResponse(400, "validation_error", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleGetStats(const Collection& collection) {
    try {
        CollectionStats st = collection.stats();
        json doc;
        doc["count"] = st.count;
        doc["dimension"] = st.dimension;
        doc["metric"] = metricToString(st.metric);
        return {200, doc.dump()};
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleInsertVector(Collection& collection, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("vector") || !req["vector"].is_array()) {
            return makeErrorResponse(400, "invalid_request", "Missing or invalid 'vector' array field");
        }

        std::vector<float> vec;
        vec.reserve(req["vector"].size());
        for (const auto& item : req["vector"]) {
            if (!item.is_number()) {
                return makeErrorResponse(400, "validation_error", "Vector components must be numeric");
            }
            vec.push_back(item.get<float>());
        }

        std::optional<VectorId> idOpt = std::nullopt;
        if (req.contains("id")) {
            if (!req["id"].is_number_unsigned()) {
                return makeErrorResponse(400, "invalid_id", "Field 'id' must be an unsigned integer");
            }
            uint64_t rawId = req["id"].get<uint64_t>();
            if (rawId == 0) {
                return makeErrorResponse(400, "invalid_id", "Field 'id' must be non-zero");
            }
            if (rawId > Collection::MAX_SAFE_INTEGER) {
                return makeErrorResponse(400, "invalid_id", "Field 'id' exceeds maximum safe JSON integer (2^53 - 1)");
            }
            idOpt = static_cast<VectorId>(rawId);
        }

        std::string metaStr;
        if (req.contains("metadata")) {
            if (req["metadata"].is_string()) {
                metaStr = req["metadata"].get<std::string>();
            } else {
                metaStr = req["metadata"].dump();
            }
        }

        VectorId assignedId = collection.insert(idOpt, vec, metaStr);

        json doc;
        doc["id"] = assignedId;
        return {201, doc.dump()};
    } catch (const std::invalid_argument& e) {
        std::string msg = e.what();
        if (msg.find("Duplicate vector ID") != std::string::npos) {
            return makeErrorResponse(400, "duplicate_id", msg);
        }
        return makeErrorResponse(400, "validation_error", msg);
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleBatchInsert(Collection& collection, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("items") || !req["items"].is_array()) {
            return makeErrorResponse(400, "invalid_request", "Missing or invalid 'items' array field");
        }

        const auto& items = req["items"];
        if (items.empty()) {
            json doc;
            doc["inserted"] = 0;
            doc["ids"] = json::array();
            return {201, doc.dump()};
        }

        std::size_t dim = collection.getConfig().dimension;

        // Structured representation for validated items
        struct PreparedItem {
            std::optional<VectorId> id;
            std::vector<float> vec;
            std::string metadata;
        };

        std::vector<PreparedItem> prepared;
        prepared.reserve(items.size());
        std::unordered_set<VectorId> batchIds;

        // Pass 1: Strict all-or-nothing validation
        for (std::size_t idx = 0; idx < items.size(); ++idx) {
            const auto& item = items[idx];
            if (!item.is_object()) {
                return makeBatchErrorResponse(400, "validation_error", "Item at index " + std::to_string(idx) + " is not an object", idx);
            }

            if (!item.contains("vector") || !item["vector"].is_array()) {
                return makeBatchErrorResponse(400, "validation_error", "Item at index " + std::to_string(idx) + " is missing 'vector' array", idx);
            }

            const auto& vecJson = item["vector"];
            if (vecJson.size() != dim) {
                return makeBatchErrorResponse(
                    400, "validation_error",
                    "Item at index " + std::to_string(idx) + " dimension mismatch: expected " +
                    std::to_string(dim) + ", got " + std::to_string(vecJson.size()),
                    idx
                );
            }

            std::vector<float> vec;
            vec.reserve(dim);
            for (const auto& val : vecJson) {
                if (!val.is_number()) {
                    return makeBatchErrorResponse(400, "validation_error", "Item at index " + std::to_string(idx) + " contains non-numeric value", idx);
                }
                float f = val.get<float>();
                if (std::isnan(f) || std::isinf(f)) {
                    return makeBatchErrorResponse(400, "validation_error", "Item at index " + std::to_string(idx) + " contains NaN or Inf", idx);
                }
                vec.push_back(f);
            }

            std::optional<VectorId> idOpt = std::nullopt;
            if (item.contains("id")) {
                if (!item["id"].is_number_unsigned()) {
                    return makeBatchErrorResponse(400, "invalid_id", "Item at index " + std::to_string(idx) + " has invalid id", idx);
                }
                uint64_t rawId = item["id"].get<uint64_t>();
                if (rawId == 0 || rawId > Collection::MAX_SAFE_INTEGER) {
                    return makeBatchErrorResponse(400, "invalid_id", "Item at index " + std::to_string(idx) + " id out of safe range", idx);
                }
                VectorId vid = static_cast<VectorId>(rawId);
                if (batchIds.find(vid) != batchIds.end() || collection.contains(vid)) {
                    return makeBatchErrorResponse(400, "duplicate_id", "Duplicate vector ID " + std::to_string(vid) + " at index " + std::to_string(idx), idx);
                }
                batchIds.insert(vid);
                idOpt = vid;
            }

            std::string metaStr;
            if (item.contains("metadata")) {
                if (item["metadata"].is_string()) {
                    metaStr = item["metadata"].get<std::string>();
                } else {
                    metaStr = item["metadata"].dump();
                }
            }

            prepared.push_back({idOpt, std::move(vec), std::move(metaStr)});
        }

        // Pass 2: Insertion
        json idsArr = json::array();
        for (auto& p : prepared) {
            VectorId vid = collection.insert(p.id, p.vec, p.metadata);
            idsArr.push_back(vid);
        }

        json doc;
        doc["inserted"] = prepared.size();
        doc["ids"] = idsArr;
        return {201, doc.dump()};
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleGetVector(const Collection& collection, VectorId id) {
    try {
        if (!collection.contains(id)) {
            return makeErrorResponse(404, "not_found", "Vector ID " + std::to_string(id) + " not found");
        }

        std::vector<float> vec = collection.getVector(id);
        std::string metaStr = collection.getMetadata(id);

        json doc;
        doc["id"] = id;
        doc["vector"] = vec;
        doc["metadata"] = parseMetadata(metaStr);
        return {200, doc.dump()};
    } catch (const std::out_of_range& e) {
        return makeErrorResponse(404, "not_found", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleSearch(Collection& collection, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("vector") || !req["vector"].is_array()) {
            return makeErrorResponse(400, "invalid_request", "Missing or invalid 'vector' array field");
        }

        std::vector<float> vec;
        vec.reserve(req["vector"].size());
        for (const auto& item : req["vector"]) {
            if (!item.is_number()) {
                return makeErrorResponse(400, "validation_error", "Vector components must be numeric");
            }
            vec.push_back(item.get<float>());
        }

        std::size_t k = 10;
        if (req.contains("k")) {
            if (!req["k"].is_number_unsigned()) {
                return makeErrorResponse(400, "validation_error", "Parameter 'k' must be a positive integer");
            }
            k = req["k"].get<std::size_t>();
        }

        Algorithm alg = Algorithm::Hnsw;
        if (req.contains("algorithm")) {
            if (!req["algorithm"].is_string()) {
                return makeErrorResponse(400, "validation_error", "Parameter 'algorithm' must be a string");
            }
            alg = stringToAlgorithm(req["algorithm"].get<std::string>());
        }

        std::optional<std::size_t> efOpt = std::nullopt;
        if (req.contains("ef")) {
            if (!req["ef"].is_number_unsigned() || req["ef"] == 0) {
                return makeErrorResponse(400, "validation_error", "Parameter 'ef' must be a positive integer");
            }
            efOpt = req["ef"].get<std::size_t>();
        }

        auto t0 = std::chrono::steady_clock::now();
        std::vector<SearchResult> results = collection.search(alg, vec, k, efOpt);
        auto t1 = std::chrono::steady_clock::now();
        long long latUs = std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count();

        json doc;
        doc["algorithm"] = algorithmToString(alg);
        doc["k"] = k;
        doc["latency_us"] = latUs;

        json resArr = json::array();
        for (const auto& r : results) {
            json item;
            item["id"] = r.id;
            item["distance"] = r.distance;
            std::string meta = collection.contains(r.id) ? collection.getMetadata(r.id) : "";
            item["metadata"] = parseMetadata(meta);
            resArr.push_back(item);
        }
        doc["results"] = resArr;

        return {200, doc.dump()};
    } catch (const std::invalid_argument& e) {
        return makeErrorResponse(400, "validation_error", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleBenchmark(Collection& collection, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("vector") || !req["vector"].is_array()) {
            return makeErrorResponse(400, "invalid_request", "Missing or invalid 'vector' array field");
        }

        std::vector<float> vec;
        vec.reserve(req["vector"].size());
        for (const auto& item : req["vector"]) {
            if (!item.is_number()) {
                return makeErrorResponse(400, "validation_error", "Vector components must be numeric");
            }
            vec.push_back(item.get<float>());
        }

        std::size_t k = 10;
        if (req.contains("k")) {
            if (!req["k"].is_number_unsigned()) {
                return makeErrorResponse(400, "validation_error", "Parameter 'k' must be a positive integer");
            }
            k = req["k"].get<std::size_t>();
        }

        std::optional<std::size_t> efOpt = std::nullopt;
        if (req.contains("ef")) {
            if (!req["ef"].is_number_unsigned() || req["ef"] == 0) {
                return makeErrorResponse(400, "validation_error", "Parameter 'ef' must be a positive integer");
            }
            efOpt = req["ef"].get<std::size_t>();
        }

        BenchmarkReport rep = collection.benchmarkAll(vec, k, efOpt);

        auto formatAlg = [&](const AlgorithmBenchmarkResult& r) {
            json a;
            a["latency_us"] = r.latencyUs;
            a["distance_computations"] = r.distanceComputations;
            a["recall_at_k"] = r.recallAtK;
            json resArr = json::array();
            for (const auto& sr : r.results) {
                json item;
                item["id"] = sr.id;
                item["distance"] = sr.distance;
                std::string meta = collection.contains(sr.id) ? collection.getMetadata(sr.id) : "";
                item["metadata"] = parseMetadata(meta);
                resArr.push_back(item);
            }
            a["results"] = resArr;
            return a;
        };

        json doc;
        doc["k"] = rep.k;
        doc["count"] = rep.count;
        doc["ground_truth"] = rep.groundTruth;
        doc["algorithms"]["brute"] = formatAlg(rep.brute);
        doc["algorithms"]["kdtree"] = formatAlg(rep.kdtree);
        doc["algorithms"]["hnsw"] = formatAlg(rep.hnsw);

        return {200, doc.dump()};
    } catch (const std::invalid_argument& e) {
        return makeErrorResponse(400, "validation_error", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleHnswInfo(const Collection& collection) {
    try {
        HnswGraphInfo info = collection.hnswInfo();
        json doc;
        doc["numNodes"] = info.numNodes;
        doc["maxLevel"] = info.maxLevel;
        doc["entryPointId"] = info.entryPointId;
        doc["nodesPerLayer"] = info.nodesPerLayer;
        doc["avgDegreePerLayer"] = info.avgDegreePerLayer;
        doc["maxDegreePerLayer"] = info.maxDegreePerLayer;
        return {200, doc.dump()};
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleHnswNode(const Collection& collection, VectorId id) {
    try {
        if (!collection.contains(id)) {
            return makeErrorResponse(404, "not_found", "Vector ID " + std::to_string(id) + " not found");
        }

        HnswNodeInfo info = collection.hnswNode(id);
        json doc;
        doc["id"] = info.id;
        doc["level"] = info.level;

        json neighborsMap = json::object();
        for (const auto& pair : info.neighbors) {
            neighborsMap[std::to_string(pair.first)] = pair.second;
        }
        doc["neighbors"] = neighborsMap;

        return {200, doc.dump()};
    } catch (const std::out_of_range& e) {
        return makeErrorResponse(404, "not_found", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleHnswTrace(Collection& collection, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("vector") || !req["vector"].is_array()) {
            return makeErrorResponse(400, "invalid_request", "Missing or invalid 'vector' array field");
        }

        std::vector<float> vec;
        vec.reserve(req["vector"].size());
        for (const auto& item : req["vector"]) {
            if (!item.is_number()) {
                return makeErrorResponse(400, "validation_error", "Vector components must be numeric");
            }
            vec.push_back(item.get<float>());
        }

        std::size_t k = 10;
        if (req.contains("k")) {
            if (!req["k"].is_number_unsigned()) {
                return makeErrorResponse(400, "validation_error", "Parameter 'k' must be a positive integer");
            }
            k = req["k"].get<std::size_t>();
        }

        std::optional<std::size_t> efOpt = std::nullopt;
        if (req.contains("ef")) {
            if (!req["ef"].is_number_unsigned() || req["ef"] == 0) {
                return makeErrorResponse(400, "validation_error", "Parameter 'ef' must be a positive integer");
            }
            efOpt = req["ef"].get<std::size_t>();
        }

        HnswTraceResult res = collection.hnswTrace(vec, k, efOpt);

        json doc;
        json resArr = json::array();
        for (const auto& sr : res.results) {
            json item;
            item["id"] = sr.id;
            item["distance"] = sr.distance;
            std::string meta = collection.contains(sr.id) ? collection.getMetadata(sr.id) : "";
            item["metadata"] = parseMetadata(meta);
            resArr.push_back(item);
        }
        doc["results"] = resArr;

        doc["stats"]["distanceComputations"] = res.stats.distanceComputations;
        doc["stats"]["nodesVisited"] = res.stats.nodesVisited;
        doc["stats"]["visitedPerLayer"] = res.stats.visitedPerLayer;

        json traceArr = json::array();
        for (const auto& step : res.trace) {
            json s;
            s["layer"] = step.layer;
            s["id"] = step.id;
            s["distance"] = step.distance;
            traceArr.push_back(s);
        }
        doc["trace"] = traceArr;

        return {200, doc.dump()};
    } catch (const std::invalid_argument& e) {
        return makeErrorResponse(400, "validation_error", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleDemoRandom(Collection& collection, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("n") || !req["n"].is_number_integer()) {
            return makeErrorResponse(400, "invalid_request", "Missing or invalid 'n' field");
        }

        long long nVal = req["n"].get<long long>();
        if (nVal <= 0 || nVal > 100000) {
            return makeErrorResponse(400, "invalid_request", "Parameter 'n' must be between 1 and 100000");
        }
        std::size_t n = static_cast<std::size_t>(nVal);

        unsigned seed = 42;
        if (req.contains("seed")) {
            if (!req["seed"].is_number_unsigned()) {
                return makeErrorResponse(400, "invalid_request", "Parameter 'seed' must be an unsigned integer");
            }
            seed = req["seed"].get<unsigned>();
        }

        std::size_t dim = collection.getConfig().dimension;
        const auto dataset = randomVectors(n, dim, seed);

        for (std::size_t i = 0; i < n; ++i) {
            collection.insert(std::nullopt, dataset[i], "");
        }

        json doc;
        doc["inserted"] = n;
        return {200, doc.dump()};
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

// -----------------------------------------------------------------------------
// RAG Pipeline Handlers
// -----------------------------------------------------------------------------

ApiResponse handleOllamaStatus(const RagPipeline& rag) {
    auto st = rag.ollama().status();
    json doc;
    doc["reachable"] = st.reachable;
    doc["version"] = st.version;
    doc["models"] = st.models;
    doc["embed_model_present"] = st.embedModelPresent;
    doc["chat_model_present"] = st.chatModelPresent;
    doc["error"] = st.error;
    return {200, doc.dump()};
}

ApiResponse handleIngestDoc(RagPipeline& rag, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("title") || !req["title"].is_string()) {
            return makeErrorResponse(400, "validation_error", "Missing or invalid 'title' string field");
        }
        std::string title = req["title"].get<std::string>();

        if (!req.contains("text") || !req["text"].is_string()) {
            return makeErrorResponse(400, "validation_error", "Missing or invalid 'text' string field");
        }
        std::string text = req["text"].get<std::string>();

        if (text.size() > rag.config().maxDocBytes) {
            return makeErrorResponse(413, "payload_too_large",
                                     "Document exceeds maximum allowed size (" +
                                     std::to_string(rag.config().maxDocBytes) + " bytes)");
        }

        ChunkOptions opt;
        if (req.contains("chunking") && req["chunking"].is_object()) {
            const auto& chObj = req["chunking"];
            if (chObj.contains("strategy") && chObj["strategy"].is_string()) {
                std::string sStr = chObj["strategy"].get<std::string>();
                try {
                    opt.strategy = chunkStrategyFromString(sStr);
                } catch (const std::invalid_argument& e) {
                    return makeErrorResponse(400, "validation_error", e.what());
                }
            }
            if (chObj.contains("max_chars")) {
                if (!chObj["max_chars"].is_number_unsigned()) {
                    return makeErrorResponse(400, "validation_error", "'max_chars' must be a positive integer");
                }
                opt.maxChars = chObj["max_chars"].get<std::size_t>();
            }
            if (chObj.contains("overlap_chars")) {
                if (!chObj["overlap_chars"].is_number_unsigned()) {
                    return makeErrorResponse(400, "validation_error", "'overlap_chars' must be a non-negative integer");
                }
                opt.overlapChars = chObj["overlap_chars"].get<std::size_t>();
            }
        }

        auto res = rag.ingest(title, text, opt);

        json doc;
        doc["doc_id"] = res.docId;
        doc["chunks"] = res.chunkCount;
        doc["dimension"] = res.dimension;
        doc["embed_ms"] = res.embedMs;

        return {201, doc.dump()};
    } catch (const OllamaUnavailable& e) {
        return makeErrorResponse(503, "ollama_unavailable", e.what());
    } catch (const OllamaError& e) {
        return makeErrorResponse(502, "ollama_error", e.what());
    } catch (const std::length_error& e) {
        return makeErrorResponse(413, "payload_too_large", e.what());
    } catch (const std::invalid_argument& e) {
        return makeErrorResponse(400, "validation_error", e.what());
    } catch (const std::exception& e) {
        std::string msg = e.what();
        if (msg.find("embedding_dimension_mismatch") != std::string::npos) {
            return makeErrorResponse(400, "validation_error", msg);
        }
        return makeErrorResponse(500, "internal_error", msg);
    }
}

ApiResponse handleListDocs(const RagPipeline& rag) {
    try {
        auto docs = rag.listDocuments();
        json docArr = json::array();
        for (const auto& d : docs) {
            json item;
            item["id"] = d.id;
            item["title"] = d.title;
            item["bytes"] = d.byteLength;
            item["chunks"] = d.chunkCount;
            item["strategy"] = chunkStrategyToString(d.strategy);
            item["created_at"] = d.createdAt;
            docArr.push_back(std::move(item));
        }

        json resp;
        resp["documents"] = std::move(docArr);
        return {200, resp.dump()};
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleGetDoc(const RagPipeline& rag, uint64_t id) {
    try {
        auto docOpt = rag.getDocument(id);
        if (!docOpt.has_value()) {
            return makeErrorResponse(404, "not_found", "Document with ID " + std::to_string(id) + " not found");
        }

        const auto& d = *docOpt;
        json resp;
        resp["id"] = d.id;
        resp["title"] = d.title;
        resp["bytes"] = d.byteLength;
        resp["chunks_count"] = d.chunkCount;
        resp["strategy"] = chunkStrategyToString(d.strategy);
        resp["created_at"] = d.createdAt;

        json chunksArr = json::array();
        for (const auto& ch : d.chunks) {
            json cItem;
            cItem["index"] = ch.index;
            cItem["start"] = ch.startByte;
            cItem["end"] = ch.endByte;
            cItem["text"] = ch.text;
            chunksArr.push_back(std::move(cItem));
        }
        resp["chunks"] = std::move(chunksArr);

        return {200, resp.dump()};
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleSearchDocs(RagPipeline& rag, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("query") || !req["query"].is_string()) {
            return makeErrorResponse(400, "validation_error", "Missing or invalid 'query' string field");
        }
        std::string query = req["query"].get<std::string>();
        if (query.empty()) {
            return makeErrorResponse(400, "validation_error", "Query must not be empty");
        }

        std::size_t k = 5;
        if (req.contains("k")) {
            if (!req["k"].is_number_integer() || req["k"].get<long long>() <= 0) {
                return makeErrorResponse(400, "validation_error", "'k' must be a positive integer");
            }
            k = static_cast<std::size_t>(req["k"].get<long long>());
        }

        Algorithm algo = Algorithm::Hnsw;
        if (req.contains("algorithm")) {
            if (!req["algorithm"].is_string()) {
                return makeErrorResponse(400, "validation_error", "'algorithm' must be a string");
            }
            try {
                algo = stringToAlgorithm(req["algorithm"].get<std::string>());
            } catch (const std::invalid_argument& e) {
                return makeErrorResponse(400, "validation_error", e.what());
            }
        }

        std::optional<std::size_t> efOpt = std::nullopt;
        if (req.contains("ef")) {
            if (!req["ef"].is_number_integer() || req["ef"].get<long long>() <= 0) {
                return makeErrorResponse(400, "validation_error", "'ef' must be a positive integer");
            }
            efOpt = static_cast<std::size_t>(req["ef"].get<long long>());
        }

        auto results = rag.retrieve(query, k, algo, efOpt);

        json resArr = json::array();
        for (const auto& r : results) {
            json item;
            item["doc_id"] = r.docId;
            item["title"] = r.title;
            item["chunk_index"] = r.chunkIndex;
            item["start"] = r.startByte;
            item["end"] = r.endByte;
            item["text"] = r.text;
            item["distance"] = r.distance;
            item["similarity"] = r.similarity;
            resArr.push_back(std::move(item));
        }

        json resp;
        resp["query"] = query;
        resp["count"] = resArr.size();
        resp["results"] = std::move(resArr);

        return {200, resp.dump()};
    } catch (const OllamaUnavailable& e) {
        return makeErrorResponse(503, "ollama_unavailable", e.what());
    } catch (const OllamaError& e) {
        return makeErrorResponse(502, "ollama_error", e.what());
    } catch (const std::invalid_argument& e) {
        return makeErrorResponse(400, "validation_error", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleBenchmarkDocs(RagPipeline& rag, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("query") || !req["query"].is_string()) {
            return makeErrorResponse(400, "validation_error", "Missing or invalid 'query' string field");
        }
        std::string query = req["query"].get<std::string>();
        if (query.empty()) {
            return makeErrorResponse(400, "validation_error", "Query must not be empty");
        }

        std::size_t k = 5;
        if (req.contains("k")) {
            if (!req["k"].is_number_integer() || req["k"].get<long long>() <= 0) {
                return makeErrorResponse(400, "validation_error", "'k' must be a positive integer");
            }
            k = static_cast<std::size_t>(req["k"].get<long long>());
        }

        std::optional<std::size_t> efOpt = std::nullopt;
        if (req.contains("ef")) {
            if (!req["ef"].is_number_integer() || req["ef"].get<long long>() <= 0) {
                return makeErrorResponse(400, "validation_error", "'ef' must be a positive integer");
            }
            efOpt = static_cast<std::size_t>(req["ef"].get<long long>());
        }

        auto rep = rag.benchmarkQuery(query, k, efOpt);

        auto formatAlg = [&](const AlgorithmBenchmarkResult& r) {
            json a;
            a["latency_us"] = r.latencyUs;
            a["distance_computations"] = r.distanceComputations;
            a["recall_at_k"] = r.recallAtK;
            json resArr = json::array();
            for (const auto& sr : r.results) {
                json item;
                item["id"] = sr.id;
                item["distance"] = sr.distance;
                resArr.push_back(std::move(item));
            }
            a["results"] = std::move(resArr);
            return a;
        };

        json doc;
        doc["k"] = rep.k;
        doc["count"] = rep.count;
        doc["ground_truth"] = rep.groundTruth;
        doc["algorithms"]["brute"] = formatAlg(rep.brute);
        doc["algorithms"]["kdtree"] = formatAlg(rep.kdtree);
        doc["algorithms"]["hnsw"] = formatAlg(rep.hnsw);

        return {200, doc.dump()};
    } catch (const OllamaUnavailable& e) {
        return makeErrorResponse(503, "ollama_unavailable", e.what());
    } catch (const OllamaError& e) {
        return makeErrorResponse(502, "ollama_error", e.what());
    } catch (const std::invalid_argument& e) {
        return makeErrorResponse(400, "validation_error", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleAsk(RagPipeline& rag, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("question") || !req["question"].is_string()) {
            return makeErrorResponse(400, "validation_error", "Missing or invalid 'question' string field");
        }
        std::string question = req["question"].get<std::string>();
        if (question.empty() || question.size() > 2000) {
            return makeErrorResponse(400, "validation_error", "'question' must be between 1 and 2000 characters");
        }

        std::size_t k = 4;
        if (req.contains("k")) {
            if (!req["k"].is_number_integer() || req["k"].get<long long>() < 1 || req["k"].get<long long>() > 20) {
                return makeErrorResponse(400, "validation_error", "'k' must be between 1 and 20");
            }
            k = static_cast<std::size_t>(req["k"].get<long long>());
        }

        Algorithm algo = Algorithm::Hnsw;
        if (req.contains("algorithm")) {
            if (!req["algorithm"].is_string()) {
                return makeErrorResponse(400, "validation_error", "'algorithm' must be a string");
            }
            try {
                algo = stringToAlgorithm(req["algorithm"].get<std::string>());
            } catch (const std::invalid_argument& e) {
                return makeErrorResponse(400, "validation_error", e.what());
            }
        }

        std::optional<std::size_t> efOpt = std::nullopt;
        if (req.contains("ef")) {
            if (!req["ef"].is_number_integer() || req["ef"].get<long long>() <= 0) {
                return makeErrorResponse(400, "validation_error", "'ef' must be a positive integer");
            }
            efOpt = static_cast<std::size_t>(req["ef"].get<long long>());
        }

        ChatOptions chatOpt;
        if (req.contains("model") && req["model"].is_string()) {
            chatOpt.model = req["model"].get<std::string>();
        }
        if (req.contains("temperature") && req["temperature"].is_number()) {
            chatOpt.temperature = req["temperature"].get<double>();
            if (chatOpt.temperature < 0.0) {
                return makeErrorResponse(400, "validation_error", "'temperature' must be non-negative");
            }
        }

        bool debug = false;
        if (req.contains("debug") && req["debug"].is_boolean()) {
            debug = req["debug"].get<bool>();
        }

        auto res = rag.ask(question, k, algo, efOpt, chatOpt, debug);

        json sourcesArr = json::array();
        for (const auto& s : res.sources) {
            json item;
            item["n"] = s.n;
            item["doc_id"] = s.docId;
            item["title"] = s.title;
            item["chunk_index"] = s.chunkIndex;
            item["text"] = s.text;
            item["distance"] = s.distance;
            item["similarity"] = s.similarity;
            sourcesArr.push_back(std::move(item));
        }

        json resp;
        resp["answer"] = res.answer;
        resp["sources"] = std::move(sourcesArr);
        resp["timings"] = {
            {"embed_ms", res.timings.embedMs},
            {"search_ms", res.timings.searchMs},
            {"generate_ms", res.timings.generateMs},
            {"total_ms", res.timings.totalMs}
        };
        resp["model"] = res.model;
        resp["prompt_chars"] = res.promptChars;
        if (debug) {
            resp["prompt"] = res.prompt;
        }

        return {200, resp.dump()};
    } catch (const OllamaUnavailable& e) {
        return makeErrorResponse(503, "ollama_unavailable", e.what());
    } catch (const OllamaError& e) {
        return makeErrorResponse(502, "ollama_error", e.what());
    } catch (const std::invalid_argument& e) {
        return makeErrorResponse(400, "validation_error", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleResetDocs(RagPipeline& rag) {
    try {
        rag.reset();
        json doc;
        doc["status"] = "ok";
        doc["message"] = "All documents cleared and collection reset";
        return {200, doc.dump()};
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

// -----------------------------------------------------------------------------
// SSE Streaming & PCA/Graph Handlers
// -----------------------------------------------------------------------------

bool isAllowedLoopbackHost(const std::string& hostHeader, int port) {
    if (hostHeader.empty()) {
        return false;
    }
    std::string h = hostHeader;
    for (char& c : h) {
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
    std::string pStr = std::to_string(port);
    if (h == "127.0.0.1:" + pStr ||
        h == "localhost:" + pStr ||
        h == "[::1]:" + pStr ||
        h == "::1:" + pStr) {
        return true;
    }
    if (port == 80 && (h == "127.0.0.1" || h == "localhost" || h == "[::1]" || h == "::1")) {
        return true;
    }
    return false;
}

std::string formatSseEvent(const std::string& event, const std::string& data) {
    return "event: " + event + "\ndata: " + data + "\n\n";
}

void ensurePcaFit(const Collection& collection, PcaCache& cache, std::size_t limit) {
    std::lock_guard<std::mutex> lock(cache.mutex);
    std::size_t effLimit = (limit == 0 || limit > 20000) ? 5000 : limit;
    std::uint64_t curVer = collection.version();

    if (cache.cachedVersion == curVer &&
        cache.cachedVersion != std::numeric_limits<std::uint64_t>::max() &&
        cache.cachedLimit >= effLimit) {
        return;
    }

    auto stored = collection.exportVectors(effLimit);
    CollectionConfig cfg = collection.getConfig();
    std::size_t dim = cfg.dimension;

    if (stored.empty() || dim < 2) {
        cache.result = fitPca(nullptr, 0, dim, 2, cfg.metric == Metric::Cosine);
        cache.nodeCoords.clear();
        cache.cachedVectors = stored;
        cache.cachedVersion = curVer;
        cache.cachedLimit = effLimit;
        return;
    }

    std::vector<float> data(stored.size() * dim);
    for (std::size_t i = 0; i < stored.size(); ++i) {
        std::copy(stored[i].vector.begin(), stored[i].vector.end(), data.data() + i * dim);
    }

    cache.result = fitPca(data.data(), stored.size(), dim, 2, cfg.metric == Metric::Cosine);
    cache.nodeCoords.clear();
    cache.cachedVectors = stored;
    cache.cachedVersion = curVer;
    cache.cachedLimit = effLimit;

    for (const auto& sv : stored) {
        auto coords = projectPca(cache.result, sv.vector.data());
        cache.nodeCoords[sv.id] = {coords[0], coords[1]};
    }
}

ApiResponse handleGetPca(const Collection& collection, PcaCache& cache, std::optional<std::size_t> limitOpt, bool isDocs) {
    try {
        if (limitOpt.has_value() && (*limitOpt == 0 || *limitOpt > 20000)) {
            return makeErrorResponse(400, "validation_error", "Parameter 'limit' must be between 1 and 20000");
        }
        std::size_t limit = limitOpt.value_or(5000);

        ensurePcaFit(collection, cache, limit);

        std::lock_guard<std::mutex> lock(cache.mutex);
        json doc;
        doc["dim"] = cache.result.dim;
        doc["total_variance"] = cache.result.totalVariance;
        doc["explained_ratio"] = cache.result.explainedRatio;

        json pts = json::array();
        for (const auto& sv : cache.cachedVectors) {
            json pt;
            pt["id"] = sv.id;
            auto it = cache.nodeCoords.find(sv.id);
            if (it != cache.nodeCoords.end()) {
                pt["x"] = it->second.first;
                pt["y"] = it->second.second;
            } else {
                pt["x"] = 0.0f;
                pt["y"] = 0.0f;
            }

            if (isDocs) {
                json meta = json::parse(sv.metadata, nullptr, false);
                if (meta.is_object()) {
                    if (meta.contains("doc_id")) pt["doc_id"] = meta["doc_id"];
                    if (meta.contains("chunk_index")) pt["chunk_index"] = meta["chunk_index"];
                    if (meta.contains("title")) pt["title"] = meta["title"];
                }
            } else {
                if (!sv.metadata.empty()) {
                    pt["metadata"] = parseMetadata(sv.metadata);
                }
            }
            pts.push_back(std::move(pt));
        }
        doc["points"] = std::move(pts);
        return {200, doc.dump()};
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handlePcaQuery(Collection& collection, PcaCache& cache, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        if (!req.contains("vector") || !req["vector"].is_array()) {
            return makeErrorResponse(400, "validation_error", "Missing or invalid 'vector' array field");
        }

        std::size_t dim = collection.getConfig().dimension;
        if (req["vector"].size() != dim) {
            return makeErrorResponse(
                400, "validation_error",
                "Vector dimension mismatch: expected " + std::to_string(dim) + ", got " + std::to_string(req["vector"].size())
            );
        }

        std::vector<float> queryVec;
        queryVec.reserve(dim);
        for (const auto& item : req["vector"]) {
            if (!item.is_number()) {
                return makeErrorResponse(400, "validation_error", "Vector components must be numeric");
            }
            float f = item.get<float>();
            if (std::isnan(f) || std::isinf(f)) {
                return makeErrorResponse(400, "validation_error", "Vector contains NaN or infinite values");
            }
            queryVec.push_back(f);
        }

        std::size_t k = 5;
        if (req.contains("k")) {
            if (!req["k"].is_number_integer() || req["k"].get<long long>() <= 0 || req["k"].get<long long>() > 1000) {
                return makeErrorResponse(400, "validation_error", "'k' must be between 1 and 1000");
            }
            k = static_cast<std::size_t>(req["k"].get<long long>());
        }

        Algorithm algo = Algorithm::Hnsw;
        if (req.contains("algorithm")) {
            if (!req["algorithm"].is_string()) {
                return makeErrorResponse(400, "validation_error", "'algorithm' must be a string");
            }
            try {
                algo = stringToAlgorithm(req["algorithm"].get<std::string>());
            } catch (const std::invalid_argument& e) {
                return makeErrorResponse(400, "validation_error", e.what());
            }
        }

        std::optional<std::size_t> efOpt = std::nullopt;
        if (req.contains("ef")) {
            if (!req["ef"].is_number_integer() || req["ef"].get<long long>() <= 0) {
                return makeErrorResponse(400, "validation_error", "'ef' must be a positive integer");
            }
            efOpt = static_cast<std::size_t>(req["ef"].get<long long>());
        }

        ensurePcaFit(collection, cache, 5000);

        auto results = collection.search(algo, queryVec, k, efOpt);

        std::lock_guard<std::mutex> lock(cache.mutex);
        auto qProj = projectPca(cache.result, queryVec.data());

        json doc;
        doc["query_projected"]["x"] = qProj[0];
        doc["query_projected"]["y"] = qProj[1];

        json resArr = json::array();
        for (const auto& r : results) {
            json item;
            item["id"] = r.id;
            item["distance"] = r.distance;
            item["similarity"] = 1.0f - r.distance;

            auto itCoord = cache.nodeCoords.find(r.id);
            if (itCoord != cache.nodeCoords.end()) {
                item["x"] = itCoord->second.first;
                item["y"] = itCoord->second.second;
            } else {
                auto v = collection.getVector(r.id);
                auto pr = projectPca(cache.result, v.data());
                item["x"] = pr[0];
                item["y"] = pr[1];
            }

            std::string metaStr = collection.getMetadata(r.id);
            if (!metaStr.empty()) {
                item["metadata"] = parseMetadata(metaStr);
            }
            resArr.push_back(std::move(item));
        }

        doc["results"] = std::move(resArr);
        return {200, doc.dump()};
    } catch (const std::invalid_argument& e) {
        return makeErrorResponse(400, "validation_error", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleDocsPcaQuery(RagPipeline& rag, PcaCache& cache, const std::string& body) {
    try {
        json req = json::parse(body, nullptr, false);
        if (req.is_discarded() || !req.is_object()) {
            return makeErrorResponse(400, "invalid_json", "Malformed JSON request body");
        }

        std::size_t k = 5;
        if (req.contains("k")) {
            if (!req["k"].is_number_integer() || req["k"].get<long long>() <= 0 || req["k"].get<long long>() > 1000) {
                return makeErrorResponse(400, "validation_error", "'k' must be between 1 and 1000");
            }
            k = static_cast<std::size_t>(req["k"].get<long long>());
        }

        Algorithm algo = Algorithm::Hnsw;
        if (req.contains("algorithm")) {
            if (!req["algorithm"].is_string()) {
                return makeErrorResponse(400, "validation_error", "'algorithm' must be a string");
            }
            try {
                algo = stringToAlgorithm(req["algorithm"].get<std::string>());
            } catch (const std::invalid_argument& e) {
                return makeErrorResponse(400, "validation_error", e.what());
            }
        }

        std::optional<std::size_t> efOpt = std::nullopt;
        if (req.contains("ef")) {
            if (!req["ef"].is_number_integer() || req["ef"].get<long long>() <= 0) {
                return makeErrorResponse(400, "validation_error", "'ef' must be a positive integer");
            }
            efOpt = static_cast<std::size_t>(req["ef"].get<long long>());
        }

        std::vector<float> queryVec;
        std::vector<RetrievedChunk> chunks;

        if (req.contains("query")) {
            if (!req["query"].is_string()) {
                return makeErrorResponse(400, "validation_error", "'query' must be a string");
            }
            std::string qText = req["query"].get<std::string>();
            if (qText.empty()) {
                return makeErrorResponse(400, "validation_error", "'query' must not be empty");
            }

            auto embedRes = rag.ollama().embed({qText}, EmbedKind::Query);
            if (embedRes.empty() || embedRes[0].size() != rag.config().dimension) {
                return makeErrorResponse(502, "ollama_error", "Failed to get query embedding from Ollama");
            }
            queryVec = std::move(embedRes[0]);
            chunks = rag.retrieve(qText, k, algo, efOpt);
        } else if (req.contains("vector")) {
            if (!req["vector"].is_array() || req["vector"].size() != rag.config().dimension) {
                return makeErrorResponse(400, "validation_error", "Missing or invalid 'vector' array");
            }
            queryVec.reserve(rag.config().dimension);
            for (const auto& item : req["vector"]) {
                if (!item.is_number()) {
                    return makeErrorResponse(400, "validation_error", "Vector components must be numeric");
                }
                float f = item.get<float>();
                if (std::isnan(f) || std::isinf(f)) {
                    return makeErrorResponse(400, "validation_error", "Vector contains NaN or infinite values");
                }
                queryVec.push_back(f);
            }
            auto rawResults = rag.collection().search(algo, queryVec, k, efOpt);
            for (const auto& r : rawResults) {
                RetrievedChunk rc;
                rc.distance = r.distance;
                rc.similarity = 1.0f - r.distance;
                std::string metaStr = rag.collection().getMetadata(r.id);
                json meta = json::parse(metaStr, nullptr, false);
                if (meta.is_object()) {
                    rc.docId = meta.value("doc_id", 0ULL);
                    rc.chunkIndex = meta.value("chunk_index", 0ULL);
                    rc.title = meta.value("title", "");
                    rc.startByte = meta.value("start", 0ULL);
                    rc.endByte = meta.value("end", 0ULL);
                    rc.text = meta.value("text", "");
                }
                chunks.push_back(std::move(rc));
            }
        } else {
            return makeErrorResponse(400, "validation_error", "Request must contain either 'query' or 'vector'");
        }

        ensurePcaFit(rag.collection(), cache, 5000);

        std::lock_guard<std::mutex> lock(cache.mutex);
        auto qProj = projectPca(cache.result, queryVec.data());

        json doc;
        doc["query_projected"]["x"] = qProj[0];
        doc["query_projected"]["y"] = qProj[1];

        json resArr = json::array();
        for (const auto& ch : chunks) {
            json item;
            item["doc_id"] = ch.docId;
            item["chunk_index"] = ch.chunkIndex;
            item["title"] = ch.title;
            item["start"] = ch.startByte;
            item["end"] = ch.endByte;
            item["text"] = ch.text;
            item["distance"] = ch.distance;
            item["similarity"] = ch.similarity;

            // Project chunk text embedding if available or project from collection
            // To get accurate coordinates, we project the chunk text
            auto chEmb = rag.ollama().embed({ch.text}, EmbedKind::Document);
            if (!chEmb.empty() && chEmb[0].size() == rag.config().dimension) {
                auto chProj = projectPca(cache.result, chEmb[0].data());
                item["x"] = chProj[0];
                item["y"] = chProj[1];
            } else {
                item["x"] = 0.0f;
                item["y"] = 0.0f;
            }

            resArr.push_back(std::move(item));
        }

        doc["results"] = std::move(resArr);
        return {200, doc.dump()};
    } catch (const OllamaUnavailable& e) {
        return makeErrorResponse(503, "ollama_unavailable", e.what());
    } catch (const OllamaError& e) {
        return makeErrorResponse(502, "ollama_error", e.what());
    } catch (const std::invalid_argument& e) {
        return makeErrorResponse(400, "validation_error", e.what());
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

ApiResponse handleHnswGraph(const Collection& collection, PcaCache& cache, std::optional<int> layerOpt, std::optional<std::size_t> maxEdgesOpt, bool isDocs) {
    try {
        int layer = layerOpt.value_or(0);
        if (layer < 0) {
            return makeErrorResponse(400, "validation_error", "Parameter 'layer' must be non-negative");
        }

        std::size_t maxEdges = maxEdgesOpt.value_or(20000);
        if (maxEdges > 20000) {
            maxEdges = 20000;
        }

        ensurePcaFit(collection, cache, 5000);

        auto graph = collection.hnswLayerGraph(layer, maxEdges);

        std::lock_guard<std::mutex> lock(cache.mutex);
        json doc;
        doc["layer"] = graph.layer;

        json nodeArr = json::array();
        for (VectorId vid : graph.nodes) {
            json n;
            n["id"] = vid;
            auto it = cache.nodeCoords.find(vid);
            if (it != cache.nodeCoords.end()) {
                n["x"] = it->second.first;
                n["y"] = it->second.second;
            } else {
                try {
                    auto vec = collection.getVector(vid);
                    auto pr = projectPca(cache.result, vec.data());
                    n["x"] = pr[0];
                    n["y"] = pr[1];
                } catch (...) {
                    n["x"] = 0.0f;
                    n["y"] = 0.0f;
                }
            }

            if (isDocs) {
                try {
                    std::string metaStr = collection.getMetadata(vid);
                    json meta = json::parse(metaStr, nullptr, false);
                    if (meta.is_object()) {
                        if (meta.contains("doc_id")) n["doc_id"] = meta["doc_id"];
                        if (meta.contains("chunk_index")) n["chunk_index"] = meta["chunk_index"];
                        if (meta.contains("title")) n["title"] = meta["title"];
                    }
                } catch (...) {}
            }

            nodeArr.push_back(std::move(n));
        }
        doc["nodes"] = std::move(nodeArr);

        json edgeArr = json::array();
        for (const auto& e : graph.edges) {
            json edge;
            edge["source"] = e.source;
            edge["target"] = e.target;
            edgeArr.push_back(std::move(edge));
        }
        doc["edges"] = std::move(edgeArr);

        return {200, doc.dump()};
    } catch (const std::exception& e) {
        return makeErrorResponse(500, "internal_error", e.what());
    }
}

} // namespace vectordb
