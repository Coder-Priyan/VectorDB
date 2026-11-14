# Contributing to VectorDB

Thank you for your interest in contributing to VectorDB! We welcome contributions to both the C++17 core engine and the zero-dependency browser interface.

## Core Architectural Invariants

When contributing code, please ensure adherence to our foundational engineering rules:

1. **Zero External Network Dependencies**:
   - The engine and browser interface run entirely offline on loopback (`127.0.0.1`).
   - Third-party CDN scripts, fonts, and remote API calls are strictly disallowed.

2. **Web Safety & Security**:
   - Zero `innerHTML`, `outerHTML`, or `insertAdjacentHTML` anywhere in `web/`.
   - All DOM construction must use safe DOM APIs (`document.createElement`, `document.createTextNode`, or the `el()` helper).
   - Strict Content Security Policy (CSP) must remain intact.
   - All POST/PUT requests require `Content-Type: application/json`.
   - Host and Origin header validation on loopback must not be bypassed.

3. **Concurrency & Thread Safety**:
   - Long-running network or LLM calls (e.g. Ollama embeddings and generation) must NEVER be executed while holding internal collection or pipeline mutexes.

4. **Hermetic Testing**:
   - All tests in `tests/` must remain deterministic and hermetic.
   - Do not rely on external running services for automated CI tests (use `fake_ollama.hpp` for mock LLM interactions).

## Development Setup

### Prerequisites
- C++17 compliant compiler (GCC 11+, Clang 14+, or MSVC 2022)
- CMake 3.20+
- Ninja build system (recommended)

### Building
```bash
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

### Running Tests
```bash
# C++ Test Suite
./build/vectordb_tests

# Web Safety Verification
powershell -ExecutionPolicy Bypass -File ./scripts/check_web_safety.ps1
```

## Pull Request Guidelines

1. Ensure all C++ tests pass (`./build/vectordb_tests`).
2. Run the automated web safety scanner before committing frontend changes.
3. Keep commits atomic, well-titled, and focused on specific features or fixes.

