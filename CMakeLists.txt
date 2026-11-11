cmake_minimum_required(VERSION 3.16)
project(VectorDB VERSION 0.4.0 LANGUAGES CXX)

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
    src/evaluation.cpp
    src/kd_tree.cpp
    src/hnsw.cpp
    src/collection.cpp
    src/chunker.cpp
    src/pca.cpp
)

target_include_directories(vectordb_core PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# RAG static library (OllamaClient & RagPipeline)
add_library(vectordb_rag
    src/ollama_client.cpp
    src/rag.cpp
    src/rag_eval.cpp
)

target_include_directories(vectordb_rag PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party
)

target_link_libraries(vectordb_rag PUBLIC vectordb_core)

if(WIN32)
    target_link_libraries(vectordb_rag PUBLIC ws2_32 wsock32)
endif()

# Demo and benchmark executable
add_executable(vectordb_demo
    src/main.cpp
)

target_link_libraries(vectordb_demo PRIVATE vectordb_core)

# REST API Server target
add_executable(vectordb_server
    src/server_main.cpp
    src/api.cpp
)

target_include_directories(vectordb_server PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party
)

target_link_libraries(vectordb_server PRIVATE vectordb_core vectordb_rag)

if(WIN32)
    target_link_libraries(vectordb_server PRIVATE ws2_32 wsock32)
endif()

# RAG Evaluation executable
add_executable(vectordb_rag_eval
    src/rag_eval_main.cpp
)

target_include_directories(vectordb_rag_eval PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party
)

target_link_libraries(vectordb_rag_eval PRIVATE vectordb_core vectordb_rag)

if(WIN32)
    target_link_libraries(vectordb_rag_eval PRIVATE ws2_32 wsock32)
endif()

# Test executable
enable_testing()

add_executable(vectordb_tests
    src/api.cpp
    tests/test_main.cpp
    tests/test_distance.cpp
    tests/test_brute_force.cpp
    tests/test_evaluation.cpp
    tests/test_kd_tree.cpp
    tests/test_hnsw.cpp
    tests/test_collection.cpp
    tests/test_pca.cpp
    tests/test_chunker.cpp
    tests/test_ollama_client.cpp
    tests/test_rag.cpp
    tests/test_api_rag.cpp
    tests/test_live_ollama.cpp
    tests/test_api.cpp
    tests/test_server_http.cpp
)

target_link_libraries(vectordb_tests PRIVATE vectordb_core vectordb_rag)
target_include_directories(vectordb_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/tests
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party
)

if(WIN32)
    target_link_libraries(vectordb_tests PRIVATE ws2_32 wsock32)
endif()

add_test(NAME vectordb_tests COMMAND vectordb_tests)
