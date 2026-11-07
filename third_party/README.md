# Third-Party Dependencies

This directory contains vendored, single-header C++ dependencies used exclusively by the HTTP server layer (`vectordb_server`) and API unit/integration tests.
The core indexing library (`vectordb_core`) has zero external dependencies and does not include these headers.

---

## 1. cpp-httplib

- **Name**: cpp-httplib (A C++11 single-file header-only cross-platform HTTP/HTTPS library)
- **Author**: Yuji Hirose
- **Version**: `v0.18.3` (Latest stable release)
- **Source URL**: https://github.com/yhirose/cpp-httplib
- **License**: MIT License
- **Header Location**: `third_party/httplib.h`
- **Usage**: Used in `vectordb_server` for non-blocking multi-threaded HTTP routing, static file hosting, and client integration testing. OpenSSL / HTTPS is disabled.

---

## 2. nlohmann/json

- **Name**: JSON for Modern C++
- **Author**: Niels Lohmann
- **Version**: `v3.11.3` (Latest stable release)
- **Source URL**: https://github.com/nlohmann/json
- **License**: MIT License
- **Header Location**: `third_party/nlohmann/json.hpp`
- **Usage**: Used in `vectordb_server` API handlers for parsing JSON request payloads and formatting API response documents.
