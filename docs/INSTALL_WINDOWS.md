# Windows setup guide

## Overview

- **Audience**: Developers and students building VectorDB natively on Windows from source code.
- **Outcome**: A compiled C++17 server running locally with the browser interface accessible at `http://localhost:8080/`.
- **Estimated time**: About 5 to 10 minutes (excluding optional language model download time).
- **Prerequisites**: Windows 10 or 11 (64-bit), internet access for the initial toolchain download, and Git for Windows (https://git-scm.com) if cloning with Git (downloading a ZIP archive from GitHub requires no Git).

---

## 1. Install MSYS2

VectorDB uses modern C++17 features and builds cleanly with GCC in the MSYS2 UCRT64 environment.

1. Download the MSYS2 installer from https://www.msys2.org.
2. Run the installer and complete the setup wizard using default settings.
3. When installation finishes, open the Windows Start menu and launch **MSYS2 UCRT64**. Do not use the MSYS, MINGW32, or MINGW64 shortcuts.

---

## 2. Install the toolchain

In the open **MSYS2 UCRT64** terminal, run the following command to install the GCC compiler, CMake, and the Ninja build system:

MSYS2 UCRT64
```bash
pacman -S --noconfirm mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-cmake mingw-w64-ucrt-x86_64-ninja
```

Pacman downloads and installs the packages into `C:\msys64\ucrt64\bin`.

To ensure CMake and Ninja are accessible in standard PowerShell windows, add `C:\msys64\ucrt64\bin` to your Windows user or system `PATH` environment variable (if your default install path is `C:\msys64`).

---

## 3. Get the project

You can clone the repository with Git or download a ZIP archive from GitHub.

Open PowerShell and run:

PowerShell
```powershell
git clone https://github.com/Coder-Priyan/VectorDB.git
cd VectorDB
```

If you downloaded a ZIP archive instead, extract it and navigate into the extracted `VectorDB` directory in PowerShell.

---

## 4. Build

Configure the build using CMake and compile all targets with Ninja.

PowerShell
```powershell
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
```

CMake configures the build tree in Release mode and writes build configuration files into the `build` directory.

Next, compile the project:

PowerShell
```powershell
cmake --build build
```

Ninja compiles the static libraries and links four executables in the `build` folder: `vectordb_server.exe`, `vectordb_tests.exe`, `vectordb_demo.exe`, and `vectordb_rag_eval.exe`.

---

## 5. Run the tests

Run the automated test suite to verify that your build functions correctly:

PowerShell
```powershell
.\build\vectordb_tests.exe
```

The test runner executes the hermetic test suite and reports that all tests pass.

---

## 6. Start the server

Start the HTTP REST server with the embedded web interface:

PowerShell
```powershell
.\build\vectordb_server.exe --port 8080 --web-dir web
```

The server initializes the in-memory collections and begins listening on `http://127.0.0.1:8080`.

Open your browser and navigate to:
```text
http://localhost:8080/
```

The VectorDB web interface loads with the Ask tab active.

---

## 7. Use the app in 2 minutes

Explore the vector indexing engine without configuring external models:

1. Open `http://localhost:8080/` in your browser.
2. Click the **Settings** tab in the sidebar navigation.
3. Under the Demo Collection card, click `+100` to generate and insert 100 random synthetic vectors.
4. Switch to the **Explore** tab to view the 2D PCA projection of your vectors and run visual neighbor searches.
5. Switch to the **HNSW** tab to inspect proximity graph layers and trace search hops across hierarchy levels.
6. Switch to the **Compare** tab and click **Benchmark Random Query** to compare latency, distance calculations, and recall across Brute Force, KD-Tree, and HNSW (or **Run Benchmark** when using documentation vectors).

---

## 8. Optional: enable Ask with Ollama

The Ask tab uses Retrieval-Augmented Generation to answer questions from ingested documents using local language models.

1. Download and install Ollama from https://ollama.com.
2. Start the Ollama application and ensure the daemon is running on `http://127.0.0.1:11434`.
3. Open a terminal and download the required embedding and chat models:

PowerShell
```powershell
ollama pull nomic-embed-text
ollama pull llama3.2
```

4. Start the VectorDB server if it is not already running:

PowerShell
```powershell
.\build\vectordb_server.exe --port 8080 --web-dir web
```

5. Go to the **Ask** tab in your browser. Click **Documents** to open the documents drawer on the right side. Under **Load file (.txt, .md <= 2 MB)**, select a plain text document (only plain text `.txt` and `.md` files are supported), or paste text into the content box, then click **Ingest Document**. Once ingested, ask questions about its content.

Generating complete answers with a local language model on CPU hardware typically takes between 10 and 30 seconds per query.

---

## 9. Optional: keep data between restarts with --data-dir

By default, collections are stored in memory and clear when the server terminates. To persist collections to disk across restarts, provide a storage directory with the `--data-dir` argument:

PowerShell
```powershell
.\build\vectordb_server.exe --port 8080 --web-dir web --data-dir ./data
```

The server creates the `./data` directory if it does not exist, saves collection snapshots when changes occur, and reloads saved vectors on subsequent startups.

---

## 10. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| Permission denied on `vectordb_server.exe` during build | A running server process has locked the executable file. | Stop the process before rebuilding: `Get-Process vectordb_server \| Stop-Process -Force` in PowerShell. |
| HTTP 415 Unsupported Media Type | A manual POST request via curl omitted the JSON content type header. | Pass the explicit header `-H "Content-Type: application/json"` and body `-d "{}"`. |
| `ERR_ADDRESS_INVALID` in browser | The server was started with `--host 0.0.0.0` and opened at `http://0.0.0.0:8080/`. | Navigate to `http://localhost:8080/` or `http://127.0.0.1:8080/`. |
| Ask tab displays Ollama offline | The Ollama service is not running or blocked on port 11434. | Start the Ollama application and ensure it is listening on port 11434. |
| Port 8080 already in use | Another application is listening on port 8080. | Pass a different port flag: `.\build\vectordb_server.exe --port 8081 --web-dir web`. |
