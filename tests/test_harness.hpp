#pragma once

#include <iostream>
#include <string>
#include <vector>
#include <functional>
#include <cmath>

namespace vectordb::testing {

struct TestInfo {
    std::string suite;
    std::string name;
    std::function<void()> func;
};

inline std::vector<TestInfo>& getTests() {
    static std::vector<TestInfo> tests;
    return tests;
}

inline void registerTest(const std::string& suite, const std::string& name, std::function<void()> func) {
    getTests().push_back({suite, name, std::move(func)});
}

extern int g_totalAssertions;
extern int g_failedAssertions;

} // namespace vectordb::testing

#define TEST(suite, name) \
    void suite##_##name(); \
    namespace { \
        struct Reg_##suite##_##name { \
            Reg_##suite##_##name() { \
                ::vectordb::testing::registerTest(#suite, #name, suite##_##name); \
            } \
        } reg_instance_##suite##_##name; \
    } \
    void suite##_##name()

#define CHECK(cond) do { \
    ++::vectordb::testing::g_totalAssertions; \
    if (!(cond)) { \
        ++::vectordb::testing::g_failedAssertions; \
        std::cerr << "  [FAIL] " << __FILE__ << ":" << __LINE__ \
                  << " - CHECK(" #cond ") failed\n"; \
    } \
} while (0)

#define CHECK_NEAR(a, b, eps) do { \
    ++::vectordb::testing::g_totalAssertions; \
    double diff = std::fabs(static_cast<double>(a) - static_cast<double>(b)); \
    if (diff > static_cast<double>(eps)) { \
        ++::vectordb::testing::g_failedAssertions; \
        std::cerr << "  [FAIL] " << __FILE__ << ":" << __LINE__ \
                  << " - CHECK_NEAR(" #a ", " #b ", " #eps ") failed: |" \
                  << (a) << " - " << (b) << "| = " << diff << " > " << (eps) << "\n"; \
    } \
} while (0)

#define CHECK_THROWS(expr, ExceptionType) do { \
    ++::vectordb::testing::g_totalAssertions; \
    bool caught = false; \
    try { \
        expr; \
    } catch (const ExceptionType&) { \
        caught = true; \
    } catch (...) { \
    } \
    if (!caught) { \
        ++::vectordb::testing::g_failedAssertions; \
        std::cerr << "  [FAIL] " << __FILE__ << ":" << __LINE__ \
                  << " - CHECK_THROWS(" #expr ", " #ExceptionType ") failed: expected exception was not caught\n"; \
    } \
} while (0)
