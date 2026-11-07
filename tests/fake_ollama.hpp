#pragma once

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#endif

#include "httplib.h"
#include "nlohmann/json.hpp"

#include <atomic>
#include <cmath>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace vectordb::testing {

using json = nlohmann::json;

class FakeOllamaServer {
public:
    FakeOllamaServer() {
        setupRoutes();
        port_ = server_.bind_to_any_port("127.0.0.1");
        if (port_ <= 0) {
            throw std::runtime_error("FakeOllamaServer: failed to bind to an ephemeral port");
        }
        worker_ = std::thread([this]() {
            server_.listen_after_bind();
        });
        std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }

    ~FakeOllamaServer() {
        stop();
    }

    void stop() {
        if (!stopped_.exchange(true)) {
            server_.stop();
            // On Windows, wake up the listening thread with a quick ping so select() returns
            try {
                httplib::Client dummy("127.0.0.1", port_);
                dummy.set_connection_timeout(0, 100000); // 100ms
                dummy.Get("/api/version");
            } catch (...) {}
            if (worker_.joinable()) {
                worker_.join();
            }
        }
    }

    std::string baseUrl() const {
        return "http://127.0.0.1:" + std::to_string(port_);
    }

    int port() const {
        return port_;
    }

    // Configuration and inspection state
    std::string version = "0.4.0";
    std::vector<std::string> models = {"nomic-embed-text:latest", "llama3.2:latest"};

    std::atomic<int> embedCallCount{0};
    int failOnEmbedCallIndex = -1;    ///< If set, returns 500 when embedCallCount matches
    int embedDimension = 768;         ///< Dimension of returned vectors (default 768, can toggle to e.g. 3)

    std::string chatMode = "normal";  ///< "normal", "echo_prompt", "model_not_found"

    mutable std::mutex dataMutex;
    std::vector<std::string> receivedEmbedInputs;
    std::vector<json> receivedChatRequests;

    void reset() {
        std::lock_guard<std::mutex> lock(dataMutex);
        embedCallCount = 0;
        failOnEmbedCallIndex = -1;
        embedDimension = 768;
        chatMode = "normal";
        receivedEmbedInputs.clear();
        receivedChatRequests.clear();
    }

private:
    httplib::Server server_;
    int port_ = 0;
    std::thread worker_;
    std::atomic<bool> stopped_{false};

    // Deterministic bag-of-words unit embedding
    std::vector<float> computeBoWEmbedding(const std::string& text, int dim) const {
        std::vector<float> vec(dim, 0.001f); // small baseline
        std::istringstream iss(text);
        std::string token;
        while (iss >> token) {
            // Simple FNV-1a hash
            uint32_t h = 2166136261u;
            for (char c : token) {
                h ^= static_cast<uint8_t>(c);
                h *= 16777619u;
            }
            int idx = static_cast<int>(h % static_cast<uint32_t>(dim));
            vec[idx] += 1.0f;
        }

        // L2 normalize
        float norm = 0.0f;
        for (float v : vec) norm += v * v;
        norm = std::sqrt(norm);
        if (norm > 0.0f) {
            for (float& v : vec) v /= norm;
        }
        return vec;
    }

