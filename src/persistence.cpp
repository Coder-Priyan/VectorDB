#include "vectordb/persistence.hpp"

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>

namespace vectordb {

namespace {

constexpr uint32_t MAGIC_COLLECTION = 0x43424456; // "VDBC"
constexpr uint32_t MAGIC_RAG        = 0x52424456; // "VDBR"
constexpr uint32_t FORMAT_VERSION   = 1;

void writeU8(std::ostream& os, uint8_t v) {
    os.write(reinterpret_cast<const char*>(&v), sizeof(v));
}

bool readU8(std::istream& is, uint8_t& v) {
    return static_cast<bool>(is.read(reinterpret_cast<char*>(&v), sizeof(v)));
}

void writeU32(std::ostream& os, uint32_t v) {
    os.write(reinterpret_cast<const char*>(&v), sizeof(v));
}

bool readU32(std::istream& is, uint32_t& v) {
    return static_cast<bool>(is.read(reinterpret_cast<char*>(&v), sizeof(v)));
}

void writeU64(std::ostream& os, uint64_t v) {
    os.write(reinterpret_cast<const char*>(&v), sizeof(v));
}

bool readU64(std::istream& is, uint64_t& v) {
    return static_cast<bool>(is.read(reinterpret_cast<char*>(&v), sizeof(v)));
}

void writeString(std::ostream& os, const std::string& str) {
    uint32_t len = static_cast<uint32_t>(str.size());
    writeU32(os, len);
    if (len > 0) {
        os.write(str.data(), len);
    }
}

bool readString(std::istream& is, std::string& str) {
    uint32_t len = 0;
    if (!readU32(is, len)) {
        return false;
    }
    if (len > 100 * 1024 * 1024) { // 100MB sanity guard against corrupt lengths
        return false;
    }
    str.resize(len);
    if (len > 0) {
        return static_cast<bool>(is.read(&str[0], len));
    }
    return true;
}

void writeCollectionData(std::ostream& os, const Collection& collection) {
    const auto& cfg = collection.getConfig();
    writeU64(os, static_cast<uint64_t>(cfg.dimension));
    writeU32(os, static_cast<uint32_t>(cfg.metric));
    writeU64(os, static_cast<uint64_t>(cfg.leafSize));
    writeU64(os, static_cast<uint64_t>(cfg.hnswParams.M));
    writeU64(os, static_cast<uint64_t>(cfg.hnswParams.efConstruction));
    writeU64(os, static_cast<uint64_t>(cfg.hnswParams.efSearch));
    writeU64(os, static_cast<uint64_t>(cfg.hnswParams.seed));
    writeU8(os, cfg.hnswParams.useHeuristic ? 1 : 0);

    writeU64(os, collection.nextId());

    auto allVecs = collection.exportAllVectors();
    writeU64(os, static_cast<uint64_t>(allVecs.size()));

    for (const auto& sv : allVecs) {
        writeU64(os, sv.id);
        os.write(reinterpret_cast<const char*>(sv.vector.data()), sv.vector.size() * sizeof(float));
        writeString(os, sv.metadata);
    }
}

bool readCollectionData(std::istream& is, Collection& collection, std::string* errorOut) {
    CollectionConfig cfg;
    uint64_t dim = 0, leaf = 0, hM = 0, hEfC = 0, hEfS = 0, hSeed = 0;
    uint32_t met = 0;
    uint8_t hHeur = 0;

    if (!readU64(is, dim) || !readU32(is, met) || !readU64(is, leaf) ||
        !readU64(is, hM) || !readU64(is, hEfC) || !readU64(is, hEfS) ||
        !readU64(is, hSeed) || !readU8(is, hHeur)) {
        if (errorOut) *errorOut = "Failed to read collection configuration";
        return false;
    }

    cfg.dimension = static_cast<std::size_t>(dim);
    cfg.metric = static_cast<Metric>(met);
    cfg.leafSize = static_cast<std::size_t>(leaf);
    cfg.hnswParams.M = static_cast<std::size_t>(hM);
    cfg.hnswParams.efConstruction = static_cast<std::size_t>(hEfC);
    cfg.hnswParams.efSearch = static_cast<std::size_t>(hEfS);
    cfg.hnswParams.seed = static_cast<unsigned int>(hSeed);
    cfg.hnswParams.useHeuristic = (hHeur != 0);

    uint64_t nextId = 0;
    if (!readU64(is, nextId)) {
        if (errorOut) *errorOut = "Failed to read nextId counter";
        return false;
    }

    uint64_t vecCount = 0;
    if (!readU64(is, vecCount)) {
        if (errorOut) *errorOut = "Failed to read vector count";
        return false;
    }

    std::vector<StoredVector> vecs;
    vecs.reserve(static_cast<std::size_t>(vecCount));

    for (uint64_t i = 0; i < vecCount; ++i) {
        StoredVector sv;
        if (!readU64(is, sv.id)) {
            if (errorOut) *errorOut = "Truncated vector id";
            return false;
        }
        sv.vector.resize(cfg.dimension);
        if (!is.read(reinterpret_cast<char*>(sv.vector.data()), cfg.dimension * sizeof(float))) {
            if (errorOut) *errorOut = "Truncated vector float data";
            return false;
        }
        if (!readString(is, sv.metadata)) {
            if (errorOut) *errorOut = "Truncated vector metadata";
            return false;
        }
        vecs.push_back(std::move(sv));
    }

    try {
        collection.loadFromVectors(cfg, vecs, nextId);
    } catch (const std::exception& e) {
        if (errorOut) *errorOut = std::string("Collection load error: ") + e.what();
        return false;
    }

    return true;
}

} // namespace

bool saveCollectionToFile(const Collection& collection, const std::string& filePath, std::string* errorOut) {
    std::string tmpPath = filePath + ".tmp";
    {
        std::ofstream ofs(tmpPath, std::ios::binary | std::ios::trunc);
        if (!ofs.is_open()) {
            if (errorOut) *errorOut = "Cannot open temporary file for writing: " + tmpPath;
            return false;
        }

        writeU32(ofs, MAGIC_COLLECTION);
        writeU32(ofs, FORMAT_VERSION);
        writeCollectionData(ofs, collection);

        if (!ofs.good()) {
            if (errorOut) *errorOut = "Stream error while writing collection data";
            return false;
        }
        ofs.flush();
    }

    std::error_code ec;
    std::filesystem::remove(filePath, ec);
    std::filesystem::rename(tmpPath, filePath, ec);
    if (ec) {
        if (errorOut) *errorOut = "Failed to atomically rename file: " + ec.message();
        return false;
    }
    return true;
}

bool loadCollectionFromFile(Collection& collection, const std::string& filePath, std::string* errorOut) {
    std::ifstream ifs(filePath, std::ios::binary);
    if (!ifs.is_open()) {
        if (errorOut) *errorOut = "File not found: " + filePath;
        return false;
    }

    uint32_t magic = 0;
    if (!readU32(ifs, magic) || magic != MAGIC_COLLECTION) {
        if (errorOut) *errorOut = "Invalid or missing collection magic header";
        return false;
    }

    uint32_t version = 0;
    if (!readU32(ifs, version) || version != FORMAT_VERSION) {
        if (errorOut) *errorOut = "Unsupported collection format version: " + std::to_string(version);
        return false;
    }

    return readCollectionData(ifs, collection, errorOut);
}

bool saveRagPipelineToFile(const RagPipeline& rag, const std::string& filePath, std::string* errorOut) {
    std::string tmpPath = filePath + ".tmp";
    {
        std::ofstream ofs(tmpPath, std::ios::binary | std::ios::trunc);
        if (!ofs.is_open()) {
            if (errorOut) *errorOut = "Cannot open temporary file for writing: " + tmpPath;
            return false;
        }

        writeU32(ofs, MAGIC_RAG);
        writeU32(ofs, FORMAT_VERSION);

        writeU64(ofs, rag.nextDocId());

        auto docs = rag.exportDocuments();
        writeU64(ofs, static_cast<uint64_t>(docs.size()));

        for (const auto& doc : docs) {
            writeU64(ofs, doc.id);
            writeString(ofs, doc.title);
            writeU64(ofs, static_cast<uint64_t>(doc.byteLength));
            writeU64(ofs, static_cast<uint64_t>(doc.chunkCount));
            writeU32(ofs, static_cast<uint32_t>(doc.strategy));
            writeString(ofs, doc.createdAt);

            writeU32(ofs, static_cast<uint32_t>(doc.chunkVectorIds.size()));
            for (uint64_t vid : doc.chunkVectorIds) {
                writeU64(ofs, vid);
            }

            writeU32(ofs, static_cast<uint32_t>(doc.chunks.size()));
            for (const auto& chunk : doc.chunks) {
                writeU32(ofs, static_cast<uint32_t>(chunk.index));
                writeU64(ofs, static_cast<uint64_t>(chunk.startByte));
                writeU64(ofs, static_cast<uint64_t>(chunk.endByte));
                writeString(ofs, chunk.text);
            }
        }

        writeCollectionData(ofs, rag.collection());

        if (!ofs.good()) {
            if (errorOut) *errorOut = "Stream error while writing RAG data";
            return false;
        }
        ofs.flush();
    }

    std::error_code ec;
    std::filesystem::remove(filePath, ec);
    std::filesystem::rename(tmpPath, filePath, ec);
    if (ec) {
        if (errorOut) *errorOut = "Failed to atomically rename file: " + ec.message();
        return false;
    }
    return true;
}

bool loadRagPipelineFromFile(RagPipeline& rag, const std::string& filePath, std::string* errorOut) {
    std::ifstream ifs(filePath, std::ios::binary);
    if (!ifs.is_open()) {
        if (errorOut) *errorOut = "File not found: " + filePath;
        return false;
    }

    uint32_t magic = 0;
    if (!readU32(ifs, magic) || magic != MAGIC_RAG) {
        if (errorOut) *errorOut = "Invalid or missing RAG magic header";
        return false;
    }

    uint32_t version = 0;
    if (!readU32(ifs, version) || version != FORMAT_VERSION) {
        if (errorOut) *errorOut = "Unsupported RAG format version: " + std::to_string(version);
        return false;
    }

    uint64_t nextDocId = 0;
    if (!readU64(ifs, nextDocId)) {
        if (errorOut) *errorOut = "Truncated nextDocId";
        return false;
    }

    uint64_t docCount = 0;
    if (!readU64(ifs, docCount)) {
        if (errorOut) *errorOut = "Truncated docCount";
        return false;
    }

    std::vector<DocumentRecord> docs;
    docs.reserve(static_cast<std::size_t>(docCount));

    for (uint64_t i = 0; i < docCount; ++i) {
        DocumentRecord doc;
        if (!readU64(ifs, doc.id) || !readString(ifs, doc.title)) {
            if (errorOut) *errorOut = "Truncated document record";
            return false;
        }
        uint64_t bLen = 0, cCount = 0;
        uint32_t strat = 0;
        if (!readU64(ifs, bLen) || !readU64(ifs, cCount) || !readU32(ifs, strat) || !readString(ifs, doc.createdAt)) {
            if (errorOut) *errorOut = "Truncated document fields";
            return false;
        }
        doc.byteLength = static_cast<std::size_t>(bLen);
        doc.chunkCount = static_cast<std::size_t>(cCount);
        doc.strategy = static_cast<ChunkStrategy>(strat);

        uint32_t vIdCount = 0;
        if (!readU32(ifs, vIdCount)) {
            if (errorOut) *errorOut = "Truncated chunk vector ids count";
            return false;
        }
        doc.chunkVectorIds.reserve(vIdCount);
        for (uint32_t vi = 0; vi < vIdCount; ++vi) {
            uint64_t vid = 0;
            if (!readU64(ifs, vid)) {
                if (errorOut) *errorOut = "Truncated vector id";
                return false;
            }
            doc.chunkVectorIds.push_back(vid);
        }

        uint32_t chunkCount = 0;
        if (!readU32(ifs, chunkCount)) {
            if (errorOut) *errorOut = "Truncated chunk info count";
            return false;
        }
        doc.chunks.reserve(chunkCount);
        for (uint32_t ci = 0; ci < chunkCount; ++ci) {
            DocumentChunkInfo chunk;
            uint32_t cIdx = 0;
            uint64_t sB = 0, eB = 0;
            if (!readU32(ifs, cIdx) || !readU64(ifs, sB) || !readU64(ifs, eB) || !readString(ifs, chunk.text)) {
                if (errorOut) *errorOut = "Truncated chunk item";
                return false;
            }
            chunk.index = static_cast<std::size_t>(cIdx);
            chunk.startByte = static_cast<std::size_t>(sB);
            chunk.endByte = static_cast<std::size_t>(eB);
            doc.chunks.push_back(std::move(chunk));
        }

        docs.push_back(std::move(doc));
    }

    if (!readCollectionData(ifs, rag.collection(), errorOut)) {
        return false;
    }

    rag.loadDocuments(docs, nextDocId);
    return true;
}

} // namespace vectordb

