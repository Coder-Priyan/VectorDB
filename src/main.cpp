#include "vectordb/types.hpp"
#include "vectordb/distance.hpp"
#include "vectordb/brute_force.hpp"
#include "vectordb/kd_tree.hpp"
#include "vectordb/hnsw.hpp"
#include "vectordb/dataset.hpp"
#include "vectordb/evaluation.hpp"

#include <iostream>
#include <iomanip>
#include <chrono>
#include <vector>
#include <string>

using namespace vectordb;

void runDemo() {
    std::cout << "========================================================\n";
    std::cout << "   VectorDB - Semantic Search Engine (Task 1 Demo)\n";
    std::cout << "========================================================\n\n";

    // 1. Hand-made 2D dataset
    const std::vector<std::pair<VectorId, std::vector<float>>> items = {
        {101, { 1.0f,  0.0f}},  // Unit vector +X
        {102, { 0.0f,  1.0f}},  // Unit vector +Y
        {103, { 0.7071f, 0.7071f}}, // 45-degree diagonal
        {104, {-1.0f,  0.0f}},  // Unit vector -X
        {105, { 0.0f, -1.0f}}   // Unit vector -Y
    };

    const std::vector<float> query = {0.9f, 0.2f};
    const std::size_t k = 3;

    std::cout << "Indexed 5 hand-made 2D vectors:\n";
    for (const auto& item : items) {
        std::cout << "  ID " << item.first << " : ["
                  << std::fixed << std::setprecision(4)
                  << item.second[0] << ", " << item.second[1] << "]\n";
    }

    std::cout << "\nQuery vector: [" << query[0] << ", " << query[1] << "], Top-k = " << k << "\n\n";

    const std::vector<Metric> metrics = {
        Metric::Cosine,
        Metric::Euclidean,
        Metric::Manhattan
    };

    for (Metric metric : metrics) {
        BruteForceIndex index(2, metric);
        for (const auto& item : items) {
            index.insert(item.first, item.second);
        }

        const auto results = index.search(query, k);

        std::cout << "--- Metric: " << metricToString(metric) << " ---\n";
        std::cout << "  Rank |  Vector ID  | Distance\n";
        std::cout << "  -----+------------+----------\n";
        for (std::size_t r = 0; r < results.size(); ++r) {
            std::cout << "   " << std::setw(2) << (r + 1) << "  |"
                      << "  " << std::setw(8) << results[r].id << "  |"
                      << "  " << std::fixed << std::setprecision(6) << results[r].distance << "\n";
        }
        std::cout << "\n";
    }
}

