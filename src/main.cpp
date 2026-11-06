#include "vectordb/types.hpp"
#include "vectordb/distance.hpp"
#include "vectordb/brute_force.hpp"
#include "vectordb/dataset.hpp"

#include <iostream>
#include <iomanip>
#include <chrono>
#include <vector>

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
            // Volatile read / dummy use to prevent compiler optimizing out the search
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
    std::cout << "Benchmark completed successfully.\n";
}

int main() {
    try {
        runDemo();
        runBenchmark();
    } catch (const std::exception& e) {
        std::cerr << "Fatal error: " << e.what() << "\n";
        return 1;
    }
    return 0;
}
