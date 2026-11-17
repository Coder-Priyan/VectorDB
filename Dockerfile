# ==============================================================================
# VectorDB - Self-Hosted Educational Vector Database & RAG Platform
# ==============================================================================
#
# QUICK START:
#
# 1. Build the Docker image:
#    docker build -t vectordb .
#
# 2. Run the container (loopback only):
#    docker run --rm -p 127.0.0.1:8080:8080 -v vectordb-data:/data vectordb
#
# 3. Open in your browser:
#    http://localhost:8080/
#
# ------------------------------------------------------------------------------
# SECURITY NOTE (ADR-099):
# - Always publish the port to host loopback ONLY: `-p 127.0.0.1:8080:8080`
# - NEVER use plain `-p 8080:8080` on untrusted networks.
#   Inside the container, the server binds to 0.0.0.0, which disables loopback
#   Host-header verification. Binding the host port to 127.0.0.1 guarantees
#   that only your local machine can access the API and UI.
# ------------------------------------------------------------------------------
# CONNECTING TO OLLAMA ON THE HOST (for Ask/RAG tab):
# By default, Explore, HNSW, and Compare work immediately on Demo vectors
# without Ollama. To use the Ask tab with Ollama running on your host machine:
#
# - Linux:
#   docker run --rm -p 127.0.0.1:8080:8080 \
#     --add-host=host.docker.internal:host-gateway \
#     -v vectordb-data:/data vectordb \
#     /app/vectordb_server --host 0.0.0.0 --port 8080 --web-dir /app/web \
#     --data-dir /data --cors-origin http://localhost:8080 \
#     --ollama-url http://host.docker.internal:11434 --allow-remote-ollama
#
# - Windows / macOS (Docker Desktop):
#   docker run --rm -p 127.0.0.1:8080:8080 \
#     -v vectordb-data:/data vectordb \
#     /app/vectordb_server --host 0.0.0.0 --port 8080 --web-dir /app/web \
#     --data-dir /data --cors-origin http://localhost:8080 \
#     --ollama-url http://host.docker.internal:11434 --allow-remote-ollama
#
# Why `--allow-remote-ollama` is needed:
# VectorDB contains SSRF protection that rejects non-loopback Ollama endpoints
# by default. Because `host.docker.internal` resolves to a host IP address rather
# than 127.0.0.1 inside the container network namespace, the explicit flag
# `--allow-remote-ollama` is required to authorize the connection.
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM ubuntu:24.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        cmake \
        ninja-build \
        g++ \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .

RUN cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --target vectordb_server

# ------------------------------------------------------------------------------
# Stage 2: Runtime
# ------------------------------------------------------------------------------
FROM ubuntu:24.04 AS runtime

# Create dedicated non-root user and group
RUN groupadd -r vectordb && \
    useradd -r -g vectordb -u 1000 -d /app -s /usr/sbin/nologin vectordb

# Create application and data persistence directories with proper ownership
RUN mkdir -p /app/web /data && \
    chown -R vectordb:vectordb /app /data

# Copy built server binary and web assets from builder
COPY --from=builder --chown=vectordb:vectordb /src/build/vectordb_server /app/vectordb_server
COPY --from=builder --chown=vectordb:vectordb /src/web /app/web

USER vectordb
WORKDIR /app

EXPOSE 8080
VOLUME /data

CMD ["/app/vectordb_server", "--host", "0.0.0.0", "--port", "8080", "--web-dir", "/app/web", "--data-dir", "/data", "--cors-origin", "http://localhost:8080"]
