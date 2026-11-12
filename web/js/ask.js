/**
 * VectorDB Grounded Semantic Q&A (RAG) Controller
 */
import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { readSseStream } from "./sse.js";
import { el, formatBytes, formatDuration, formatSimilarity, parseCitations } from "./ui.js";

export function initAskTab() {
  const byId = (id) => document.getElementById(id);
  const docForm = byId("doc-ingest-form"), docTitleInput = byId("doc-title-input"), docFileInput = byId("doc-file-input");
  const docTextInput = byId("doc-text-input"), docStrategySelect = byId("doc-strategy-select");
  const docMaxCharsInput = byId("doc-max-chars"), docOverlapCharsInput = byId("doc-overlap-chars");
  const docIngestBtn = byId("doc-ingest-btn"), docResetBtn = byId("doc-reset-btn");
  const docsListContainer = byId("docs-list-container"), docsCountLabel = byId("docs-count-label");

  const askForm = byId("ask-form"), askQuestionInput = byId("ask-question-input"), askCharCount = byId("ask-char-count");
  const askKInput = byId("ask-k-input"), askAlgoSelect = byId("ask-algo-select"), askSubmitBtn = byId("ask-submit-btn");
  const askStopBtn = byId("ask-stop-btn"), askLoadingNotice = byId("ask-loading-notice");
  const askAnswerBox = byId("ask-answer-box"), askTimingsContainer = byId("ask-timings-container");
  const askSourcesContainer = byId("ask-sources-container"), sourcesCountLabel = byId("sources-count-label");

  let currentAbortController = null;
  let thinkTimer = null;

  // File Input Handler with 2MB limit
  docFileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showGlobalError("file_too_large", `File size (${formatBytes(file.size)}) exceeds the 2 MB limit`);
      docFileInput.value = "";
      return;
    }
    if (!docTitleInput.value) docTitleInput.value = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = (ev) => { docTextInput.value = ev.target?.result || ""; };
    reader.onerror = () => showGlobalError("file_read_error", "Failed to read text file");
    reader.readAsText(file, "utf-8");
  });

  // Document Ingestion
  docForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearGlobalError();
    const title = docTitleInput.value.trim();
    const text = docTextInput.value.trim();
    if (!title || !text) return showGlobalError("validation_error", "Title and text required");

    const payload = {
      title, text,
      chunking: {
        strategy: docStrategySelect.value,
        max_chars: parseInt(docMaxCharsInput.value, 10) || 800,
        overlap_chars: parseInt(docOverlapCharsInput.value, 10) || 100
      }
    };
    await withButtonBusy(docIngestBtn, async () => {
      try {
        await api.ingestDoc(payload);
        if (docTitleInput) docTitleInput.value = "";
        docTextInput.value = "";
        docFileInput.value = "";
        await refreshDocumentsList();
      } catch (err) {
        showGlobalError(err.code, `Ingestion failed: ${err.message}`);
      }
    });
  });

  // Reset Documents
  docResetBtn?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to reset and clear all ingested documents?")) return;
    clearGlobalError();
    await withButtonBusy(docResetBtn, async () => {
      try {
        await api.resetDocs();
        if (askAnswerBox) {
          askAnswerBox.className = "answer-box empty";
          askAnswerBox.replaceChildren(el("p", { className: "text-muted empty-state" }, "Ask a question above to generate an answer with grounded citations."));
        }
        await refreshDocumentsList();
      } catch (err) {
        showGlobalError(err.code, `Reset failed: ${err.message}`);
      }
    });
  });

  async function refreshDocumentsList() {
    if (!docsListContainer) return;
    try {
      const res = await api.getDocs();
      const docs = res.documents || [];
      if (docsCountLabel) docsCountLabel.textContent = String(docs.length);
      if (docs.length === 0) {
        docsListContainer.replaceChildren(el("p", { className: "text-muted empty-state" }, "No documents ingested yet."));
        return;
      }
      const items = docs.map(doc => {
        let chunkDrawer = null, isExpanded = false;
        const expandBtn = el("button", { type: "button", className: "btn btn-sm btn-outline" }, "Chunks");
        expandBtn.addEventListener("click", async () => {
          if (isExpanded) { chunkDrawer?.remove(); chunkDrawer = null; isExpanded = false; expandBtn.textContent = "Chunks"; return; }
          expandBtn.disabled = true;
          try {
            const detail = await api.getDoc(doc.id);
            chunkDrawer = el("div", { className: "doc-chunks-drawer" },
              ...(detail.chunks || []).map(ch => el("div", { className: "chunk-excerpt" }, `[Chunk ${ch.index}] (${ch.start}-${ch.end}):\n${ch.text}`))
            );
            item.appendChild(chunkDrawer);
            isExpanded = true;
            expandBtn.textContent = "Hide";
          } catch (err) {
            showGlobalError(err.code, `Load chunks failed: ${err.message}`);
          } finally { expandBtn.disabled = false; }
        });
        const item = el("div", { className: "doc-item" },
          el("div", { className: "doc-item-header" },
            el("div", {},
              el("div", { className: "doc-title-text" }, doc.title),
              el("div", { className: "doc-meta-text" }, `ID: ${doc.id} | ${doc.chunks} chunks | ${formatBytes(doc.bytes)} | ${doc.strategy}`)
            ),
            expandBtn
          )
        );
        return item;
      });
      docsListContainer.replaceChildren(...items);
    } catch (err) {
      docsListContainer.replaceChildren(el("p", { className: "text-muted" }, `Error: ${err.message}`));
    }
  }

  // Character counter
  askQuestionInput?.addEventListener("input", () => {
    if (askCharCount) askCharCount.textContent = `${askQuestionInput.value.length} / 2000`;
  });

  // Ask Question via SSE Streaming
  askForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearGlobalError();
    const question = askQuestionInput.value.trim();
    if (!question) return;
    const k = parseInt(askKInput.value, 10) || 4;
    const algorithm = askAlgoSelect.value || "hnsw";

    currentAbortController = new AbortController();
    askSubmitBtn.disabled = true;
    askStopBtn.disabled = false;
    askAnswerBox.className = "answer-box streaming";
    askAnswerBox.replaceChildren(el("span", { className: "text-muted" }, "Retrieving..."));
    askSourcesContainer.replaceChildren(el("p", { className: "text-muted empty-state" }, "Searching index..."));
    askTimingsContainer.classList.add("hidden");
    askTimingsContainer.replaceChildren();
    if (sourcesCountLabel) sourcesCountLabel.textContent = "0";

    clearTimeout(thinkTimer);
    askLoadingNotice?.classList.add("hidden");
    thinkTimer = setTimeout(() => askLoadingNotice?.classList.remove("hidden"), 3000);

    let rawAnswer = "";
    let firstTokenReceived = false;

    try {
      const response = await fetch("/api/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, k, algorithm, temperature: 0.0, seed: 42 }),
        signal: currentAbortController.signal
      });

      if (!response.ok) {
        clearTimeout(thinkTimer);
        askLoadingNotice?.classList.add("hidden");
        const errorData = await response.json().catch(() => null);
        const code = errorData?.error?.code || "http_error";
        const msg = errorData?.error?.message || `HTTP ${response.status}`;
        showGlobalError(code, msg);
        askAnswerBox.className = "answer-box";
        askAnswerBox.replaceChildren(el("span", { className: "text-muted" }, `Error: ${msg}`));
        return;
      }

      await readSseStream(response, {
        signal: currentAbortController.signal,
        onEvent: ({ event, data }) => {
          if (event === "sources") {
            try { renderSources(JSON.parse(data).sources || []); } catch (_) {}
          } else if (event === "token") {
            if (!firstTokenReceived) {
              firstTokenReceived = true;
              clearTimeout(thinkTimer);
              askLoadingNotice?.classList.add("hidden");
              askAnswerBox.classList.remove("empty");
              askAnswerBox.replaceChildren();
            }
            try {
              const parsed = JSON.parse(data);
              const piece = parsed.t !== undefined ? parsed.t : (parsed.token || "");
              rawAnswer += piece;
              renderAnswerWithCitations(rawAnswer, askAnswerBox);
            } catch (_) {}
          } else if (event === "done") {
            clearTimeout(thinkTimer);
            askLoadingNotice?.classList.add("hidden");
            try { renderTimings(JSON.parse(data).timings || {}); } catch (_) {}
          } else if (event === "error") {
            clearTimeout(thinkTimer);
            askLoadingNotice?.classList.add("hidden");
            try {
              const parsed = JSON.parse(data);
              askAnswerBox.appendChild(el("div", { className: "notice-box notice-warning" }, `Stream Error: ${parsed.message || data}`));
            } catch (_) {}
          }
        },
        onError: (err) => {
          clearTimeout(thinkTimer);
          askLoadingNotice?.classList.add("hidden");
          showGlobalError("stream_error", err.message);
        },
        onDone: () => {
          clearTimeout(thinkTimer);
          askLoadingNotice?.classList.add("hidden");
          askAnswerBox.className = "answer-box";
          if (rawAnswer.trim() === "I could not find this in the provided documents.") {
            askAnswerBox.className = "answer-box notice-neutral";
          }
        }
      });
    } catch (err) {
      clearTimeout(thinkTimer);
      askLoadingNotice?.classList.add("hidden");
      if (err.name !== "AbortError") showGlobalError("stream_failed", err.message);
    } finally {
      clearTimeout(thinkTimer);
      askLoadingNotice?.classList.add("hidden");
      askAnswerBox.className = "answer-box";
      askSubmitBtn.disabled = false;
      askStopBtn.disabled = true;
      currentAbortController = null;
    }
  });

  askStopBtn?.addEventListener("click", () => currentAbortController?.abort());

  function renderSources(sources) {
    if (sourcesCountLabel) sourcesCountLabel.textContent = String(sources.length);
    if (!sources || sources.length === 0) {
      askSourcesContainer.replaceChildren(el("p", { className: "text-muted empty-state" }, "No sources retrieved."));
      return;
    }
    askSourcesContainer.replaceChildren(...sources.map(src => {
      const meterFill = el("div", { className: "meter-fill" });
      meterFill.style.setProperty("width", `${Math.round((src.similarity || 0) * 100)}%`);
      return el("div", { id: `source-card-${src.n}`, className: "source-card" },
        el("div", { className: "source-card-header" },
          el("span", { className: "source-title" }, `[${src.n}] ${src.title} (chunk ${src.chunk_index})`),
          el("div", { className: "similarity-meter" },
            el("span", {}, formatSimilarity(src.similarity)),
            el("div", { className: "meter-track" }, meterFill)
          )
        ),
        el("div", { className: "source-text" }, src.text)
      );
    }));
  }

  function renderAnswerWithCitations(text, container) {
    const segments = parseCitations(text);
    const nodes = segments.map(seg => {
      if (seg.type === "citation") {
        const pill = el("button", { type: "button", className: "citation-pill", title: `Jump to source [${seg.n}]` }, `[${seg.n}]`);
        pill.addEventListener("click", () => {
          const targetCard = document.getElementById(`source-card-${seg.n}`);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
            targetCard.classList.add("highlighted");
            setTimeout(() => targetCard.classList.remove("highlighted"), 1500);
          }
        });
        return pill;
      }
      return document.createTextNode(seg.text);
    });
    container.replaceChildren(...nodes);
  }

  function renderTimings(t) {
    if (!askTimingsContainer) return;
    const parts = [
      `embed ${formatDuration(t.embed_ms)}`,
      `search ${formatDuration(t.search_ms)}`,
      `first token ${formatDuration(t.first_token_ms)}`,
      `generation ${formatDuration(t.generate_ms)}`,
      `total ${formatDuration(t.total_ms)}`
    ];
    askTimingsContainer.replaceChildren(
      el("span", { className: "timing-chip" }, parts.join(" \u00B7 "))
    );
    askTimingsContainer.classList.remove("hidden");
  }

  refreshDocumentsList();
}
