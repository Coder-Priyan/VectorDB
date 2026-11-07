#include "test_harness.hpp"
#include "vectordb/ollama_client.hpp"

#include <cstdlib>
#include <iostream>
#include <string>

using namespace vectordb;

TEST(LiveOllamaTest, RealOllamaIntegration) {
    const char* envVal = std::getenv("VECTORDB_LIVE_OLLAMA");
    bool enabled = (envVal != nullptr && std::string(envVal) == "1");

    if (!enabled) {
        std::cout << "  [SKIPPED] Set VECTORDB_LIVE_OLLAMA=1 to run tests against real Ollama instance.\n";
        return;
    }

    std::cout << "  [LIVE] Connecting to real Ollama at http://127.0.0.1:11434...\n";

    OllamaConfig cfg;
    cfg.baseUrl = "http://127.0.0.1:11434";
    cfg.embedModel = "nomic-embed-text";
    cfg.chatModel = "llama3.2";
    cfg.connectTimeoutSec = 5;
    cfg.embedTimeoutSec = 120;
    cfg.chatTimeoutSec = 300;

    OllamaClient client(cfg);

    // 1. Status check
    auto st = client.status();
    CHECK(st.reachable);
    CHECK(!st.version.empty());
    std::cout << "  [LIVE] Ollama version: " << st.version << "\n";
    std::cout << "  [LIVE] Found " << st.models.size() << " installed models.\n";
    CHECK(st.embedModelPresent);
    CHECK(st.chatModelPresent);

    // 2. Embed one sentence (check dimension == 768)
    auto embeddings = client.embed({"Vector databases enable fast semantic similarity search."}, EmbedKind::Document);
    CHECK(embeddings.size() == 1);
    CHECK(embeddings[0].size() == 768);
    std::cout << "  [LIVE] Embedded sentence: 768-dim vector generated successfully.\n";

    // 3. Chat completion: "Reply with the single word OK" with small numPredict
    ChatOptions chatOpt;
    chatOpt.numPredict = 5;
    chatOpt.temperature = 0.0;

    std::string reply = client.chat({{"user", "Reply with the single word OK"}}, chatOpt);
    CHECK(!reply.empty());
    std::cout << "  [LIVE] Chat reply: \"" << reply << "\"\n";
}