void runBenchmark() {
    constexpr std::size_t n = 10000;
    constexpr std::size_t dim = 128;
    constexpr std::size_t numQueries = 100;
    constexpr std::size_t k = 10;

    std::cout << "========================================================\n";
    std::cout << "   VectorDB Mini Benchmark (BruteForceIndex)\n";
    std::cout << "   Dataset: n = " << n << ", dim = " << dim << "\n";
    std::cout << "   Queries: " << numQueries << " queries, k = " << k << "\n";
    std::cout << "========================================================\n\n";

    std::cout << "Generating " << n << " synthetic vectors (seed=42)... " << std::flush;
    auto genStart = std::chrono::steady_clock::now();
    const auto dataset = randomVectors(n, dim, 42);
    auto genEnd = std::chrono::steady_clock::now();
    double genSec = std::chrono::duration<double>(genEnd - genStart).count();
    std::cout << "Done in " << std::fixed << std::setprecision(3) << genSec << "s.\n";

    std::cout << "Generating " << numQueries << " query vectors (seed=1337)... " << std::flush;
    const auto queries = randomVectors(numQueries, dim, 1337);
    std::cout << "Done.\n\n";

    const std::vector<Metric> metrics = {
        Metric::Cosine,
        Metric::Euclidean,
        Metric::Manhattan
    };

    std::cout << std::left
              << std::setw(12) << "Metric"
              << std::setw(16) << "Build Time (ms)"
              << std::setw(18) << "Total Search (ms)"
              << std::setw(20) << "Avg Query Time (ms)"
              << std::setw(14) << "QPS (queries/s)"
              << "\n";
    std::cout << std::string(80, '-') << "\n";

    for (Metric metric : metrics) {
        // Measure build time (insertion)
        auto buildStart = std::chrono::steady_clock::now();
        BruteForceIndex index(dim, metric);
        for (std::size_t i = 0; i < n; ++i) {
            index.insert(static_cast<VectorId>(i + 1), dataset[i]);
        }
        auto buildEnd = std::chrono::steady_clock::now();
        double buildMs = std::chrono::duration<double, std::milli>(buildEnd - buildStart).count();

        // Measure search time
        auto searchStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) {
            const auto results = index.search(queries[q], k);
            if (results.empty()) {
                std::cerr << "Unexpected empty result!\n";
            }
        }
        auto searchEnd = std::chrono::steady_clock::now();
        double totalSearchMs = std::chrono::duration<double, std::milli>(searchEnd - searchStart).count();
        double avgQueryMs = totalSearchMs / static_cast<double>(numQueries);
        double qps = (numQueries / (totalSearchMs / 1000.0));

        std::cout << std::left
                  << std::setw(12) << metricToString(metric)
                  << std::setw(16) << std::fixed << std::setprecision(2) << buildMs
                  << std::setw(18) << std::fixed << std::setprecision(2) << totalSearchMs
                  << std::setw(20) << std::fixed << std::setprecision(4) << avgQueryMs
                  << std::setw(14) << std::fixed << std::setprecision(1) << qps
                  << "\n";
    }

    std::cout << std::string(80, '-') << "\n\n";
    std::cout << "Benchmark completed successfully.\n\n";
}

