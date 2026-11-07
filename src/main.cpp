#include "vectordb/types.hpp"
#include "vectordb/distance.hpp"
#include "vectordb/brute_force.hpp"
#include "vectordb/kd_tree.hpp"
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

int main() {
    try {
        runDemo();
        runBenchmark();
        runKdTreeBenchmark();
    } catch (const std::exception& e) {
        std::cerr << "Fatal error: " << e.what() << "\n";
        return 1;
    }
    return 0;
}
