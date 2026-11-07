#include "test_harness.hpp"
#include <iostream>
#include <iomanip>

namespace vectordb::testing {
int g_totalAssertions = 0;
int g_failedAssertions = 0;
} // namespace vectordb::testing

int main() {
    using namespace vectordb::testing;

    const auto& testList = getTests();
    std::cout << "========================================\n";
    std::cout << " Running VectorDB Test Suite\n";
    std::cout << " Total test cases registered: " << testList.size() << "\n";
    std::cout << "========================================\n\n";

    int passedTests = 0;
    int failedTests = 0;

    for (const auto& t : testList) {
        std::cout << "[RUN     ] " << t.suite << "." << t.name << std::endl;
        const int prevFailures = g_failedAssertions;
        try {
            t.func();
        } catch (const std::exception& ex) {
            ++g_failedAssertions;
            std::cerr << "  [EXCEPTION] Unhandled exception in " << t.suite << "." << t.name
                      << ": " << ex.what() << std::endl;
        } catch (...) {
            ++g_failedAssertions;
            std::cerr << "  [EXCEPTION] Unknown non-std exception in " << t.suite << "." << t.name << std::endl;
        }

        if (g_failedAssertions == prevFailures) {
            std::cout << "[      OK] " << t.suite << "." << t.name << std::endl;
            ++passedTests;
        } else {
            std::cout << "[    FAIL] " << t.suite << "." << t.name << std::endl;
            ++failedTests;
        }
    }

    std::cout << "\n========================================\n";
    std::cout << " Test Summary\n";
    std::cout << "========================================\n";
    std::cout << " Tests passed:     " << passedTests << " / " << testList.size() << "\n";
    std::cout << " Tests failed:     " << failedTests << " / " << testList.size() << "\n";
    std::cout << " Total assertions: " << g_totalAssertions << "\n";
    std::cout << " Failed assertions:" << g_failedAssertions << "\n";
    std::cout << "========================================\n";

    if (failedTests > 0 || g_failedAssertions > 0) {
        std::cout << "OVERALL STATUS: FAILED\n";
        return 1;
    }

    std::cout << "OVERALL STATUS: ALL TESTS PASSED\n";
    return 0;
}
