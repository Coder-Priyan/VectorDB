# Docker container setup guide

## Overview

- **Audience**: Users and students who want to run VectorDB without installing a local C++ compiler, CMake, or Ninja.
- **Outcome**: A running VectorDB container accessible in your web browser at `http://localhost:8080/`.
- **Estimated time**: About 5 to 10 minutes (depending on image build speed and network bandwidth).
- **Prerequisites**: Docker Desktop for Windows installed from https://www.docker.com, and Git or the downloaded repository ZIP.

---

## 1. Install and start Docker Desktop

1. Download and install Docker Desktop for Windows from https://www.docker.com.
2. Start the Docker Desktop application from the Windows Start menu.
3. Wait until the Docker dashboard indicates the Docker engine is running.

---

## 2. Get the project

Open PowerShell, clone the repository, and enter the project directory:

PowerShell
```powershell
git clone https://github.com/Coder-Priyan/VectorDB.git
cd VectorDB
```

If you downloaded a ZIP archive instead, extract the files and open PowerShell in the extracted `VectorDB` folder.

---

## 3. Build the image

Build the multi-stage container image using the project `Dockerfile`:

PowerShell
```powershell
docker build -t vectordb .
```

Docker compiles the C++17 server binary in an Ubuntu 24.04 build stage, then packages the compiled binary and the web assets into a lightweight runtime image with a non-root system user.

---

## 4. Run the container

Start the container and publish the service to your host loopback interface:

PowerShell
```powershell
docker run --rm -p 127.0.0.1:8080:8080 -v vectordb-data:/data vectordb
```

The container starts in the foreground, initializes in-memory vector storage, and logs that the server is listening on port 8080.

---

## 5. Open the web interface

Open your web browser and navigate to:
```text
http://localhost:8080/
```

The web interface loads with all five tabs accessible.

---

## 6. Use the app

The core vector search features operate on synthetic demo vectors without external dependencies:

1. Click the **Settings** tab in the sidebar navigation.
2. Under the Demo Collection section, click `+100` to insert 100 random vectors into memory.
3. Open the **Explore** tab to view the 2D PCA projection of the vectors and query nearest neighbors.
4. Open the **HNSW** tab to inspect graph layers and step through path traversal.
5. Open the **Compare** tab and click **Benchmark Random Query** to evaluate latency, distance computations, and recall across Brute Force, KD-Tree, and HNSW (or **Run Benchmark** when using documentation vectors).

---

## 7. Data persistence

The `-v vectordb-data:/data` flag creates a Docker named volume called `vectordb-data` mounted at `/data` inside the container.

Because the container starts with `--data-dir /data`, vector collections and documents are saved automatically under `/data`. Snapshots and ingested documents persist inside this volume across container stops and restarts.

---

## 8. Stop and clean up

To stop the running container, press `Ctrl+C` in the terminal where it is running. The `--rm` flag removes the stopped container instance automatically.

To inspect or remove the persistent volume when you are finished:

PowerShell
```powershell
docker volume ls
```

PowerShell
```powershell
docker volume rm vectordb-data
```

---

## 9. Ask tab with Ollama

The Ask tab connects to a local Ollama service for document embeddings and language model responses.

This configuration is untested, may need adjustment.

The container runs inside an isolated container network, so it cannot reach host loopback `127.0.0.1` directly. It must route to Ollama running on your host machine. Because the container `Dockerfile` uses `CMD`, passing arguments replaces the entire default command rather than appending flags. You must provide the full command string.

For Windows or macOS using Docker Desktop:

PowerShell
```powershell
docker run --rm -p 127.0.0.1:8080:8080 \
  -v vectordb-data:/data vectordb \
  /app/vectordb_server --host 0.0.0.0 --port 8080 --web-dir /app/web \
  --data-dir /data --cors-origin http://localhost:8080 \
  --ollama-url http://host.docker.internal:11434 --allow-remote-ollama
```

For Linux hosts:

Linux
```bash
docker run --rm -p 127.0.0.1:8080:8080 \
  --add-host=host.docker.internal:host-gateway \
  -v vectordb-data:/data vectordb \
  /app/vectordb_server --host 0.0.0.0 --port 8080 --web-dir /app/web \
  --data-dir /data --cors-origin http://localhost:8080 \
  --ollama-url http://host.docker.internal:11434 --allow-remote-ollama
```

VectorDB contains SSRF protection that rejects non-loopback Ollama endpoints by default. Because `host.docker.internal` resolves to a host IP address rather than `127.0.0.1` inside the container network namespace, the explicit flag `--allow-remote-ollama` is required to authorize the connection. Host Ollama network reachability and interface binding remain unverified.

For instructions on installing Ollama and downloading the required models (`nomic-embed-text` and `llama3.2`), see section 8 of [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md#8-optional-enable-ask-with-ollama).

---

## 10. Security note

Always publish the container port to the host loopback interface using `-p 127.0.0.1:8080:8080`. Never use plain `-p 8080:8080` on untrusted networks.

Inside the container, the server binds to `0.0.0.0`, which disables the loopback Host-header verification check. Binding the host-side publication explicitly to `127.0.0.1` ensures that only your local machine can access the REST API and web interface.

---

## 11. Verification status

The container image build and loopback smoke tests pass in GitHub Actions CI on Linux runners. The Docker image has not been executed on the author's local workstation because Docker is not installed on that machine. The Ask tab inside Docker, host Ollama reachability, and named volume persistence across restarts remain unverified.

---

## 12. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| Docker Desktop not running | The Docker daemon is stopped or initializing. | Open Docker Desktop from the Start menu and wait until the status indicator turns green before running commands. |
| Port 8080 already in use | Another application on the host machine is bound to port 8080. | Change the host port mapping: `docker run --rm -p 127.0.0.1:8081:8080 -v vectordb-data:/data vectordb` and open `http://localhost:8081/`. |
| Build fails during package installation | The builder stage cannot download Ubuntu packages from package mirrors. | Check your internet connection and verify that firewall or proxy settings permit Docker to reach external package repositories. |