    void setupRoutes() {
        // GET /api/version
        server_.Get("/api/version", [this](const httplib::Request&, httplib::Response& res) {
            json j;
            j["version"] = version;
            res.set_content(j.dump(), "application/json");
        });

        // GET /api/tags
        server_.Get("/api/tags", [this](const httplib::Request&, httplib::Response& res) {
            json modelsArr = json::array();
            for (const auto& m : models) {
                modelsArr.push_back({{"name", m}, {"model", m}});
            }
            json j;
            j["models"] = modelsArr;
            res.set_content(j.dump(), "application/json");
        });

        // POST /api/embed
        server_.Post("/api/embed", [this](const httplib::Request& req, httplib::Response& res) {
            int currentCall = ++embedCallCount;
            if (failOnEmbedCallIndex > 0 && currentCall == failOnEmbedCallIndex) {
                res.status = 500;
                res.set_content(R"({"error":"simulated Ollama embed failure"})", "application/json");
                return;
            }

            try {
                auto reqJson = json::parse(req.body);
                if (!reqJson.contains("input") || !reqJson["input"].is_array()) {
                    res.status = 400;
                    res.set_content(R"({"error":"missing 'input' array"})", "application/json");
                    return;
                }

                std::vector<std::string> inputs;
                for (const auto& item : reqJson["input"]) {
                    inputs.push_back(item.get<std::string>());
                }

                {
                    std::lock_guard<std::mutex> lock(dataMutex);
                    for (const auto& inp : inputs) {
                        receivedEmbedInputs.push_back(inp);
                    }
                }

                json embeddingsArr = json::array();
                for (const auto& inp : inputs) {
                    auto vec = computeBoWEmbedding(inp, embedDimension);
                    embeddingsArr.push_back(vec);
                }

                json resp;
                resp["embeddings"] = embeddingsArr;
                res.set_content(resp.dump(), "application/json");
            } catch (const std::exception& e) {
                res.status = 400;
                res.set_content(std::string(R"({"error":")") + e.what() + R"("})", "application/json");
            }
        });

        // POST /api/chat
        server_.Post("/api/chat", [this](const httplib::Request& req, httplib::Response& res) {
            {
                std::lock_guard<std::mutex> lock(dataMutex);
                try {
                    receivedChatRequests.push_back(json::parse(req.body));
                } catch (...) {}
            }

            if (chatMode == "model_not_found") {
                res.status = 404;
                res.set_content(R"({"error":"model \"fake-model\" not found, try pulling it first"})", "application/json");
                return;
            }

            std::string textToStream;
            if (chatMode == "echo_prompt") {
                try {
                    auto reqJson = json::parse(req.body);
                    if (reqJson.contains("messages") && reqJson["messages"].is_array() && !reqJson["messages"].empty()) {
                        std::string combined;
                        for (const auto& m : reqJson["messages"]) {
                            if (!combined.empty()) combined += "\n\n";
                            combined += m["content"].get<std::string>();
                        }
                        textToStream = combined;
                    } else {
                        textToStream = "echo: empty prompt";
                    }
                } catch (...) {
                    textToStream = "echo: parse error";
                }
            } else {
                textToStream = "According to document [1], vector databases enable high-speed similarity search.";
            }

            // Properly JSON-escape textToStream
            std::string escapedText;
            {
                json jStr = textToStream;
                std::string rawDump = jStr.dump();
                if (rawDump.size() >= 2) {
                    escapedText = rawDump.substr(1, rawDump.size() - 2);
                } else {
                    escapedText = rawDump;
                }
            }

            // Stream response word by word, deliberately splitting lines across chunks to test line buffering
            auto step = std::make_shared<int>(0);
            res.set_chunked_content_provider("application/x-ndjson",
                [escapedText, step](size_t /*offset*/, httplib::DataSink& sink) -> bool {
                    if (*step == 0) {
                        (*step)++;
                        // Part A: send partial JSON line
                        std::string partA = "{\"model\":\"llama3.2\",\"message\":{\"role\":\"assistant\",\"content\":\"";
                        partA += escapedText.substr(0, std::min<size_t>(10, escapedText.size()));
                        sink.write(partA.data(), partA.size());
                        return true;
                    } else if (*step == 1) {
                        (*step)++;
                        // Part B: send remainder of first line + newline
                        std::string partB = escapedText.size() > 10 ? escapedText.substr(10) : "";
                        partB += "\"},\"done\":false}\n";
                        sink.write(partB.data(), partB.size());
                        return true;
                    } else if (*step == 2) {
                        (*step)++;
                        // Part C: send final done line
                        std::string doneLine = "{\"model\":\"llama3.2\",\"done\":true}\n";
                        sink.write(doneLine.data(), doneLine.size());
                        return true;
                    }

                    sink.done();
                    return true;
                }
            );
        });
    }
};

} // namespace vectordb::testing
