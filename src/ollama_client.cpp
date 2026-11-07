#include "vectordb/ollama_client.hpp"

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#endif

#include "httplib.h"
#include "nlohmann/json.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <sstream>
#include <thread>
#include <chrono>

namespace vectordb {

using json = nlohmann::json;

namespace {

bool isLoopbackHost(const std::string& host) {
    return (host == "127.0.0.1" || host == "localhost" || host == "::1" || host == "[::1]");
}

bool modelMatches(const std::string& candidate, const std::string& target) {
    if (candidate == target) return true;
    if (candidate == target + ":latest") return true;
    if (target.size() > 7 && target.substr(target.size() - 7) == ":latest") {
        if (candidate == target.substr(0, target.size() - 7)) return true;
    }
    return false;
}

std::string extractErrorMessage(const std::string& body, int status, const std::string& modelName) {
    std::string msg = "HTTP " + std::to_string(status);
    try {
        auto j = json::parse(body);
        if (j.contains("error") && j["error"].is_string()) {
            msg = j["error"].get<std::string>();
        }
    } catch (...) {
        if (!body.empty()) {
            msg += ": " + body;
        }
    }

    std::string lower = msg;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });

    if (status == 404 || lower.find("not found") != std::string::npos) {
        msg += " (hint: run: ollama pull " + modelName + ")";
    }
    return msg;
}

} // anonymous namespace

OllamaClient::OllamaClient(OllamaConfig config) : config_(std::move(config)) {
    parseAndValidateBaseUrl();
}

void OllamaClient::parseAndValidateBaseUrl() {
    const std::string& url = config_.baseUrl;
    const std::string prefix = "http://";

    if (url.rfind(prefix, 0) != 0) {
        throw std::invalid_argument("OllamaClient: baseUrl must start with 'http://' (https is not supported): " + url);
    }

    std::string rest = url.substr(prefix.size());
    std::size_t slashPos = rest.find('/');
    std::string authority = (slashPos != std::string::npos) ? rest.substr(0, slashPos) : rest;

    std::string host;
    int port = 11434;

    if (!authority.empty() && authority[0] == '[') {
        std::size_t closingBracket = authority.find(']');
        if (closingBracket == std::string::npos) {
            throw std::invalid_argument("OllamaClient: malformed IPv6 host in baseUrl: " + url);
        }
        host = authority.substr(1, closingBracket - 1);
        if (closingBracket + 1 < authority.size() && authority[closingBracket + 1] == ':') {
            port = std::stoi(authority.substr(closingBracket + 2));
        }
    } else {
        std::size_t colonPos = authority.find(':');
        if (colonPos != std::string::npos) {
            host = authority.substr(0, colonPos);
            port = std::stoi(authority.substr(colonPos + 1));
        } else {
            host = authority;
        }
    }

    if (!config_.allowRemote && !isLoopbackHost(host)) {
        throw std::invalid_argument("OllamaClient: host '" + host +
                                    "' is not a loopback address and allowRemote is false. "
                                    "For offline privacy, VectorDB only connects to local Ollama by default.");
    }

    host_ = host;
    port_ = port;
}

