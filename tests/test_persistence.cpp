#include "test_harness.hpp"
#include "fake_ollama.hpp"
#include "vectordb/collection.hpp"
#include "vectordb/rag.hpp"
#include "vectordb/persistence.hpp"
#include "vectordb/api.hpp"
#include "nlohmann/json.hpp"

#include <filesystem>
#include <fstream>
#include <vector>
#include <string>

using namespace vectordb;
using namespace vectordb::testing;
using json = nlohmann::json;

namespace {
std::filesystem::path getTestTempDir() {
    auto p = std::filesystem::temp_directory_path() / "vdb_test_persistence";
    std::error_code ec;
    std::filesystem::create_directories(p, ec);
    return p;
}
} // namespace

TEST(PersistenceTest, DemoCollectionSaveAndLoadRoundtrip) {
    auto dir = getTestTempDir();
    auto filePath = (dir / "test_demo.bin").string();

    CollectionConfig cfg;
    cfg.dimension = 4;
    cfg.metric = Metric::Euclidean;
    cfg.hnswParams.M = 8;
    Collection col(cfg);

    col.insert(std::nullopt, {1.0f, 0.0f, 0.0f, 0.0f}, "{\"label\":\"one\"}");
    col.insert(std::nullopt, {0.0f, 1.0f, 0.0f, 0.0f}, "{\"label\":\"two\"}");
    col.insert(std::nullopt, {0.0f, 0.0f, 1.0f, 0.0f}, "{\"label\":\"three\"}");

    CHECK(col.stats().count == 3);

    std::string err;
    bool saved = saveCollectionToFile(col, filePath, &err);
    CHECK(saved == true);

    Collection loadedCol;
    bool loaded = loadCollectionFromFile(loadedCol, filePath, &err);
    CHECK(loaded == true);

    CHECK(loadedCol.stats().count == 3);
    CHECK(loadedCol.stats().dimension == 4);
    CHECK(loadedCol.stats().metric == Metric::Euclidean);

    auto res = loadedCol.search(Algorithm::BruteForce, {1.0f, 0.0f, 0.0f, 0.0f}, 1);
    CHECK(!res.empty());
    CHECK(res[0].id == 1);
    CHECK(loadedCol.getMetadata(1) == "{\"label\":\"one\"}");

    std::filesystem::remove(filePath);
}

TEST(PersistenceTest, RagPipelineSaveAndLoadRoundtrip) {
    auto dir = getTestTempDir();
    auto filePath = (dir / "test_rag.bin").string();

    FakeOllamaServer fake;
    OllamaConfig oCfg;
    oCfg.baseUrl = fake.baseUrl();
    OllamaClient client(oCfg);

    RagConfig rCfg;
    rCfg.dimension = 768;
    RagPipeline pipeline(rCfg, client);

    pipeline.ingest("Doc A", "Quantum computing leverages superposition and quantum entanglement.");
    pipeline.ingest("Doc B", "Classical algorithms run on deterministic silicon semiconductor logic gates.");

    CHECK(pipeline.listDocuments().size() == 2);
    CHECK(pipeline.collection().stats().count >= 2);

    std::string err;
    bool saved = saveRagPipelineToFile(pipeline, filePath, &err);
    CHECK(saved == true);

    RagPipeline loadedPipeline(rCfg, client);
    bool loaded = loadRagPipelineFromFile(loadedPipeline, filePath, &err);
    CHECK(loaded == true);

    auto docs = loadedPipeline.listDocuments();
    CHECK(docs.size() == 2);
    CHECK(docs[0].title == "Doc A");
    CHECK(docs[1].title == "Doc B");
    CHECK(loadedPipeline.collection().stats().count == pipeline.collection().stats().count);

    auto chunks = loadedPipeline.retrieve("What is quantum computing?", 1);
    CHECK(!chunks.empty());
    CHECK(chunks[0].title == "Doc A");

    std::filesystem::remove(filePath);
}

TEST(PersistenceTest, CorruptFileHandling) {
    auto dir = getTestTempDir();
    auto filePath = (dir / "corrupt.bin").string();

    // 1. Write garbage bytes
    {
        std::ofstream ofs(filePath, std::ios::binary | std::ios::trunc);
        ofs << "THIS IS NOT A VALID VDB FILE HEADER 1234567890";
    }

    Collection col;
    std::string err;
    bool loaded = loadCollectionFromFile(col, filePath, &err);
    CHECK(loaded == false);
    CHECK(!err.empty());

    FakeOllamaServer fake;
    OllamaConfig oCfg;
    oCfg.baseUrl = fake.baseUrl();
    OllamaClient client(oCfg);
    RagConfig rCfg;
    RagPipeline pipeline(rCfg, client);

    bool ragLoaded = loadRagPipelineFromFile(pipeline, filePath, &err);
    CHECK(ragLoaded == false);
    CHECK(!err.empty());

    // 2. Truncated 4-byte file
    {
        std::ofstream ofs(filePath, std::ios::binary | std::ios::trunc);
        uint32_t magic = 0x43424456; // "VDBC"
        ofs.write(reinterpret_cast<const char*>(&magic), 4);
    }
    loaded = loadCollectionFromFile(col, filePath, &err);
    CHECK(loaded == false);

    std::filesystem::remove(filePath);
}

TEST(PersistenceTest, DeleteDocumentAndSearch) {
    FakeOllamaServer fake;
    OllamaConfig oCfg;
    oCfg.baseUrl = fake.baseUrl();
    OllamaClient client(oCfg);

    RagConfig rCfg;
    rCfg.dimension = 768;
    RagPipeline pipeline(rCfg, client);

    auto resA = pipeline.ingest("Alpha Doc", "Neural networks learn representations through backpropagation gradient descent.");
    auto resB = pipeline.ingest("Beta Doc", "Relational databases use B-Tree indexes and SQL for ACID compliant operations.");

    CHECK(pipeline.listDocuments().size() == 2);
    auto initialChunks = pipeline.collection().stats().count;

    // 1. Delete unknown document returns false
    CHECK(pipeline.deleteDocument(99999) == false);

    // 2. Delete Alpha Doc
    bool deleted = pipeline.deleteDocument(resA.docId);
    CHECK(deleted == true);

    auto remainingDocs = pipeline.listDocuments();
    CHECK(remainingDocs.size() == 1);
    CHECK(remainingDocs[0].id == resB.docId);
    CHECK(remainingDocs[0].title == "Beta Doc");

    // Chunk count in collection should be decreased
    CHECK(pipeline.collection().stats().count < initialChunks);

    // Searching for neural networks should not retrieve Alpha Doc anymore
    auto retrieved = pipeline.retrieve("neural networks", 2);
    for (const auto& c : retrieved) {
        CHECK(c.docId != resA.docId);
    }

    // 3. Test API handleDeleteDoc
    auto delRes = handleDeleteDoc(pipeline, resB.docId, nullptr);
    CHECK(delRes.status == 200);
    auto j = json::parse(delRes.body);
    CHECK(j["deleted"] == true);
    CHECK(j["id"] == resB.docId);

    // Deleting already deleted document returns 404
    auto del404 = handleDeleteDoc(pipeline, resB.docId, nullptr);
    CHECK(del404.status == 404);
}