// NOTE ON THE CURSE OF DIMENSIONALITY:
// High-dimensional Gaussian random data represents the worst-case operating regime for KD-Trees.
// In low dimensions (e.g. d=2, d=4), query hyperspheres intersect very few orthogonal bounding boxes,
// allowing branch-and-bound pruning to skip up to 95-99% of distance evaluations.
// In high dimensions (e.g. d >= 32), the geometric volume of hyperspheres concentrates near the boundary,
// and the distance from the query to splitting planes along any single dimension becomes negligible compared
// to the total Euclidean distance. Consequently, nearly every bounding box overlaps the query sphere,
// forcing the tree to visit nearly 100% of leaves. Due to recursive tree traversal overhead and pointer
// dereferences compared to BruteForce's contiguous memory sequential scan, speedup drops below 1.0x.
// This is the classic "Curse of Dimensionality" and is the exact theoretical phenomenon we demonstrate below.
void runKdTreeBenchmark() {
    constexpr std::size_t n = 20000;
    constexpr std::size_t numQueries = 100;
    constexpr std::size_t k = 10;
    const std::vector<std::size_t> dims = {2, 4, 8, 16, 32, 64, 128};

    std::cout << "=========================================================================================\n";
    std::cout << "   KD-Tree vs Brute Force: Dimension Scaling Benchmark\n";
    std::cout << "   Dataset: n = " << n << ", Queries = " << numQueries << ", k = " << k << ", Metric = Euclidean\n";
    std::cout << "=========================================================================================\n\n";

    std::cout << std::left
              << std::setw(6)  << "Dim"
              << std::setw(16) << "KD Build (ms)"
              << std::setw(18) << "KD Query (ms)"
              << std::setw(18) << "Brute Query (ms)"
              << std::setw(12) << "Speedup"
              << std::setw(22) << "Dist Comps (% of n)"
              << std::setw(12) << "Recall@10"
              << "\n";
    std::cout << std::string(104, '-') << "\n";

    auto benchmarkConfig = [&](std::size_t dim, Metric metric) {
        const auto dataset = randomVectors(n, dim, 42);
        const auto queries = randomVectors(numQueries, dim, 1337);

        KdTreeIndex kdTree(dim, metric, 8);
        BruteForceIndex brute(dim, metric);

        for (std::size_t i = 0; i < n; ++i) {
            const VectorId id = static_cast<VectorId>(i + 1);
            kdTree.insert(id, dataset[i]);
            brute.insert(id, dataset[i]);
        }

        // Measure KD build time
        auto buildStart = std::chrono::steady_clock::now();
        kdTree.build();
        auto buildEnd = std::chrono::steady_clock::now();
        double kdBuildMs = std::chrono::duration<double, std::milli>(buildEnd - buildStart).count();

        // Warmup query
        SearchStats dummyStats;
        kdTree.searchWithStats(queries[0], k, dummyStats);
        brute.search(queries[0], k);

        // Benchmark KD-Tree search
        std::size_t totalDistComps = 0;
        std::vector<std::vector<SearchResult>> kdResults(numQueries);
        auto kdStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) {
            SearchStats stats;
            kdResults[q] = kdTree.searchWithStats(queries[q], k, stats);
            totalDistComps += stats.distanceComputations;
        }
        auto kdEnd = std::chrono::steady_clock::now();
        double kdTotalMs = std::chrono::duration<double, std::milli>(kdEnd - kdStart).count();
        double kdAvgMs = kdTotalMs / static_cast<double>(numQueries);

        // Benchmark Brute Force search
        std::vector<std::vector<SearchResult>> bruteResults(numQueries);
        auto bruteStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) {
            bruteResults[q] = brute.search(queries[q], k);
        }
        auto bruteEnd = std::chrono::steady_clock::now();
        double bruteTotalMs = std::chrono::duration<double, std::milli>(bruteEnd - bruteStart).count();
        double bruteAvgMs = bruteTotalMs / static_cast<double>(numQueries);

        double speedup = bruteAvgMs / kdAvgMs;
        double avgComps = static_cast<double>(totalDistComps) / static_cast<double>(numQueries);
        double pctComps = (avgComps / static_cast<double>(n)) * 100.0;
        double recall = meanRecallAtK(bruteResults, kdResults);

        std::string speedupStr = std::to_string(speedup);
        speedupStr = speedupStr.substr(0, speedupStr.find('.') + 3) + "x";

        std::string pctStr = std::to_string(pctComps);
        pctStr = pctStr.substr(0, pctStr.find('.') + 2) + "%";

        std::cout << std::left
                  << std::setw(6)  << dim
                  << std::setw(16) << std::fixed << std::setprecision(2) << kdBuildMs
                  << std::setw(18) << std::fixed << std::setprecision(4) << kdAvgMs
                  << std::setw(18) << std::fixed << std::setprecision(4) << bruteAvgMs
                  << std::setw(12) << speedupStr
                  << std::setw(22) << pctStr
                  << std::setw(12) << std::fixed << std::setprecision(3) << recall
                  << "\n";
    };

    for (std::size_t dim : dims) {
        benchmarkConfig(dim, Metric::Euclidean);
    }
    std::cout << std::string(104, '-') << "\n\n";

    // Short run for Cosine and Manhattan at dim = 8 and dim = 128
    std::cout << "KD-Tree vs Brute Force across Metrics (dim = 8 and dim = 128):\n";
    std::cout << std::string(104, '-') << "\n";
    std::cout << std::left
              << std::setw(12) << "Metric"
              << std::setw(6)  << "Dim"
              << std::setw(16) << "KD Build (ms)"
              << std::setw(18) << "KD Query (ms)"
              << std::setw(18) << "Brute Query (ms)"
              << std::setw(12) << "Speedup"
              << std::setw(22) << "Dist Comps (% of n)"
              << std::setw(12) << "Recall@10"
              << "\n";
    std::cout << std::string(104, '-') << "\n";

    auto benchmarkMetricConfig = [&](Metric metric, std::size_t dim) {
        const auto dataset = randomVectors(n, dim, 42);
        const auto queries = randomVectors(numQueries, dim, 1337);

        KdTreeIndex kdTree(dim, metric, 8);
        BruteForceIndex brute(dim, metric);

        for (std::size_t i = 0; i < n; ++i) {
            const VectorId id = static_cast<VectorId>(i + 1);
            kdTree.insert(id, dataset[i]);
            brute.insert(id, dataset[i]);
        }

        auto buildStart = std::chrono::steady_clock::now();
        kdTree.build();
        auto buildEnd = std::chrono::steady_clock::now();
        double kdBuildMs = std::chrono::duration<double, std::milli>(buildEnd - buildStart).count();

        SearchStats dummyStats;
        kdTree.searchWithStats(queries[0], k, dummyStats);
        brute.search(queries[0], k);

        std::size_t totalDistComps = 0;
        std::vector<std::vector<SearchResult>> kdResults(numQueries);
        auto kdStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) {
            SearchStats stats;
            kdResults[q] = kdTree.searchWithStats(queries[q], k, stats);
            totalDistComps += stats.distanceComputations;
        }
        auto kdEnd = std::chrono::steady_clock::now();
        double kdTotalMs = std::chrono::duration<double, std::milli>(kdEnd - kdStart).count();
        double kdAvgMs = kdTotalMs / static_cast<double>(numQueries);

        std::vector<std::vector<SearchResult>> bruteResults(numQueries);
        auto bruteStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) {
            bruteResults[q] = brute.search(queries[q], k);
        }
        auto bruteEnd = std::chrono::steady_clock::now();
        double bruteTotalMs = std::chrono::duration<double, std::milli>(bruteEnd - bruteStart).count();
        double bruteAvgMs = bruteTotalMs / static_cast<double>(numQueries);

        double speedup = bruteAvgMs / kdAvgMs;
        double avgComps = static_cast<double>(totalDistComps) / static_cast<double>(numQueries);
        double pctComps = (avgComps / static_cast<double>(n)) * 100.0;
        double recall = meanRecallAtK(bruteResults, kdResults);

        std::string speedupStr = std::to_string(speedup);
        speedupStr = speedupStr.substr(0, speedupStr.find('.') + 3) + "x";

        std::string pctStr = std::to_string(pctComps);
        pctStr = pctStr.substr(0, pctStr.find('.') + 2) + "%";

        std::cout << std::left
                  << std::setw(12) << metricToString(metric)
                  << std::setw(6)  << dim
                  << std::setw(16) << std::fixed << std::setprecision(2) << kdBuildMs
                  << std::setw(18) << std::fixed << std::setprecision(4) << kdAvgMs
                  << std::setw(18) << std::fixed << std::setprecision(4) << bruteAvgMs
                  << std::setw(12) << speedupStr
                  << std::setw(22) << pctStr
                  << std::setw(12) << std::fixed << std::setprecision(3) << recall
                  << "\n";
    };

    benchmarkMetricConfig(Metric::Cosine, 8);
    benchmarkMetricConfig(Metric::Cosine, 128);
    benchmarkMetricConfig(Metric::Manhattan, 8);
    benchmarkMetricConfig(Metric::Manhattan, 128);
    std::cout << std::string(104, '-') << "\n\n";
}