std::vector<std::vector<float>> OllamaClient::embed(const std::vector<std::string>& texts, EmbedKind kind) const {
    if (texts.empty()) {
        return {};
    }

    bool prependNomic = config_.useNomicPrefixes && (config_.embedModel.rfind("nomic-embed-text", 0) == 0);
    std::string prefixStr = prependNomic ? (kind == EmbedKind::Document ? "search_document: " : "search_query: ") : "";

    std::vector<std::vector<float>> allEmbeddings;
    allEmbeddings.reserve(texts.size());

    std::size_t expectedDim = 0;
    const std::size_t batchSize = config_.embedBatchSize > 0 ? config_.embedBatchSize : 16;

    for (std::size_t i = 0; i < texts.size(); i += batchSize) {
        std::size_t count = std::min(batchSize, texts.size() - i);
        std::vector<std::string> batchInputs;
        batchInputs.reserve(count);

        for (std::size_t j = 0; j < count; ++j) {
            batchInputs.push_back(prefixStr + texts[i + j]);
        }

        json reqBody;
        reqBody["model"] = config_.embedModel;
        reqBody["input"] = batchInputs;
        std::string reqBodyStr = reqBody.dump();

        httplib::Client cli(host_, port_);
        cli.set_connection_timeout(config_.connectTimeoutSec, 0);
        cli.set_read_timeout(config_.embedTimeoutSec, 0);
        cli.set_write_timeout(config_.embedTimeoutSec, 0);

        httplib::Result res = cli.Post("/api/embed", reqBodyStr, "application/json");

        // Retry ONCE on network/timeout failure
        if (!res || res->status <= 0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            res = cli.Post("/api/embed", reqBodyStr, "application/json");
        }

        if (!res) {
            throw OllamaUnavailable("Ollama /api/embed request failed: connection refused or timed out at " +
                                    host_ + ":" + std::to_string(port_));
        }

        if (res->status != 200) {
            std::string errMsg = extractErrorMessage(res->body, res->status, config_.embedModel);
            throw OllamaError("Ollama embed error: " + errMsg);
        }

        json respJson;
        try {
            respJson = json::parse(res->body);
        } catch (const json::parse_error& e) {
            throw OllamaError(std::string("Failed to parse Ollama /api/embed JSON response: ") + e.what());
        }

        if (!respJson.contains("embeddings") || !respJson["embeddings"].is_array()) {
            throw OllamaError("Ollama /api/embed response missing 'embeddings' array");
        }

        const auto& embeddingsJson = respJson["embeddings"];
        if (embeddingsJson.size() != count) {
            throw OllamaError("Ollama /api/embed returned " + std::to_string(embeddingsJson.size()) +
                              " embeddings, expected " + std::to_string(count));
        }

        for (const auto& item : embeddingsJson) {
            if (!item.is_array() || item.empty()) {
                throw OllamaError("Ollama /api/embed returned empty or non-array embedding vector");
            }
            std::vector<float> vec;
            vec.reserve(item.size());
            for (const auto& val : item) {
                if (!val.is_number()) {
                    throw OllamaError("Ollama /api/embed returned non-numeric vector component");
                }
                float f = val.get<float>();
                if (!std::isfinite(f)) {
                    throw OllamaError("Ollama /api/embed returned non-finite float (NaN or Inf)");
                }
                vec.push_back(f);
            }

            if (expectedDim == 0) {
                expectedDim = vec.size();
            } else if (vec.size() != expectedDim) {
                throw OllamaError("Inconsistent embedding dimensions returned by Ollama: expected " +
                                  std::to_string(expectedDim) + ", got " + std::to_string(vec.size()));
            }

            allEmbeddings.push_back(std::move(vec));
        }
    }

    return allEmbeddings;
}

