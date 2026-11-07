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
#include <algorithm>
#include <thread>
#include <ctime>
#include <sstream>
#include <fstream>
#include <filesystem>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#endif

using namespace vectordb;

// -----------------------------------------------------------------------------
// System & Hardware Information Helpers
// -----------------------------------------------------------------------------

static std::string getCpuName() {
#ifdef _WIN32
    HKEY hKey;
    if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, "HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
        char buf[256];
        DWORD bufSize = sizeof(buf);
        if (RegQueryValueExA(hKey, "ProcessorNameString", nullptr, nullptr, reinterpret_cast<LPBYTE>(buf), &bufSize) == ERROR_SUCCESS) {
            RegCloseKey(hKey);
            std::string name(buf);
            // Trim leading spaces if any
            size_t start = name.find_first_not_of(" \t");
            return (start == std::string::npos) ? name : name.substr(start);
        }
        RegCloseKey(hKey);
    }
    const char* env = std::getenv("PROCESSOR_IDENTIFIER");
    return env ? std::string(env) : "x86_64 Processor";
#else
    return "Generic x86_64";
#endif
}

static std::string getTotalRam() {
#ifdef _WIN32
    MEMORYSTATUSEX memStatus;
    memStatus.dwLength = sizeof(memStatus);
    if (GlobalMemoryStatusEx(&memStatus)) {
        double gb = static_cast<double>(memStatus.ullTotalPhys) / (1024.0 * 1024.0 * 1024.0);
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(1) << gb << " GB";
        return oss.str();
    }
#endif
    return "Unknown RAM";
}

static void printSystemInfo(bool quickMode, std::size_t nFull, std::size_t repetitions) {
    std::cout << "=========================================================================================\n";
    std::cout << "   BENCHMARK ENVIRONMENT & SYSTEM INFORMATION\n";
    std::cout << "=========================================================================================\n";
    std::time_t now = std::time(nullptr);
    char timeBuf[64];
    std::strftime(timeBuf, sizeof(timeBuf), "%Y-%m-%d %H:%M:%S", std::localtime(&now));
    std::cout << "  Date & Time      : " << timeBuf << "\n";
    std::cout << "  CPU Model        : " << getCpuName() << "\n";
    std::cout << "  Logical Cores    : " << std::thread::hardware_concurrency() << "\n";
    std::cout << "  Total RAM        : " << getTotalRam() << "\n";
    std::cout << "  Compiler         : GCC " << __VERSION__ << "\n";
#ifdef NDEBUG
    std::cout << "  Build Type       : Release (-O3 -DNDEBUG)\n";
#else
    std::cout << "  Build Type       : Debug\n";
#endif
    std::cout << "  Compiler Flags   : -Wall -Wextra -Wpedantic -std=c++17\n";
    std::cout << "  Benchmark Mode   : " << (quickMode ? "QUICK (--quick)" : "FULL (Default)")
              << " [n = " << nFull << ", Repetitions = " << repetitions << "]\n";
    std::cout << "  Methodology      : 1 warm-up pass + " << repetitions
              << " timed repetitions over identical query set.\n";
    std::cout << "                     Reports MEDIAN of per-repetition avg query time (plus min and max).\n";
    std::cout << "                     BruteForce measured ONCE per (n, dim, metric) and reused as baseline.\n";
    std::cout << "                     Single-threaded query execution, identical random seeds.\n";
    std::cout << "\n  [IMPORTANT NOTE] Please close all other applications before running to eliminate\n";
    std::cout << "                   operating system scheduling jitter and background load.\n";
    std::cout << "=========================================================================================\n\n";
}

// -----------------------------------------------------------------------------
// Timing Harness
// -----------------------------------------------------------------------------

struct TimingResult {
    double medianMs = 0.0;
    double minMs = 0.0;
    double maxMs = 0.0;
    double qps = 0.0;
};

