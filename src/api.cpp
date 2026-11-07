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

} // namespace vectordb