std::string OllamaClient::chat(const std::vector<ChatMessage>& messages,
                              const ChatOptions& opt,
                              const std::function<bool(const std::string&)>& onToken) const {
    std::string modelToUse = opt.model.empty() ? config_.chatModel : opt.model;

    json messagesJson = json::array();
    for (const auto& m : messages) {
        messagesJson.push_back({{"role", m.role}, {"content", m.content}});
    }

    json reqBody;
    reqBody["model"] = modelToUse;
    reqBody["messages"] = messagesJson;
    reqBody["stream"] = true;
    reqBody["keep_alive"] = "10m";
    reqBody["options"] = {
        {"temperature", opt.temperature},
        {"seed", opt.seed},
        {"num_ctx", opt.numCtx},
        {"num_predict", opt.numPredict}
    };

    std::string reqBodyStr = reqBody.dump();

    httplib::Client cli(host_, port_);
    cli.set_connection_timeout(config_.connectTimeoutSec, 0);
    cli.set_read_timeout(config_.chatTimeoutSec, 0);
    cli.set_write_timeout(config_.chatTimeoutSec, 0);

    std::string lineBuffer;
    std::string accumulatedAnswer;
    bool abortedEarly = false;
    std::string serverError;

    httplib::Request req;
    req.method = "POST";
    req.path = "/api/chat";
    req.headers = {{"Content-Type", "application/json"}};
    req.body = reqBodyStr;

    req.content_receiver = [&](const char* data, size_t dataLength, uint64_t, uint64_t) -> bool {
        if (abortedEarly) return false;

        lineBuffer.append(data, dataLength);

        std::size_t newlinePos = 0;
        while ((newlinePos = lineBuffer.find('\n')) != std::string::npos) {
            std::string line = lineBuffer.substr(0, newlinePos);
            lineBuffer.erase(0, newlinePos + 1);

            if (line.empty() || (line.size() == 1 && line[0] == '\r')) {
                continue;
            }

            try {
                auto j = json::parse(line);
                if (j.contains("error")) {
                    serverError = extractErrorMessage(line, 500, modelToUse);
                    return false;
                }

                if (j.contains("message") && j["message"].contains("content")) {
                    std::string token = j["message"]["content"].get<std::string>();
                    if (!token.empty()) {
                        accumulatedAnswer += token;
                        if (onToken) {
                            bool keepGoing = onToken(token);
                            if (!keepGoing) {
                                abortedEarly = true;
                                return false; // Early stop
                            }
                        }
                    }
                }
            } catch (const json::parse_error&) {
                // Ignore partial or unparseable lines
            }
        }

        return true;
    };

    auto res = cli.send(req);

    if (!serverError.empty()) {
        throw OllamaError("Ollama chat error: " + serverError);
    }

    if (!res) {
        if (abortedEarly) {
            return accumulatedAnswer;
        }
        throw OllamaUnavailable("Ollama /api/chat connection failed or timed out at " +
                                host_ + ":" + std::to_string(port_));
    }

    if (res->status != 200 && !abortedEarly) {
        std::string errMsg = extractErrorMessage(res->body, res->status, modelToUse);
        throw OllamaError("Ollama chat error: " + errMsg);
    }

    return accumulatedAnswer;
}

OllamaStatus OllamaClient::status() const noexcept {
    OllamaStatus st;
    st.reachable = false;
    st.embedModelPresent = false;
    st.chatModelPresent = false;

    try {
        httplib::Client cli(host_, port_);
        cli.set_connection_timeout(config_.connectTimeoutSec > 0 ? config_.connectTimeoutSec : 3, 0);
        cli.set_read_timeout(5, 0);

        // 1. Check version
        auto vRes = cli.Get("/api/version");
        if (!vRes || vRes->status != 200) {
            st.error = "Cannot connect to Ollama at " + host_ + ":" + std::to_string(port_);
            return st;
        }

        try {
            auto vJson = json::parse(vRes->body);
            if (vJson.contains("version") && vJson["version"].is_string()) {
                st.version = vJson["version"].get<std::string>();
            }
        } catch (...) {
            st.version = "unknown";
        }

        // 2. Check tags (installed models)
        auto tRes = cli.Get("/api/tags");
        if (tRes && tRes->status == 200) {
            try {
                auto tJson = json::parse(tRes->body);
                if (tJson.contains("models") && tJson["models"].is_array()) {
                    for (const auto& m : tJson["models"]) {
                        if (m.contains("name") && m["name"].is_string()) {
                            std::string name = m["name"].get<std::string>();
                            st.models.push_back(name);
                            if (modelMatches(name, config_.embedModel)) {
                                st.embedModelPresent = true;
                            }
                            if (modelMatches(name, config_.chatModel)) {
                                st.chatModelPresent = true;
                            }
                        }
                    }
                }
            } catch (...) {
                // Ignore parse errors on tags
            }
        }

        st.reachable = true;
    } catch (const std::exception& e) {
        st.reachable = false;
        st.error = e.what();
    } catch (...) {
        st.reachable = false;
        st.error = "Unknown error checking Ollama status";
    }

    return st;
}

} // namespace vectordb