template <typename Func>
static TimingResult measureTiming(std::size_t numQueries, std::size_t repetitions, Func&& runPass) {
    std::vector<double> repTimes(repetitions, 0.0);
    for (std::size_t r = 0; r < repetitions; ++r) {
        auto start = std::chrono::steady_clock::now();
        runPass();
        auto end = std::chrono::steady_clock::now();
        double totalMs = std::chrono::duration<double, std::milli>(end - start).count();
        repTimes[r] = totalMs / static_cast<double>(numQueries);
    }
    std::sort(repTimes.begin(), repTimes.end());
    TimingResult res;
    res.minMs = repTimes.front();
    res.maxMs = repTimes.back();
    if (repetitions % 2 == 1) {
        res.medianMs = repTimes[repetitions / 2];
    } else {
        res.medianMs = 0.5 * (repTimes[repetitions / 2 - 1] + repTimes[repetitions / 2]);
    }
    res.qps = (res.medianMs > 0.0) ? (1000.0 / res.medianMs) : 0.0;
    return res;
}

// -----------------------------------------------------------------------------
// Task 1 Interactive Demo
// -----------------------------------------------------------------------------

void runDemo() {
    std::cout << "========================================================\n";
    std::cout << "   VectorDB - Semantic Search Engine (Task 1 Demo)\n";
    std::cout << "========================================================\n\n";

    const std::vector<std::pair<VectorId, std::vector<float>>> items = {
        {101, { 1.0f,  0.0f}},
        {102, { 0.0f,  1.0f}},
        {103, { 0.7071f, 0.7071f}},
        {104, {-1.0f,  0.0f}},
        {105, { 0.0f, -1.0f}}
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

// -----------------------------------------------------------------------------
// Task 1 Mini Benchmark (BruteForceIndex)
// -----------------------------------------------------------------------------

void runBenchmark(bool quickMode) {
    const std::size_t n = quickMode ? 2000 : 10000;
    constexpr std::size_t dim = 128;
    constexpr std::size_t numQueries = 100;
    constexpr std::size_t k = 10;
    const std::size_t repetitions = quickMode ? 3 : 5;

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
              << std::setw(18) << "Median Query (ms)"
              << std::setw(14) << "Min (ms)"
              << std::setw(14) << "Max (ms)"
              << std::setw(16) << "QPS (median)"
              << "\n";
    std::cout << std::string(90, '-') << "\n";

    for (Metric metric : metrics) {
        auto buildStart = std::chrono::steady_clock::now();
        BruteForceIndex index(dim, metric);
        for (std::size_t i = 0; i < n; ++i) {
            index.insert(static_cast<VectorId>(i + 1), dataset[i]);
        }
        auto buildEnd = std::chrono::steady_clock::now();
        double buildMs = std::chrono::duration<double, std::milli>(buildEnd - buildStart).count();

        // 1 warmup pass
        for (std::size_t q = 0; q < numQueries; ++q) {
            index.search(queries[q], k);
        }

        // Repetitions
        TimingResult timing = measureTiming(numQueries, repetitions, [&]() {
            for (std::size_t q = 0; q < numQueries; ++q) {
                index.search(queries[q], k);
            }
        });

        std::cout << std::left
                  << std::setw(12) << metricToString(metric)
                  << std::setw(16) << std::fixed << std::setprecision(2) << buildMs
                  << std::setw(18) << std::fixed << std::setprecision(4) << timing.medianMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << timing.minMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << timing.maxMs
                  << std::setw(16) << std::fixed << std::setprecision(1) << timing.qps
                  << "\n";
    }

    std::cout << std::string(90, '-') << "\n\n";
}

// -----------------------------------------------------------------------------
// Task 2 KD-Tree Dimension Scaling Benchmark
// -----------------------------------------------------------------------------

void runKdTreeBenchmark(bool quickMode) {
    const std::size_t n = quickMode ? 2000 : 20000;
    constexpr std::size_t numQueries = 100;
    constexpr std::size_t k = 10;
    const std::size_t repetitions = quickMode ? 3 : 5;
    const std::vector<std::size_t> dims = {2, 4, 8, 16, 32, 64, 128};

    std::cout << "=========================================================================================\n";
    std::cout << "   KD-Tree vs Brute Force: Dimension Scaling Benchmark (Hardened Methodology)\n";
    std::cout << "   Dataset: n = " << n << ", Queries = " << numQueries << ", k = " << k << ", Metric = Euclidean\n";
    std::cout << "=========================================================================================\n\n";

    std::cout << std::left
              << std::setw(6)  << "Dim"
              << std::setw(16) << "KD Build (ms)"
              << std::setw(16) << "KD Median (ms)"
              << std::setw(14) << "KD Min (ms)"
              << std::setw(14) << "KD Max (ms)"
              << std::setw(16) << "BF Median (ms)"
              << std::setw(12) << "Speedup"
              << std::setw(20) << "Dist Comps (% of n)"
              << std::setw(12) << "Recall@10"
              << "\n";
    std::cout << std::string(126, '-') << "\n";

    for (std::size_t dim : dims) {
        const auto dataset = randomVectors(n, dim, 42);
        const auto queries = randomVectors(numQueries, dim, 1337);

        // 1. Build Brute Force once
        BruteForceIndex brute(dim, Metric::Euclidean);
        for (std::size_t i = 0; i < n; ++i) {
            brute.insert(static_cast<VectorId>(i + 1), dataset[i]);
        }
        std::vector<std::vector<SearchResult>> groundTruth(numQueries);
        for (std::size_t q = 0; q < numQueries; ++q) {
            groundTruth[q] = brute.search(queries[q], k);
        }
        TimingResult bfTiming = measureTiming(numQueries, repetitions, [&]() {
            for (std::size_t q = 0; q < numQueries; ++q) {
                brute.search(queries[q], k);
            }
        });

        // 2. Build KD-Tree once
        KdTreeIndex kdTree(dim, Metric::Euclidean, 8);
        for (std::size_t i = 0; i < n; ++i) {
            kdTree.insert(static_cast<VectorId>(i + 1), dataset[i]);
        }
        auto buildStart = std::chrono::steady_clock::now();
        kdTree.build();
        auto buildEnd = std::chrono::steady_clock::now();
        double kdBuildMs = std::chrono::duration<double, std::milli>(buildEnd - buildStart).count();

        // Warmup & collect stats and results
        std::size_t totalDistComps = 0;
        std::vector<std::vector<SearchResult>> kdResults(numQueries);
        for (std::size_t q = 0; q < numQueries; ++q) {
            SearchStats stats;
            kdResults[q] = kdTree.searchWithStats(queries[q], k, stats);
            totalDistComps += stats.distanceComputations;
        }

        TimingResult kdTiming = measureTiming(numQueries, repetitions, [&]() {
            for (std::size_t q = 0; q < numQueries; ++q) {
                kdTree.search(queries[q], k);
            }
        });

        double speedup = (kdTiming.medianMs > 0.0) ? (bfTiming.medianMs / kdTiming.medianMs) : 0.0;
        double avgComps = static_cast<double>(totalDistComps) / static_cast<double>(numQueries);
        double pctComps = (avgComps / static_cast<double>(n)) * 100.0;
        double recall = meanRecallAtK(groundTruth, kdResults);

        std::string speedupStr = std::to_string(speedup);
        speedupStr = speedupStr.substr(0, speedupStr.find('.') + 3) + "x";

        std::string pctStr = std::to_string(pctComps);
        pctStr = pctStr.substr(0, pctStr.find('.') + 2) + "%";

        std::cout << std::left
                  << std::setw(6)  << dim
                  << std::setw(16) << std::fixed << std::setprecision(2) << kdBuildMs
                  << std::setw(16) << std::fixed << std::setprecision(4) << kdTiming.medianMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << kdTiming.minMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << kdTiming.maxMs
                  << std::setw(16) << std::fixed << std::setprecision(4) << bfTiming.medianMs
                  << std::setw(12) << speedupStr
                  << std::setw(20) << pctStr
                  << std::setw(12) << std::fixed << std::setprecision(3) << recall
                  << "\n";
    }
    std::cout << std::string(126, '-') << "\n\n";
}

// -----------------------------------------------------------------------------
// Task 3 HNSW Benchmark (Hardened Methodology)
// -----------------------------------------------------------------------------

void runHnswBenchmark(bool quickMode) {
    const std::size_t n = quickMode ? 2000 : 20000;
    constexpr std::size_t dim = 128;
    constexpr std::size_t numQueries = 100;
    constexpr std::size_t k = 10;
    const std::size_t repetitions = quickMode ? 3 : 5;

    std::cout << "=========================================================================================\n";
    std::cout << "   VectorDB - Task 3: HNSW Benchmark (Hardened Methodology)\n";
    std::cout << "   n = " << n << ", dim = " << dim << ", Repetitions = " << repetitions << "\n";
    std::cout << "=========================================================================================\n\n";

    std::cout << "Generating dataset: n = " << n << ", dim = " << dim << " (seed=42)... " << std::flush;
    const auto dataset128 = randomVectors(n, dim, 42);
    std::cout << "Done.\n";

    std::cout << "Generating queries: " << numQueries << " queries, dim = " << dim << " (seed=1337)... " << std::flush;
    const auto queries128 = randomVectors(numQueries, dim, 1337);
    std::cout << "Done.\n\n";

    // -------------------------------------------------------------------------
    // Measure BruteForceIndex ONCE for dim=128 Euclidean
    // -------------------------------------------------------------------------
    std::cout << "Building Brute Force index once for dim=128 Euclidean... " << std::flush;
    BruteForceIndex brute128(dim, Metric::Euclidean);
    for (std::size_t i = 0; i < n; ++i) {
        brute128.insert(static_cast<VectorId>(i + 1), dataset128[i]);
    }
    std::cout << "Done.\nMeasuring Brute Force baseline (1 warmup + " << repetitions << " repetitions)... " << std::flush;
    std::vector<std::vector<SearchResult>> bruteResults128(numQueries);
    for (std::size_t q = 0; q < numQueries; ++q) {
        bruteResults128[q] = brute128.search(queries128[q], k);
    }
    TimingResult bf128Timing = measureTiming(numQueries, repetitions, [&]() {
        for (std::size_t q = 0; q < numQueries; ++q) {
            brute128.search(queries128[q], k);
        }
    });
    std::cout << "Median = " << std::fixed << std::setprecision(4) << bf128Timing.medianMs
              << " ms (min: " << bf128Timing.minMs << " ms, max: " << bf128Timing.maxMs << " ms)\n\n";

    // -------------------------------------------------------------------------
    // Section A: Build report (M=16, efConstruction=200)
    // -------------------------------------------------------------------------
    std::filesystem::create_directories("results");

    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << "   Section A: HNSW Build Report (n = " << n << ", dim = " << dim
              << ", M = 16, efConstruction = 200)\n";
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

    std::ofstream buildCsv("results/build.csv");
    if (buildCsv.is_open()) {
        buildCsv << "n,dim,metric,M,efConstruction,seed,build_time_ms,max_level,entry_point_id,layer,nodes,pct_of_total,avg_degree\n";
    }

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

        if (buildCsv.is_open()) {
            buildCsv << n << "," << dim << "," << metricToString(Metric::Euclidean) << ","
                     << defaultParams.M << "," << defaultParams.efConstruction << "," << defaultParams.seed << ","
                     << std::fixed << std::setprecision(2) << hBuildMs << ","
                     << infoA.maxLevel << "," << infoA.entryPointId << ","
                     << l << "," << nodes << "," << std::setprecision(4) << pct << ","
                     << std::setprecision(2) << deg << "\n";
        }
    }
    if (buildCsv.is_open()) {
        buildCsv.close();
    }
    std::cout << "\n";

    // -------------------------------------------------------------------------
    // Section B: efSearch sweep (Reusing hnsw128 built above)
    // -------------------------------------------------------------------------
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << "   Section B: efSearch Sweep (100 queries, k = 10, BruteForce baseline median: "
              << std::fixed << std::setprecision(4) << bf128Timing.medianMs << " ms)\n";
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << std::left
              << std::setw(10) << "efSearch"
              << std::setw(12) << "Recall@10"
              << std::setw(18) << "Median Query (ms)"
              << std::setw(14) << "Min (ms)"
              << std::setw(14) << "Max (ms)"
              << std::setw(14) << "QPS (med)"
              << std::setw(16) << "Speedup vs BF"
              << std::setw(20) << "Dist Comps (% of n)"
              << "\n";
    std::cout << std::string(118, '-') << "\n";

    std::ofstream efCsv("results/ef_sweep.csv");
    if (efCsv.is_open()) {
        efCsv << "n,dim,metric,M,efConstruction,efSearch,seed,recall_at_10,median_query_ms,min_query_ms,max_query_ms,qps_median,speedup_vs_bf,dist_comps_pct,avg_dist_comps,bf_median_query_ms\n";
    }

    const std::vector<std::size_t> efValues = {10, 20, 50, 100, 200, 400};
    for (std::size_t ef : efValues) {
        hnsw128.setEfSearch(ef);

        // Warmup & collect stats and recall
        std::size_t totalComps = 0;
        std::vector<std::vector<SearchResult>> hnswResults(numQueries);
        for (std::size_t q = 0; q < numQueries; ++q) {
            HnswSearchStats stats;
            hnswResults[q] = hnsw128.searchWithStats(queries128[q], k, stats);
            totalComps += stats.distanceComputations;
        }

        // Repetitions
        TimingResult timing = measureTiming(numQueries, repetitions, [&]() {
            for (std::size_t q = 0; q < numQueries; ++q) {
                hnsw128.search(queries128[q], k);
            }
        });

        double speedup = (timing.medianMs > 0.0) ? (bf128Timing.medianMs / timing.medianMs) : 0.0;
        double recall = meanRecallAtK(bruteResults128, hnswResults);
        double avgComps = static_cast<double>(totalComps) / static_cast<double>(numQueries);
        double pctComps = (avgComps / static_cast<double>(n)) * 100.0;

        std::string speedupStr = std::to_string(speedup);
        speedupStr = speedupStr.substr(0, speedupStr.find('.') + 3) + "x";

        std::string pctStr = std::to_string(pctComps);
        pctStr = pctStr.substr(0, pctStr.find('.') + 3) + "%";

        std::cout << std::left
                  << std::setw(10) << ef
                  << std::setw(12) << std::fixed << std::setprecision(4) << recall
                  << std::setw(18) << std::fixed << std::setprecision(4) << timing.medianMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << timing.minMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << timing.maxMs
                  << std::setw(14) << std::fixed << std::setprecision(1) << timing.qps
                  << std::setw(16) << speedupStr
                  << std::setw(20) << pctStr
                  << "\n";

        if (efCsv.is_open()) {
            efCsv << n << "," << dim << "," << metricToString(Metric::Euclidean) << ","
                  << defaultParams.M << "," << defaultParams.efConstruction << "," << ef << "," << defaultParams.seed << ","
                  << std::fixed << std::setprecision(4) << recall << ","
                  << timing.medianMs << "," << timing.minMs << "," << timing.maxMs << ","
                  << std::setprecision(1) << timing.qps << ","
                  << std::setprecision(2) << speedup << ","
                  << std::setprecision(2) << pctComps << ","
                  << std::setprecision(1) << avgComps << ","
                  << std::setprecision(4) << bf128Timing.medianMs << "\n";
        }
    }
    if (efCsv.is_open()) {
        efCsv.close();
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
              << std::setw(12) << "Recall@10"
              << std::setw(18) << "Median Query (ms)"
              << std::setw(14) << "Min (ms)"
              << std::setw(14) << "Max (ms)"
              << std::setw(14) << "QPS (med)"
              << std::setw(20) << "Graph Memory (KB)"
              << "\n";
    std::cout << std::string(116, '-') << "\n";

    std::ofstream mCsv("results/m_sweep.csv");
    if (mCsv.is_open()) {
        mCsv << "n,dim,metric,M,efConstruction,efSearch,seed,build_time_ms,recall_at_10,median_query_ms,min_query_ms,max_query_ms,qps_median,graph_memory_kb,bf_median_query_ms\n";
    }

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

        // Warmup & recall
        std::vector<std::vector<SearchResult>> mResults(numQueries);
        for (std::size_t q = 0; q < numQueries; ++q) {
            mResults[q] = mIndex.search(queries128[q], k);
        }

        TimingResult mTiming = measureTiming(numQueries, repetitions, [&]() {
            for (std::size_t q = 0; q < numQueries; ++q) {
                mIndex.search(queries128[q], k);
            }
        });

        double mRecall = meanRecallAtK(bruteResults128, mResults);

        const HnswGraphInfo gInfo = mIndex.graphInfo();
        double totalNeighborEntries = 0;
        for (std::size_t l = 0; l < gInfo.nodesPerLayer.size(); ++l) {
            totalNeighborEntries += static_cast<double>(gInfo.nodesPerLayer[l]) * gInfo.avgDegreePerLayer[l];
        }
        double memKb = (totalNeighborEntries * sizeof(std::uint32_t)) / 1024.0;

        std::cout << std::left
                  << std::setw(8)  << m
                  << std::setw(16) << std::fixed << std::setprecision(2) << mBuildMs
                  << std::setw(12) << std::fixed << std::setprecision(4) << mRecall
                  << std::setw(18) << std::fixed << std::setprecision(4) << mTiming.medianMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << mTiming.minMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << mTiming.maxMs
                  << std::setw(14) << std::fixed << std::setprecision(1) << mTiming.qps
                  << std::setw(20) << std::fixed << std::setprecision(1) << memKb
                  << "\n";

        if (mCsv.is_open()) {
            mCsv << n << "," << dim << "," << metricToString(Metric::Euclidean) << ","
                 << m << "," << mParams.efConstruction << "," << mParams.efSearch << "," << mParams.seed << ","
                 << std::fixed << std::setprecision(2) << mBuildMs << ","
                 << std::setprecision(4) << mRecall << ","
                 << mTiming.medianMs << "," << mTiming.minMs << "," << mTiming.maxMs << ","
                 << std::setprecision(1) << mTiming.qps << ","
                 << std::setprecision(1) << memKb << ","
                 << std::setprecision(4) << bf128Timing.medianMs << "\n";
        }
    }
    if (mCsv.is_open()) {
        mCsv.close();
    }
    std::cout << "\n";

    // -------------------------------------------------------------------------
    // Section D: Three-way comparison across dimensions (n=20000, k=10, Euclidean)
    // -------------------------------------------------------------------------
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << "   Section D: Three-Way Comparison: Brute Force vs KD-Tree vs HNSW\n";
    std::cout << "   (n = " << n << ", k = 10, Euclidean, HNSW M=16, efC=200, efS=100)\n";
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << std::left
              << std::setw(6)  << "Dim"
              << std::setw(16) << "BF Med (ms)"
              << std::setw(16) << "KD Med (ms)"
              << std::setw(16) << "HNSW Med (ms)"
              << std::setw(14) << "HNSW Min"
              << std::setw(14) << "HNSW Max"
              << std::setw(14) << "HNSW Recall"
              << std::setw(18) << "HNSW vs BF Speedup"
              << "\n";
    std::cout << std::string(114, '-') << "\n";

    std::ofstream dimCsv("results/dim_compare.csv");
    if (dimCsv.is_open()) {
        dimCsv << "n,dim,metric,k,seed,bf_median_ms,bf_min_ms,bf_max_ms,kd_median_ms,kd_min_ms,kd_max_ms,kd_speedup,kd_recall,hnsw_median_ms,hnsw_min_ms,hnsw_max_ms,hnsw_speedup,hnsw_recall\n";
    }

    const std::vector<std::size_t> testDims = {8, 16, 32, 64, 128};
    for (std::size_t d : testDims) {
        const auto ds = (d == 128) ? dataset128 : randomVectors(n, d, 42);
        const auto qs = (d == 128) ? queries128 : randomVectors(numQueries, d, 1337);

        // 1. Brute Force (measured once)
        BruteForceIndex bf(d, Metric::Euclidean);
        for (std::size_t i = 0; i < n; ++i) bf.insert(static_cast<VectorId>(i + 1), ds[i]);
        std::vector<std::vector<SearchResult>> bfRes(numQueries);
        for (std::size_t q = 0; q < numQueries; ++q) bfRes[q] = bf.search(qs[q], k);
        TimingResult bfTiming = measureTiming(numQueries, repetitions, [&]() {
            for (std::size_t q = 0; q < numQueries; ++q) bf.search(qs[q], k);
        });

        // 2. KD-Tree
        KdTreeIndex kd(d, Metric::Euclidean, 8);
        for (std::size_t i = 0; i < n; ++i) kd.insert(static_cast<VectorId>(i + 1), ds[i]);
        kd.build();
        std::vector<std::vector<SearchResult>> kdRes(numQueries);
        for (std::size_t q = 0; q < numQueries; ++q) kdRes[q] = kd.search(qs[q], k);
        TimingResult kdTiming = measureTiming(numQueries, repetitions, [&]() {
            for (std::size_t q = 0; q < numQueries; ++q) kd.search(qs[q], k);
        });

        // 3. HNSW
        HnswParams dParams;
        dParams.M = 16;
        dParams.efConstruction = 200;
        dParams.efSearch = 100;
        dParams.seed = 42;
        dParams.useHeuristic = true;

        HnswIndex hnsw(d, Metric::Euclidean, dParams);
        for (std::size_t i = 0; i < n; ++i) hnsw.insert(static_cast<VectorId>(i + 1), ds[i]);

        std::vector<std::vector<SearchResult>> hnswRes(numQueries);
        for (std::size_t q = 0; q < numQueries; ++q) hnswRes[q] = hnsw.search(qs[q], k);
        TimingResult hnswTiming = measureTiming(numQueries, repetitions, [&]() {
            for (std::size_t q = 0; q < numQueries; ++q) hnsw.search(qs[q], k);
        });

        double speedup = (hnswTiming.medianMs > 0.0) ? (bfTiming.medianMs / hnswTiming.medianMs) : 0.0;
        double recall = meanRecallAtK(bfRes, hnswRes);
        double kdSpeedup = (kdTiming.medianMs > 0.0) ? (bfTiming.medianMs / kdTiming.medianMs) : 0.0;
        double kdRecall = meanRecallAtK(bfRes, kdRes);

        std::string speedupStr = std::to_string(speedup);
        speedupStr = speedupStr.substr(0, speedupStr.find('.') + 3) + "x";

        std::cout << std::left
                  << std::setw(6)  << d
                  << std::setw(16) << std::fixed << std::setprecision(4) << bfTiming.medianMs
                  << std::setw(16) << std::fixed << std::setprecision(4) << kdTiming.medianMs
                  << std::setw(16) << std::fixed << std::setprecision(4) << hnswTiming.medianMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << hnswTiming.minMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << hnswTiming.maxMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << recall
                  << std::setw(18) << speedupStr
                  << "\n";

        if (dimCsv.is_open()) {
            dimCsv << n << "," << d << "," << metricToString(Metric::Euclidean) << "," << k << "," << 42 << ","
                   << std::fixed << std::setprecision(4) << bfTiming.medianMs << "," << bfTiming.minMs << "," << bfTiming.maxMs << ","
                   << kdTiming.medianMs << "," << kdTiming.minMs << "," << kdTiming.maxMs << ","
                   << std::setprecision(2) << kdSpeedup << "," << std::setprecision(4) << kdRecall << ","
                   << hnswTiming.medianMs << "," << hnswTiming.minMs << "," << hnswTiming.maxMs << ","
                   << std::setprecision(2) << speedup << "," << std::setprecision(4) << recall << "\n";
        }
    }
    if (dimCsv.is_open()) {
        dimCsv.close();
    }
    std::cout << "\n";

    // -------------------------------------------------------------------------
    // Section E: Non-Euclidean Metrics (dim=128, efSearch=100)
    // -------------------------------------------------------------------------
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << "   Section E: Non-Euclidean Metrics (dim = 128, efSearch = 100, M = 16, efC = 200)\n";
    std::cout << "-----------------------------------------------------------------------------------------\n";
    std::cout << std::left
              << std::setw(12) << "Metric"
              << std::setw(16) << "BF Med (ms)"
              << std::setw(16) << "HNSW Med (ms)"
              << std::setw(14) << "HNSW Min"
              << std::setw(14) << "HNSW Max"
              << std::setw(14) << "Speedup"
              << std::setw(14) << "Recall@10"
              << "\n";
    std::cout << std::string(100, '-') << "\n";

    std::ofstream metricCsv("results/metrics.csv");
    if (metricCsv.is_open()) {
        metricCsv << "n,dim,metric,M,efConstruction,efSearch,seed,bf_median_ms,hnsw_median_ms,hnsw_min_ms,hnsw_max_ms,speedup_vs_bf,recall_at_10\n";
    }

    const std::vector<Metric> otherMetrics = {Metric::Cosine, Metric::Manhattan};
    for (Metric m : otherMetrics) {
        // Brute Force measured once
        BruteForceIndex bf(dim, m);
        for (std::size_t i = 0; i < n; ++i) bf.insert(static_cast<VectorId>(i + 1), dataset128[i]);
        std::vector<std::vector<SearchResult>> bfRes(numQueries);
        for (std::size_t q = 0; q < numQueries; ++q) bfRes[q] = bf.search(queries128[q], k);
        TimingResult bfTiming = measureTiming(numQueries, repetitions, [&]() {
            for (std::size_t q = 0; q < numQueries; ++q) bf.search(queries128[q], k);
        });

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
        for (std::size_t q = 0; q < numQueries; ++q) hnswRes[q] = hnsw.search(queries128[q], k);
        TimingResult hnswTiming = measureTiming(numQueries, repetitions, [&]() {
            for (std::size_t q = 0; q < numQueries; ++q) hnsw.search(queries128[q], k);
        });

        double speedup = (hnswTiming.medianMs > 0.0) ? (bfTiming.medianMs / hnswTiming.medianMs) : 0.0;
        double recall = meanRecallAtK(bfRes, hnswRes);

        std::string speedupStr = std::to_string(speedup);
        speedupStr = speedupStr.substr(0, speedupStr.find('.') + 3) + "x";

        std::cout << std::left
                  << std::setw(12) << metricToString(m)
                  << std::setw(16) << std::fixed << std::setprecision(4) << bfTiming.medianMs
                  << std::setw(16) << std::fixed << std::setprecision(4) << hnswTiming.medianMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << hnswTiming.minMs
                  << std::setw(14) << std::fixed << std::setprecision(4) << hnswTiming.maxMs
                  << std::setw(14) << speedupStr
                  << std::setw(14) << std::fixed << std::setprecision(4) << recall
                  << "\n";

        if (metricCsv.is_open()) {
            metricCsv << n << "," << dim << "," << metricToString(m) << ","
                      << mParams.M << "," << mParams.efConstruction << "," << mParams.efSearch << "," << mParams.seed << ","
                      << std::fixed << std::setprecision(4) << bfTiming.medianMs << ","
                      << hnswTiming.medianMs << "," << hnswTiming.minMs << "," << hnswTiming.maxMs << ","
                      << std::setprecision(2) << speedup << ","
                      << std::setprecision(4) << recall << "\n";
        }
    }
    if (metricCsv.is_open()) {
        metricCsv.close();
    }
    std::cout << std::string(100, '-') << "\n\n";
}

int main(int argc, char* argv[]) {
    try {
        bool quickMode = false;
        for (int i = 1; i < argc; ++i) {
            if (std::string(argv[i]) == "--quick") {
                quickMode = true;
            }
        }

        printSystemInfo(quickMode, quickMode ? 2000 : 20000, quickMode ? 3 : 5);
        runDemo();
        runBenchmark(quickMode);
        runKdTreeBenchmark(quickMode);
        runHnswBenchmark(quickMode);
    } catch (const std::exception& e) {
        std::cerr << "Fatal error: " << e.what() << "\n";
        return 1;
    }
    return 0;
}
