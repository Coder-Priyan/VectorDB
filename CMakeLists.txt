cmake_minimum_required(VERSION 3.16)
project(VectorDB VERSION 0.1.0 LANGUAGES CXX)

# Default to Release build type if not specified
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Choose the build type" FORCE)
endif()

# Require C++17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Export compile commands for language servers and IDE tooling (clangd / c_cpp_properties)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Enable compiler warnings
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Core static library
add_library(vectordb_core
    src/distance.cpp
    src/brute_force.cpp
    src/dataset.cpp
)

target_include_directories(vectordb_core PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Demo and benchmark executable
add_executable(vectordb_demo
    src/main.cpp
)

target_link_libraries(vectordb_demo PRIVATE vectordb_core)

# Test executable
enable_testing()

add_executable(vectordb_tests
    tests/test_main.cpp
    tests/test_distance.cpp
    tests/test_brute_force.cpp
)

target_link_libraries(vectordb_tests PRIVATE vectordb_core)
target_include_directories(vectordb_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/tests)

add_test(NAME vectordb_tests COMMAND vectordb_tests)