void runHnswBenchmark() {
    std::cout << "=========================================================================================\n";
    std::cout << "   VectorDB - Task 3: HNSW (Hierarchical Navigable Small World) Benchmark\n";
    std::cout << "=========================================================================================\n\n";

    constexpr std::size_t n = 20000;
    constexpr std::size_t dim = 128;
    constexpr std::size_t numQueries = 100;
    constexpr std::size_t k = 10;

    std::cout << "Generating dataset: n = " << n << ", dim = " << dim << " (seed=42)... " << std::flush;
    const auto dataset128 = randomVectors(n, dim, 42);
    std::cout << "Done.\n";

    std::cout << "Generating queries: " << numQueries << " queries, dim = " << dim << " (seed=1337)... " << std::flush;
    const auto queries128 = randomVectors(numQueries, dim, 1337);
    std::cout << "Done.\n\n";

    // -------------------------------------------------------------------------
    // Ground truth with BruteForceIndex for dim=128 Euclidean
    // -------------------------------------------------------------------------
    BruteForceIndex brute128(dim, Metric::Euclidean);
    for (std::size_t i = 0; i < n; ++i) {
        brute128.insert(static_cast<VectorId>(i + 1), dataset128[i]);
    }
    std::vector<std::vector<SearchResult>> bruteResults128(numQueries);
    auto bStart = std::chrono::steady_clock::now();
    for (std::size_t q = 0; q < numQueries; ++q) {
        bruteResults128[q] = brute128.search(queries128[q], k);
    }
    auto bEnd = std::chrono::steady_clock::now();
    double bruteTotalMs = std::chrono::duration<double, std::milli>(bEnd - bStart).count();
    double bruteAvgMs = bruteTotalMs / static_cast<double>(numQueries);

    // -------------------------------------------------------------------------
    // Section A: Build report (n=20000, dim=128, Euclidean, M=16, efConstruction=200)
    // -------------------------------------------------------------------------
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << "   Section A: HNSW Build Report (n = 20,000, dim = 128, M = 16, efConstruction = 200)\n";
    std::cout << "-----------------------------------------------------------------------------------------\n";

    HnswParams defaultParams;
    defaultParams.M = 16;
    defaultParams.efConstruction = 200;
    defaultParams.efSearch = 50;
    defaultParams.seed = 42;
    defaultParams.useHeuristic = true;

    HnswIndex hnsw128(dim, Metric::Euclidean, defaultParams);

    auto hBuildStart = std::chrono::steady_clock::now();
    for (std::size_t i = 0; i < n; ++i) {
        hnsw128.insert(static_cast<VectorId>(i + 1), dataset128[i]);
    }
    auto hBuildEnd = std::chrono::steady_clock::now();
    double hBuildMs = std::chrono::duration<double, std::milli>(hBuildEnd - hBuildStart).count();

    const HnswGraphInfo infoA = hnsw128.graphInfo();
    std::cout << "Build Time           : " << std::fixed << std::setprecision(2) << hBuildMs << " ms ("
              << (hBuildMs / 1000.0) << " s)\n";
    std::cout << "Total Vectors        : " << infoA.numNodes << "\n";
    std::cout << "Max Graph Level      : " << infoA.maxLevel << "\n";
    std::cout << "Entry Point Vector ID: " << infoA.entryPointId << "\n";
    std::cout << "\nLayer Distribution & Average Degree:\n";
    std::cout << "  " << std::left
              << std::setw(8)  << "Layer"
              << std::setw(16) << "Nodes"
              << std::setw(16) << "% of Total"
              << std::setw(16) << "Avg Degree"
              << "\n";
    std::cout << "  " << std::string(56, '-') << "\n";
    for (int l = infoA.maxLevel; l >= 0; --l) {
        std::size_t nodes = (l < static_cast<int>(infoA.nodesPerLayer.size())) ? infoA.nodesPerLayer[l] : 0;
        double pct = (static_cast<double>(nodes) / static_cast<double>(n)) * 100.0;
        double deg = (l < static_cast<int>(infoA.avgDegreePerLayer.size())) ? infoA.avgDegreePerLayer[l] : 0.0;
        std::cout << "  " << std::left
                  << std::setw(8)  << l
                  << std::setw(16) << nodes
                  << std::setw(16) << (std::to_string(pct).substr(0, 5) + "%")
                  << std::setw(16) << std::fixed << std::setprecision(2) << deg
                  << "\n";
    }
    std::cout << "\n";

    // -------------------------------------------------------------------------
    // Section B: efSearch sweep (ef in {10, 20, 50, 100, 200, 400}) vs BruteForce
    // -------------------------------------------------------------------------
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << "   Section B: efSearch Sweep (100 queries, k = 10, BruteForce baseline: "
              << std::fixed << std::setprecision(4) << bruteAvgMs << " ms/query)\n";
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << std::left
              << std::setw(12) << "efSearch"
              << std::setw(14) << "Recall@10"
              << std::setw(18) << "Avg Query (ms)"
              << std::setw(16) << "QPS"
              << std::setw(16) << "Speedup vs BF"
              << std::setw(22) << "Dist Comps (% of n)"
              << "\n";
    std::cout << std::string(98, '-') << "\n";

    const std::vector<std::size_t> efValues = {10, 20, 50, 100, 200, 400};
    for (std::size_t ef : efValues) {
        hnsw128.setEfSearch(ef);

        // Warmup query
        HnswSearchStats dummyStats;
        hnsw128.searchWithStats(queries128[0], k, dummyStats);

        std::size_t totalComps = 0;
        std::vector<std::vector<SearchResult>> hnswResults(numQueries);

        auto qStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) {
            HnswSearchStats stats;
            hnswResults[q] = hnsw128.searchWithStats(queries128[q], k, stats);
            totalComps += stats.distanceComputations;
        }
        auto qEnd = std::chrono::steady_clock::now();

        double totalMs = std::chrono::duration<double, std::milli>(qEnd - qStart).count();
        double avgMs = totalMs / static_cast<double>(numQueries);
        double qps = numQueries / (totalMs / 1000.0);
        double speedup = bruteAvgMs / avgMs;
        double recall = meanRecallAtK(bruteResults128, hnswResults);
        double avgComps = static_cast<double>(totalComps) / static_cast<double>(numQueries);
        double pctComps = (avgComps / static_cast<double>(n)) * 100.0;

        std::string speedupStr = std::to_string(speedup);
        speedupStr = speedupStr.substr(0, speedupStr.find('.') + 3) + "x";

        std::string pctStr = std::to_string(pctComps);
        pctStr = pctStr.substr(0, pctStr.find('.') + 3) + "%";

        std::cout << std::left
                  << std::setw(12) << ef
                  << std::setw(14) << std::fixed << std::setprecision(4) << recall
                  << std::setw(18) << std::fixed << std::setprecision(4) << avgMs
                  << std::setw(16) << std::fixed << std::setprecision(1) << qps
                  << std::setw(16) << speedupStr
                  << std::setw(22) << pctStr
                  << "\n";
    }
    std::cout << "\n";

    // -------------------------------------------------------------------------
    // Section C: M sweep (M in {8, 16, 32}, efConstruction=200, efSearch=50)
    // -------------------------------------------------------------------------
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << "   Section C: M Sweep (M in {8, 16, 32}, efConstruction = 200, efSearch = 50)\n";
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << std::left
              << std::setw(8)  << "M"
              << std::setw(16) << "Build Time (ms)"
              << std::setw(14) << "Recall@10"
              << std::setw(18) << "Avg Query (ms)"
              << std::setw(16) << "QPS"
              << std::setw(22) << "Graph Memory (KB)"
              << "\n";
    std::cout << std::string(94, '-') << "\n";

    const std::vector<std::size_t> mValues = {8, 16, 32};
    for (std::size_t m : mValues) {
        HnswParams mParams;
        mParams.M = m;
        mParams.efConstruction = 200;
        mParams.efSearch = 50;
        mParams.seed = 42;
        mParams.useHeuristic = true;

        HnswIndex mIndex(dim, Metric::Euclidean, mParams);

        auto mBuildStart = std::chrono::steady_clock::now();
        for (std::size_t i = 0; i < n; ++i) {
            mIndex.insert(static_cast<VectorId>(i + 1), dataset128[i]);
        }
        auto mBuildEnd = std::chrono::steady_clock::now();
        double mBuildMs = std::chrono::duration<double, std::milli>(mBuildEnd - mBuildStart).count();

        // Warmup
        mIndex.search(queries128[0], k);

        std::vector<std::vector<SearchResult>> mResults(numQueries);
        auto mQueryStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) {
            mResults[q] = mIndex.search(queries128[q], k);
        }
        auto mQueryEnd = std::chrono::steady_clock::now();

        double mTotalMs = std::chrono::duration<double, std::milli>(mQueryEnd - mQueryStart).count();
        double mAvgMs = mTotalMs / static_cast<double>(numQueries);
        double mQps = numQueries / (mTotalMs / 1000.0);
        double mRecall = meanRecallAtK(bruteResults128, mResults);

        // Memory estimate: total neighbor entries across all layers * sizeof(uint32_t)
        const HnswGraphInfo gInfo = mIndex.graphInfo();
        double totalNeighborEntries = 0;
        for (std::size_t l = 0; l < gInfo.nodesPerLayer.size(); ++l) {
            totalNeighborEntries += static_cast<double>(gInfo.nodesPerLayer[l]) * gInfo.avgDegreePerLayer[l];
        }
        double memKb = (totalNeighborEntries * sizeof(std::uint32_t)) / 1024.0;

        std::cout << std::left
                  << std::setw(8)  << m
                  << std::setw(16) << std::fixed << std::setprecision(2) << mBuildMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << mRecall
                  << std::setw(18) << std::fixed << std::setprecision(4) << mAvgMs
                  << std::setw(16) << std::fixed << std::setprecision(1) << mQps
                  << std::setw(22) << std::fixed << std::setprecision(1) << memKb
                  << "\n";
    }
    std::cout << "\n";

    // -------------------------------------------------------------------------
    // Section D: Three-way comparison across dimensions (n=20000, k=10, Euclidean)
    // -------------------------------------------------------------------------
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << "   Section D: Three-Way Comparison: Brute Force vs KD-Tree vs HNSW\n";
    std::cout << "   (n = 20,000, k = 10, Euclidean, HNSW M=16, efC=200, efS=100)\n";
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << std::left
              << std::setw(6)  << "Dim"
              << std::setw(18) << "Brute Query (ms)"
              << std::setw(18) << "KD Query (ms)"
              << std::setw(18) << "HNSW Query (ms)"
              << std::setw(16) << "HNSW Recall"
              << std::setw(18) << "HNSW vs BF Speedup"
              << "\n";
    std::cout << std::string(94, '-') << "\n";

    const std::vector<std::size_t> testDims = {8, 16, 32, 64, 128};
    for (std::size_t d : testDims) {
        // Reuse dataset128 for dim 128 to save generation time
        const auto ds = (d == 128) ? dataset128 : randomVectors(n, d, 42);
        const auto qs = (d == 128) ? queries128 : randomVectors(numQueries, d, 1337);

        // Brute Force
        BruteForceIndex bf(d, Metric::Euclidean);
        for (std::size_t i = 0; i < n; ++i) bf.insert(static_cast<VectorId>(i + 1), ds[i]);
        std::vector<std::vector<SearchResult>> bfRes(numQueries);
        auto bfStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) bfRes[q] = bf.search(qs[q], k);
        auto bfEnd = std::chrono::steady_clock::now();
        double bfAvgMs = std::chrono::duration<double, std::milli>(bfEnd - bfStart).count() / static_cast<double>(numQueries);

        // KD-Tree
        KdTreeIndex kd(d, Metric::Euclidean, 8);
        for (std::size_t i = 0; i < n; ++i) kd.insert(static_cast<VectorId>(i + 1), ds[i]);
        kd.build();
        auto kdStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) kd.search(qs[q], k);
        auto kdEnd = std::chrono::steady_clock::now();
        double kdAvgMs = std::chrono::duration<double, std::milli>(kdEnd - kdStart).count() / static_cast<double>(numQueries);

        // HNSW
        HnswParams dParams;
        dParams.M = 16;
        dParams.efConstruction = 200;
        dParams.efSearch = 100;
        dParams.seed = 42;
        dParams.useHeuristic = true;

        HnswIndex hnsw(d, Metric::Euclidean, dParams);
        for (std::size_t i = 0; i < n; ++i) hnsw.insert(static_cast<VectorId>(i + 1), ds[i]);

        std::vector<std::vector<SearchResult>> hnswRes(numQueries);
        auto hnswStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) hnswRes[q] = hnsw.search(qs[q], k);
        auto hnswEnd = std::chrono::steady_clock::now();
        double hnswAvgMs = std::chrono::duration<double, std::milli>(hnswEnd - hnswStart).count() / static_cast<double>(numQueries);

        double speedup = bfAvgMs / hnswAvgMs;
        double recall = meanRecallAtK(bfRes, hnswRes);

        std::string speedupStr = std::to_string(speedup);
        speedupStr = speedupStr.substr(0, speedupStr.find('.') + 3) + "x";

        std::cout << std::left
                  << std::setw(6)  << d
                  << std::setw(18) << std::fixed << std::setprecision(4) << bfAvgMs
                  << std::setw(18) << std::fixed << std::setprecision(4) << kdAvgMs
                  << std::setw(18) << std::fixed << std::setprecision(4) << hnswAvgMs
                  << std::setw(16) << std::fixed << std::setprecision(4) << recall
                  << std::setw(18) << speedupStr
                  << "\n";
    }
    std::cout << "\n";

    // -------------------------------------------------------------------------
    // Section E: Cosine and Manhattan at dim=128 with efSearch=100
    // -------------------------------------------------------------------------
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << "   Section E: Non-Euclidean Metrics (dim = 128, efSearch = 100, M = 16, efC = 200)\n";
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << std::left
              << std::setw(14) << "Metric"
              << std::setw(18) << "HNSW Query (ms)"
              << std::setw(18) << "Brute Query (ms)"
              << std::setw(16) << "Speedup"
              << std::setw(16) << "Recall@10"
              << "\n";
    std::cout << std::string(82, '-') << "\n";

    const std::vector<Metric> otherMetrics = {Metric::Cosine, Metric::Manhattan};
    for (Metric m : otherMetrics) {
        // Brute Force
        BruteForceIndex bf(dim, m);
        for (std::size_t i = 0; i < n; ++i) bf.insert(static_cast<VectorId>(i + 1), dataset128[i]);
        std::vector<std::vector<SearchResult>> bfRes(numQueries);
        auto bfStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) bfRes[q] = bf.search(queries128[q], k);
        auto bfEnd = std::chrono::steady_clock::now();
        double bfAvgMs = std::chrono::duration<double, std::milli>(bfEnd - bfStart).count() / static_cast<double>(numQueries);

        // HNSW
        HnswParams mParams;
        mParams.M = 16;
        mParams.efConstruction = 200;
        mParams.efSearch = 100;
        mParams.seed = 42;
        mParams.useHeuristic = true;

        HnswIndex hnsw(dim, m, mParams);
        for (std::size_t i = 0; i < n; ++i) hnsw.insert(static_cast<VectorId>(i + 1), dataset128[i]);

        std::vector<std::vector<SearchResult>> hnswRes(numQueries);
        auto hnswStart = std::chrono::steady_clock::now();
        for (std::size_t q = 0; q < numQueries; ++q) hnswRes[q] = hnsw.search(queries128[q], k);
        auto hnswEnd = std::chrono::steady_clock::now();
        double hnswAvgMs = std::chrono::duration<double, std::milli>(hnswEnd - hnswStart).count() / static_cast<double>(numQueries);

        double speedup = bfAvgMs / hnswAvgMs;
        double recall = meanRecallAtK(bfRes, hnswRes);

        std::string speedupStr = std::to_string(speedup);
        speedupStr = speedupStr.substr(0, speedupStr.find('.') + 3) + "x";

        std::cout << std::left
                  << std::setw(14) << metricToString(m)
                  << std::setw(18) << std::fixed << std::setprecision(4) << hnswAvgMs
                  << std::setw(18) << std::fixed << std::setprecision(4) << bfAvgMs
                  << std::setw(16) << speedupStr
                  << std::setw(16) << std::fixed << std::setprecision(4) << recall
                  << "\n";
    }
    std::cout << std::string(82, '-') << "\n\n";
}

int main() {
    try {
        runDemo();
        runBenchmark();
        runKdTreeBenchmark();
        runHnswBenchmark();
    } catch (const std::exception& e) {
        std::cerr << "Fatal error: " << e.what() << "\n";
        return 1;
    }
    return 0;
}
