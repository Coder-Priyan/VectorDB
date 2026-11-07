#pragma once

#include <cstddef>
#include <functional>
#include <stdexcept>
#include <string>
#include <vector>

namespace vectordb {

/// Configuration for the Ollama client
struct OllamaConfig {
    std::string baseUrl = "http://127.0.0.1:11434";
    std::string embedModel = "nomic-embed-text";
    std::string chatModel = "llama3.2";
    bool useNomicPrefixes = true;
    int connectTimeoutSec = 5;
    int embedTimeoutSec = 120;
    int chatTimeoutSec = 900;
    std::size_t embedBatchSize = 16;
    bool allowRemote = false;
};

/// Base exception for Ollama errors
class OllamaException : public std::runtime_error {
public:
    explicit OllamaException(const std::string& message) : std::runtime_error(message) {}
};

/// Thrown when Ollama cannot be reached, connection drops, or timeouts occur
class OllamaUnavailable : public OllamaException {
public:
    explicit OllamaUnavailable(const std::string& message) : OllamaException(message) {}
};

/// Thrown when Ollama returns an error response (HTTP error or JSON {"error": "..."})
class OllamaError : public OllamaException {
public:
    explicit OllamaError(const std::string& message) : OllamaException(message) {}
};

/// Type of text being embedded (affects task prefix for models like nomic-embed-text)
enum class EmbedKind {
    Document,
    Query
};

/// Represents a single chat message
struct ChatMessage {
    std::string role;     ///< "system", "user", "assistant"
    std::string content;
};

/// Options for chat completion
struct ChatOptions {
    std::string model;          ///< Model name; empty means use config.chatModel
    double temperature = 0.0;
    int seed = 42;
    int numCtx = 4096;
    int numPredict = 512;
};

/// Status report of the Ollama instance
struct OllamaStatus {
    bool reachable = false;
    std::string version;
    std::vector<std::string> models;
    bool embedModelPresent = false;
    bool chatModelPresent = false;
    std::string error;
};

/**
 * @brief Client for Ollama HTTP API (embeddings and streaming chat completions).
 *
 * Designed for local-only, offline operation by default.
 * Validates loopback baseUrl in constructor unless allowRemote is explicitly enabled.
 */
class OllamaClient {
public:
    explicit OllamaClient(OllamaConfig config = {});

    const OllamaConfig& config() const noexcept { return config_; }

    /**
     * @brief Embed a batch of texts using Ollama's /api/embed endpoint.
     *
     * Handles nomic task prefixes, batching by embedBatchSize, dimension validation,
     * finite value checks, and retries once on connection reset or timeout.
     *
     * @throws OllamaUnavailable if connection fails or times out.
     * @throws OllamaError if Ollama returns an error or dimension mismatch occurs.
     */
    std::vector<std::vector<float>> embed(const std::vector<std::string>& texts, EmbedKind kind) const;

    /**
     * @brief Perform a streaming chat completion using Ollama's /api/chat endpoint.
     *
     * Parses NDJSON stream incrementally with an internal buffer to handle split lines.
     * Invokes onToken callback for each generated token piece.
     * If onToken returns false, stops streaming and returns the accumulated text so far.
     *
     * @throws OllamaUnavailable if connection fails or times out.
     * @throws OllamaError if Ollama returns an error.
     */
    std::string chat(const std::vector<ChatMessage>& messages,
                     const ChatOptions& opt = {},
                     const std::function<bool(const std::string&)>& onToken = {}) const;

    /**
     * @brief Check Ollama reachability, version, and model presence.
     *
     * Never throws exceptions; returns an OllamaStatus struct.
     */
    OllamaStatus status() const noexcept;

private:
    OllamaConfig config_;
    std::string host_;
    int port_ = 11434;

    void parseAndValidateBaseUrl();
};

} // namespace vectordb
