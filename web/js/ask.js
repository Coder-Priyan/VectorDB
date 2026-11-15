/**
 * VectorDB Grounded Semantic Q&A (RAG) & Glass-Box Chat Controller
 *
 * Implements multi-turn persistent chat (localStorage), SSE streaming,
 * citation pill interaction, glass-box explainability accordions,
 * collapsible documents drawer, and document ingestion/deletion.
 *
 * Zero-innerHTML & strict CSP compliant.
 */

import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { readSseStream } from "./sse.js";
import { el, formatBytes, formatDuration, formatSimilarity, parseCitations, showToast } from "./ui.js";
import { createIcon } from "./icons.js";
import { formatBenchmarkRows, formatTraceSummary, formatPipelineLatency } from "./ask_helpers.js";

const CHATS_INDEX_KEY = "vectordb:chats";
const CHAT_PREFIX = "vectordb:chats:";
const MAX_CHATS = 50;
const DOCS_DRAWER_KEY = "vectordb:docs-drawer-open";

export function initAskTab() {
  const byId = (id) => document.getElementById(id);

  // Ask Tab & Chat elements
  const askForm = byId("ask-form");
  const askQuestionInput = byId("ask-question-input");
  const askCharCount = byId("ask-char-count");
  const askKInput = byId("ask-k-input");
  const askAlgoSelect = byId("ask-algo-select");
  const askSubmitBtn = byId("ask-submit-btn");
  const askStopBtn = byId("ask-stop-btn");
  const askLoadingNotice = byId("ask-loading-notice");
  const askAnswerBox = byId("ask-answer-box");
  const askTimingsContainer = byId("ask-timings-container");
  const askSourcesContainer = byId("ask-sources-container");
  const sourcesCountLabel = byId("sources-count-label");

  // Documents Drawer elements
  const docDrawer = byId("doc-drawer");
  const toggleDocsDrawerBtn = byId("toggle-docs-drawer-btn");
  const docForm = byId("doc-ingest-form");
  const docTitleInput = byId("doc-title-input");
  const docFileInput = byId("doc-file-input");
  const docTextInput = byId("doc-text-input");
  const docStrategySelect = byId("doc-strategy-select");
  const docMaxCharsInput = byId("doc-max-chars");
  const docOverlapCharsInput = byId("doc-overlap-chars");
  const docIngestBtn = byId("doc-ingest-btn");
  const docResetBtn = byId("doc-reset-btn");
  const docResetCancelBtn = byId("doc-reset-cancel-btn");
  const docLoadSampleBtn = byId("doc-load-sample-btn");
  const docsListContainer = byId("docs-list-container");
  const docsCountLabel = byId("docs-count-label");

  let currentAbortController = null;
  let thinkTimer = null;
  let activeChatId = null;
  let cachedDocsCount = 0;

  // ---------------------------------------------------------------------------
  // 1. Documents Drawer: Collapse / Expand & Sample Loading
  // ---------------------------------------------------------------------------
  const isDrawerOpen = localStorage.getItem(DOCS_DRAWER_KEY) !== "false";
  if (!isDrawerOpen && docDrawer) {
    docDrawer.classList.add("collapsed");
  }

  toggleDocsDrawerBtn?.addEventListener("click", () => {
    if (!docDrawer) return;
    docDrawer.classList.toggle("collapsed");
    const open = !docDrawer.classList.contains("collapsed");
    localStorage.setItem(DOCS_DRAWER_KEY, String(open));
  });

  // Populate static icons for Ask shell & composer
  if (toggleDocsDrawerBtn) {
    const iconSlot = toggleDocsDrawerBtn.querySelector(".btn-icon");
    if (iconSlot && !iconSlot.hasChildNodes()) {
      iconSlot.appendChild(createIcon("document", 14));
    }
  }

  const algoIconSlot = document.querySelector(".composer-algo-icon");
  if (algoIconSlot && !algoIconSlot.hasChildNodes()) {
    algoIconSlot.appendChild(createIcon("database", 14));
  }

  const sendIconSlot = askSubmitBtn?.querySelector(".btn-send-icon");
  if (sendIconSlot && !sendIconSlot.hasChildNodes()) {
    sendIconSlot.appendChild(createIcon("send", 14));
  }

  docLoadSampleBtn?.addEventListener("click", async () => {
    clearGlobalError();
    try {
      const res = await fetch("samples/vectordb_intro.txt");
      if (!res.ok) throw new Error("Failed to load sample document file");
      const sampleText = await res.text();
      if (docTitleInput) docTitleInput.value = "VectorDB Intro";
      if (docTextInput) docTextInput.value = sampleText;
      showToast("Loaded sample document text into form", "info");
      if (docDrawer?.classList.contains("collapsed")) {
        docDrawer.classList.remove("collapsed");
        localStorage.setItem(DOCS_DRAWER_KEY, "true");
      }
    } catch (err) {
      showGlobalError("sample_load_error", err.message);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Chat Storage Helpers (LocalStorage)
  // ---------------------------------------------------------------------------
  function getChatsIndex() {
    try {
      const raw = localStorage.getItem(CHATS_INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveChatsIndex(list) {
    try {
      localStorage.setItem(CHATS_INDEX_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent("vectordb:chats-updated", {
        detail: { activeChatId }
      }));
    } catch (_) {}
  }

  function getChatData(id) {
    try {
      const raw = localStorage.getItem(CHAT_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveChatData(chat) {
    try {
      localStorage.setItem(CHAT_PREFIX + chat.id, JSON.stringify(chat));

      let index = getChatsIndex();
      const existingIdx = index.findIndex(c => c.id === chat.id);
      const meta = {
        id: chat.id,
        title: chat.title || "Untitled chat",
        createdAt: chat.createdAt || Date.now(),
        updatedAt: Date.now(),
        messageCount: chat.messages ? chat.messages.length : 0
      };

      if (existingIdx >= 0) {
        index[existingIdx] = meta;
      } else {
        index.unshift(meta);
      }

      // Sort by updatedAt desc
      index.sort((a, b) => b.updatedAt - a.updatedAt);

      // Prune if exceeds MAX_CHATS
      if (index.length > MAX_CHATS) {
        const pruned = index.slice(MAX_CHATS);
        index = index.slice(0, MAX_CHATS);
        for (const p of pruned) {
          try { localStorage.removeItem(CHAT_PREFIX + p.id); } catch (_) {}
        }
      }

      saveChatsIndex(index);
    } catch (_) {}
  }

  function deleteChat(id) {
    try {
      localStorage.removeItem(CHAT_PREFIX + id);
      const index = getChatsIndex().filter(c => c.id !== id);
      saveChatsIndex(index);

      if (activeChatId === id) {
        if (index.length > 0) {
          loadChat(index[0].id);
        } else {
          startNewChat();
        }
      }
    } catch (_) {}
  }

  function startNewChat() {
    activeChatId = "chat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const newChat = {
      id: activeChatId,
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    saveChatData(newChat);
    renderMessages(newChat.messages);
    if (askQuestionInput) {
      askQuestionInput.value = "";
      autoResizeTextarea(askQuestionInput);
      askQuestionInput.focus();
    }
    updateCharCount();
  }

  function loadChat(id) {
    const chat = getChatData(id);
    if (!chat) {
      startNewChat();
      return;
    }
    activeChatId = id;
    renderMessages(chat.messages || []);
    window.dispatchEvent(new CustomEvent("vectordb:chats-updated", {
      detail: { activeChatId }
    }));
  }

  // ---------------------------------------------------------------------------
  // 3. UI Auto-Resizing & Composer Setup
  // ---------------------------------------------------------------------------
  function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${Math.max(newHeight, 38)}px`;
  }

  function updateCharCount() {
    if (askCharCount && askQuestionInput) {
      askCharCount.textContent = `${askQuestionInput.value.length} / 2000`;
    }
  }

  askQuestionInput?.addEventListener("input", () => {
    autoResizeTextarea(askQuestionInput);
    updateCharCount();
  });

  askQuestionInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!askSubmitBtn?.disabled && askQuestionInput.value.trim().length > 0) {
        askForm?.requestSubmit();
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 4. File Drag & Drop and Upload
  // ---------------------------------------------------------------------------
  docFileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showGlobalError("file_too_large", `File size (${formatBytes(file.size)}) exceeds 2 MB limit`);
      docFileInput.value = "";
      return;
    }
    if (!docTitleInput.value) {
      docTitleInput.value = file.name.replace(/\.[^/.]+$/, "");
    }
    const reader = new FileReader();
    reader.onload = (ev) => { docTextInput.value = ev.target?.result || ""; };
    reader.onerror = () => showGlobalError("file_read_error", "Failed to read text file");
    reader.readAsText(file, "utf-8");
  });

  // ---------------------------------------------------------------------------
  // 5. Document Ingestion Form
  // ---------------------------------------------------------------------------
  docForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearGlobalError();
    const title = docTitleInput.value.trim();
    const text = docTextInput.value.trim();
    if (!title || !text) return showGlobalError("validation_error", "Title and content required");

    const payload = {
      title,
      text,
      chunking: {
        strategy: docStrategySelect.value,
        max_chars: parseInt(docMaxCharsInput.value, 10) || 800,
        overlap_chars: parseInt(docOverlapCharsInput.value, 10) || 100
      }
    };

    await withButtonBusy(docIngestBtn, async () => {
      try {
        const res = await api.ingestDoc(payload);
        if (docTitleInput) docTitleInput.value = "";
        if (docTextInput) docTextInput.value = "";
        if (docFileInput) docFileInput.value = "";
        showToast(`Ingested "${title}" (${res.chunks} chunks)`, "success");
        await refreshDocumentsList();
      } catch (err) {
        showGlobalError(err.code, `Ingestion failed: ${err.message}`);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Reset Documents (2-Step Confirm)
  // ---------------------------------------------------------------------------
  let docResetTimer = null;
  let isDocResetPending = false;

  function cancelDocResetPrompt() {
    if (docResetTimer) {
      clearTimeout(docResetTimer);
      docResetTimer = null;
    }
    isDocResetPending = false;
    if (docResetBtn) docResetBtn.textContent = "Reset";
    if (docResetCancelBtn) docResetCancelBtn.classList.add("hidden");
  }

  docResetCancelBtn?.addEventListener("click", cancelDocResetPrompt);

  docResetBtn?.addEventListener("click", async () => {
    if (!isDocResetPending) {
      isDocResetPending = true;
      docResetBtn.textContent = "Confirm";
      docResetCancelBtn?.classList.remove("hidden");
      docResetTimer = setTimeout(cancelDocResetPrompt, 5000);
      return;
    }

    cancelDocResetPrompt();
    clearGlobalError();
    await withButtonBusy(docResetBtn, async () => {
      try {
        await api.resetDocs();
        showToast("All documents deleted and collection reset", "info");
        await refreshDocumentsList();
      } catch (err) {
        showGlobalError(err.code, `Reset failed: ${err.message}`);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Refresh Ingested Documents List
  // ---------------------------------------------------------------------------
  async function refreshDocumentsList() {
    if (!docsListContainer) return;
    try {
      const res = await api.getDocs();
      const docs = res.documents || [];
      cachedDocsCount = docs.length;
      if (docsCountLabel) docsCountLabel.textContent = String(docs.length);
      if (askAnswerBox?.classList.contains("empty")) {
        renderEmptyState();
      }

      while (docsListContainer.firstChild) {
        docsListContainer.removeChild(docsListContainer.firstChild);
      }

      if (docs.length === 0) {
        docsListContainer.appendChild(
          el("p", { className: "text-muted empty-state" }, "No documents ingested yet.")
        );
        return;
      }

      docs.forEach(doc => {
        let chunkDrawer = null;
        let isExpanded = false;

        const expandBtn = el("button", { type: "button", className: "btn btn-sm btn-ghost" }, "Chunks");
        expandBtn.addEventListener("click", async () => {
          if (isExpanded) {
            chunkDrawer?.remove();
            chunkDrawer = null;
            isExpanded = false;
            expandBtn.textContent = "Chunks";
            return;
          }
          expandBtn.disabled = true;
          try {
            const detail = await api.getDoc(doc.id);
            chunkDrawer = el(
              "div",
              { className: "doc-chunks-drawer" },
              ...(detail.chunks || []).map(ch =>
                el("div", { className: "chunk-excerpt" }, `[Chunk ${ch.index}] (${ch.start}-${ch.end}):\n${ch.text}`)
              )
            );
            card.appendChild(chunkDrawer);
            isExpanded = true;
            expandBtn.textContent = "Hide";
          } catch (err) {
            showGlobalError(err.code, `Load chunks failed: ${err.message}`);
          } finally {
            expandBtn.disabled = false;
          }
        });

        const deleteBtn = el("button", {
          type: "button",
          className: "btn btn-sm btn-ghost",
          title: `Delete "${doc.title}"`,
          "aria-label": `Delete ${doc.title}`
        });
        deleteBtn.appendChild(createIcon("trash", 14));

        deleteBtn.addEventListener("click", async () => {
          if (!confirm(`Delete document "${doc.title}"?`)) return;
          try {
            await api.deleteDoc(doc.id);
            showToast(`Deleted "${doc.title}"`, "info");
            await refreshDocumentsList();
          } catch (err) {
            showGlobalError(err.code, `Delete failed: ${err.message}`);
          }
        });

        const card = el(
          "div",
          { className: "doc-item" },
          el("div", { className: "doc-item-header" },
            el("div", { className: "doc-item-info" },
              el("div", { className: "doc-title-text" }, doc.title),
              el("div", { className: "doc-meta-text" }, `${doc.chunks} chunks \u00B7 ${formatBytes(doc.bytes)} \u00B7 ${doc.strategy}`)
            ),
            el("div", { className: "doc-item-actions" }, expandBtn, deleteBtn)
          )
        );

        docsListContainer.appendChild(card);
      });
    } catch (err) {
      while (docsListContainer.firstChild) {
        docsListContainer.removeChild(docsListContainer.firstChild);
      }
      docsListContainer.appendChild(
        el("p", { className: "text-muted" }, `Error: ${err.message}`)
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Message Thread Rendering & Glass-Box Component
  // ---------------------------------------------------------------------------
  function formatMessageTime(timestamp) {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function createSuggestionChip(qText) {
    const chip = el("button", {
      type: "button",
      className: "ask-suggestion-chip",
      title: qText
    },
      createIcon("chat", 15, "ask-suggestion-icon"),
      el("span", {}, qText)
    );
    chip.addEventListener("click", () => {
      if (askQuestionInput) {
        askQuestionInput.value = qText;
        autoResizeComposer();
        askQuestionInput.focus();
      }
    });
    return chip;
  }

  function renderEmptyState() {
    if (!askAnswerBox) return;
    while (askAnswerBox.firstChild) {
      askAnswerBox.removeChild(askAnswerBox.firstChild);
    }
    askAnswerBox.className = "answer-box empty";
    if (askQuestionInput) {
      askQuestionInput.placeholder = "Ask a question about your documents...";
    }

    const titleEl = el("h3", { className: "empty-state-title ask-empty-title" },
      document.createTextNode("Ask your "),
      el("span", { className: "text-accent" }, "documents")
    );

    const emptyContainer = el("div", { className: "empty-state ask-empty-state" },
      el("div", { className: "empty-state-icon ask-empty-icon" },
        createIcon("document", 44)
      ),
      titleEl,
      el("p", { className: "empty-state-description ask-empty-desc" },
        "Answers come only from your documents, and you can see how each one was made."
      ),
      el("div", { className: "ask-empty-actions" },
        el("button", {
          type: "button",
          id: "ask-empty-load-sample-btn",
          className: "btn btn-secondary",
          title: "Load sample document"
        },
          createIcon("plus", 14),
          el("span", {}, "Load sample document")
        )
      ),
      el("div", { className: "ask-suggestion-chips" },
        createSuggestionChip("Summarize the key points from this document."),
        createSuggestionChip("What does the HNSW algorithm do?"),
        createSuggestionChip("How is vector search different from keyword search?")
      )
    );

    const sampleBtn = emptyContainer.querySelector("#ask-empty-load-sample-btn");
    sampleBtn?.addEventListener("click", () => {
      docLoadSampleBtn?.click();
    });

    askAnswerBox.appendChild(emptyContainer);
  }

  function renderMessages(messages) {
    if (!askAnswerBox) return;

    while (askAnswerBox.firstChild) {
      askAnswerBox.removeChild(askAnswerBox.firstChild);
    }

    if (!messages || messages.length === 0) {
      renderEmptyState();
      return;
    }

    askAnswerBox.className = "answer-box";
    if (askQuestionInput) {
      askQuestionInput.placeholder = "Ask a follow-up question...";
    }

    messages.forEach((msg, idx) => {
      const isLastAssistant = (msg.role === "assistant" && idx === messages.length - 1);
      const row = el("div", { className: `chat-bubble-row ${msg.role}` });

      if (msg.role === "user") {
        const userIcon = createIcon("user", 16, "chat-msg-user-icon");
        const userText = el("span", { className: "chat-msg-user-text" }, msg.content);
        const userTime = el("span", { className: "chat-msg-time" }, formatMessageTime(msg.timestamp));
        const bubble = el("div", { className: "chat-bubble-user" },
          el("div", { className: "chat-msg-left" }, userIcon, userText),
          userTime
        );
        row.appendChild(bubble);
      } else {
        const bubble = el("div", { className: "chat-bubble-assistant" });

        const assistantLogo = createIcon("layers", 18, "chat-msg-assistant-icon");
        const assistantTime = el("span", { className: "chat-msg-time" }, formatMessageTime(msg.timestamp));
        const assistantHeader = el("div", { className: "chat-assistant-header" },
          assistantLogo,
          assistantTime
        );
        bubble.appendChild(assistantHeader);

        const contentEl = el("div", { className: "chat-assistant-content" });
        renderCitationsInElement(msg.content, contentEl);
        bubble.appendChild(contentEl);

        // Action bar: Copy & Regenerate
        const actions = el("div", { className: "chat-msg-actions" });
        const copyBtn = el("button", { type: "button", className: "chat-msg-action-btn", title: "Copy answer" },
          createIcon("copy", 12),
          el("span", {}, "Copy")
        );
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(msg.content);
          showToast("Answer copied to clipboard", "success");
        });
        actions.appendChild(copyBtn);

        if (isLastAssistant) {
          const regenBtn = el("button", { type: "button", className: "chat-msg-action-btn", title: "Regenerate answer" },
            createIcon("explore", 12),
            el("span", {}, "Regenerate")
          );
          regenBtn.addEventListener("click", () => {
            regenerateLastAnswer();
          });
          actions.appendChild(regenBtn);
        }

        bubble.appendChild(actions);

        // Glass-box explainability accordion
        if (msg.sources && msg.sources.length > 0) {
          const glassBox = buildGlassBoxDetails(msg.sources, msg.timings, msg.question || "");
          bubble.appendChild(glassBox);
        }

        row.appendChild(bubble);
      }

      askAnswerBox.appendChild(row);
    });

    // Scroll to bottom
    const thread = byId("chat-thread-container");
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }

  function renderCitationsInElement(text, targetEl) {
    while (targetEl.firstChild) {
      targetEl.removeChild(targetEl.firstChild);
    }

    const segments = parseCitations(text);
    segments.forEach(seg => {
      if (seg.type === "citation") {
        const pill = el("button", {
          type: "button",
          className: "citation-pill",
          title: `Jump to source [${seg.n}]`
        }, `[${seg.n}]`);

        pill.addEventListener("click", () => {
          const card = document.getElementById(`source-card-${seg.n}`);
          if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            card.classList.add("highlighted");
            setTimeout(() => card.classList.remove("highlighted"), 1500);
          }
        });
        targetEl.appendChild(pill);
      } else {
        targetEl.appendChild(document.createTextNode(seg.text));
      }
    });
  }

  function buildGlassBoxDetails(sources, timings, question = "") {
    const details = el("details", { className: "glass-box-details", open: "true" });
    const summary = el(
      "summary",
      { className: "glass-box-summary" },
      createIcon("chevronUp", 14, "glass-box-chevron"),
      el("span", { className: "glass-box-summary-title" }, "How this was answered")
    );
    details.appendChild(summary);

    const body = el("div", { className: "glass-box-body" });

    // Panel A: Retrieved source chunks
    const sourcesHeader = el("div", { className: "glass-sub-header" },
      createIcon("document", 14),
      el("span", {}, `Retrieved source chunks (${sources.length})`)
    );
    body.appendChild(sourcesHeader);

    const sourcesList = el("div", { className: "glass-box-sources-list" });
    sources.forEach(src => {
      const meterFill = el("div", { className: "meter-fill" });
      meterFill.style.setProperty("width", `${Math.round((src.similarity || 0) * 100)}%`);

      const card = el(
        "div",
        { id: `source-card-${src.n}`, className: "source-card" },
        el("div", { className: "source-meta" },
          createIcon("document", 14, "source-icon"),
          el("div", { className: "source-title-group" },
            el("span", { className: "source-doc-name" }, src.title || "document"),
            el("span", { className: "source-chunk-idx" }, `Chunk #${src.chunk_index ?? src.n}`)
          )
        ),
        el("div", { className: "source-sim-col" },
          el("span", { className: "source-sim-val" }, formatSimilarity(src.similarity)),
          el("div", { className: "similarity-meter" },
            el("div", { className: "meter-track" }, meterFill)
          )
        ),
        el("p", { className: "source-snippet" }, src.text || "")
      );
      sourcesList.appendChild(card);
    });
    body.appendChild(sourcesList);

    // Panel B: Latency (RAG pipeline)
    if (timings && typeof timings === "object") {
      const latencyHeader = el("div", { className: "glass-sub-header" },
        createIcon("clock", 14),
        el("span", {}, "Latency (RAG pipeline)")
      );
      body.appendChild(latencyHeader);

      const items = formatPipelineLatency(timings);
      const flow = el("div", { className: "glass-box-timings-flow" });
      items.forEach((it, idx) => {
        if (idx > 0) {
          flow.appendChild(
            el("div", { className: "glass-timing-arrow" }, createIcon("arrowRight", 12))
          );
        }
        flow.appendChild(
          el("div", { className: `glass-timing-item${it.isTotal ? " accent" : ""}` },
            el("span", { className: "glass-timing-label" }, it.label),
            el("span", { className: "glass-timing-val" }, formatDuration(it.ms))
          )
        );
      });
      body.appendChild(flow);
    }

    // Panel C: Three action buttons (Open Explore, Compare algorithms, Trace HNSW path)
    const actionsRow = el("div", { className: "glass-box-actions" });

    // 1. Open Explore
    const exploreBtn = el("button", {
      type: "button",
      className: "btn btn-secondary",
      title: "Open Explore tab with Document Chunks and query prefilled"
    }, createIcon("external", 14), el("span", {}, "Open Explore"));

    exploreBtn.addEventListener("click", () => {
      const collSelect = document.getElementById("explore-coll-select");
      if (collSelect && collSelect.value !== "docs") {
        collSelect.value = "docs";
        collSelect.dispatchEvent(new Event("change"));
      }
      const queryInput = document.getElementById("explore-query-docs-input");
      if (queryInput && question) {
        queryInput.value = question;
      }
      const tab = document.getElementById("tab-btn-explore");
      if (tab) tab.click();
    });
    actionsRow.appendChild(exploreBtn);

    // 2. Compare algorithms
    const compareBtn = el("button", {
      type: "button",
      className: "btn btn-secondary",
      title: "Benchmark Brute Force vs KD-Tree vs HNSW on this question"
    }, createIcon("chart", 14), el("span", {}, "Compare algorithms"));

    const benchResults = el("div", { className: "glass-box-bench-results hidden" });
    compareBtn.addEventListener("click", async () => {
      compareBtn.disabled = true;
      const span = compareBtn.querySelector("span");
      if (span) span.textContent = "Benchmarking...";
      try {
        const bRes = await api.benchmarkDocs({ query: question, k: 5 });
        while (benchResults.firstChild) {
          benchResults.removeChild(benchResults.firstChild);
        }
        const rows = formatBenchmarkRows(bRes);
        if (rows.length === 0) {
          benchResults.appendChild(
            el("div", { className: "text-muted text-xs" }, "No benchmark metrics returned.")
          );
        } else {
          rows.forEach(r => {
            const swatch = el("span", { className: `legend-swatch swatch-${r.key} mr-1` });
            const rowEl = el("div", { className: "bench-row" },
              el("span", { className: "bench-name" }, swatch, r.name),
              el("span", { className: "bench-stat" }, r.latencyFormatted),
              el("span", { className: "bench-stat text-muted" }, `${r.distanceComputations} dist`),
              el("span", { className: "bench-stat text-muted" }, `Recall: ${r.recallFormatted}`)
            );
            const track = el("div", { className: "bench-bar-track" });
            const fill = el("div", { className: `bench-bar-fill swatch-${r.key}` });
            fill.style.setProperty("width", `${r.percent}%`);
            track.appendChild(fill);
            const item = el("div", { className: "bench-item" }, rowEl, track);
            benchResults.appendChild(item);
          });
        }
        benchResults.classList.remove("hidden");
      } catch (err) {
        showToast(`Benchmark error: ${err.message}`, "error");
        while (benchResults.firstChild) {
          benchResults.removeChild(benchResults.firstChild);
        }
        benchResults.appendChild(
          el("div", { className: "text-danger text-xs" }, `Benchmark error: ${err.message}`)
        );
        benchResults.classList.remove("hidden");
      } finally {
        compareBtn.disabled = false;
        if (span) span.textContent = "Compare algorithms";
      }
    });
    actionsRow.appendChild(compareBtn);

    // 3. Trace HNSW path
    const traceBtn = el("button", {
      type: "button",
      className: "btn btn-secondary",
      title: "Trace HNSW navigation hops on this question"
    }, createIcon("graph", 14), el("span", {}, "Trace HNSW path"));

    const traceResults = el("div", { className: "glass-box-trace-results hidden" });
    traceBtn.addEventListener("click", async () => {
      traceBtn.disabled = true;
      const span = traceBtn.querySelector("span");
      if (span) span.textContent = "Tracing...";
      try {
        const tRes = await api.traceHnsw({ collection: "docs", query: question, k: 3 });
        while (traceResults.firstChild) {
          traceResults.removeChild(traceResults.firstChild);
        }
        const summary = formatTraceSummary(tRes);
        traceResults.appendChild(
          el("div", { className: "trace-summary-text" }, summary.summaryText)
        );
        traceResults.classList.remove("hidden");
      } catch (err) {
        showToast(`Trace error: ${err.message}`, "error");
        while (traceResults.firstChild) {
          traceResults.removeChild(traceResults.firstChild);
        }
        traceResults.appendChild(
          el("div", { className: "text-danger text-xs" }, `Trace error: ${err.message}`)
        );
        traceResults.classList.remove("hidden");
      } finally {
        traceBtn.disabled = false;
        if (span) span.textContent = "Trace HNSW path";
      }
    });
    actionsRow.appendChild(traceBtn);

    body.appendChild(actionsRow);
    body.appendChild(benchResults);
    body.appendChild(traceResults);

    details.appendChild(body);
    return details;
  }

  // ---------------------------------------------------------------------------
  // 9. Ask Question & Streaming Handling
  // ---------------------------------------------------------------------------
  async function submitQuestion(questionText) {
    const question = questionText.trim();
    if (!question) return;

    clearGlobalError();
    const k = parseInt(askKInput?.value, 10) || 3;
    const algorithm = askAlgoSelect?.value || "hnsw";

    if (!activeChatId) {
      startNewChat();
    }
    const currentChat = getChatData(activeChatId) || {
      id: activeChatId,
      title: question.slice(0, 32),
      createdAt: Date.now(),
      messages: []
    };

    if (currentChat.messages.length === 0) {
      currentChat.title = question.slice(0, 32);
    }

    // Append user message
    currentChat.messages.push({
      role: "user",
      content: question,
      timestamp: Date.now()
    });
    saveChatData(currentChat);

    // Prepare multi-turn history (capped to last 6 messages)
    const historyPayload = currentChat.messages.slice(0, -1).slice(-6).map(m => ({
      role: m.role,
      content: m.content
    }));

    // UI state: add user bubble and empty assistant bubble
    askQuestionInput.value = "";
    autoResizeTextarea(askQuestionInput);
    updateCharCount();

    renderMessages(currentChat.messages);

    // Create live assistant bubble at bottom
    const thread = byId("chat-thread-container");
    const assistantRow = el("div", { className: "chat-bubble-row assistant" });
    const assistantBubble = el("div", { className: "chat-bubble-assistant" });
    const contentEl = el("div", { className: "chat-assistant-content streaming" }, "Thinking...");
    assistantBubble.appendChild(contentEl);
    assistantRow.appendChild(assistantBubble);
    askAnswerBox.appendChild(assistantRow);

    if (thread) thread.scrollTop = thread.scrollHeight;

    currentAbortController = new AbortController();
    askSubmitBtn.disabled = true;
    askStopBtn.disabled = false;
    askStopBtn.classList.remove("hidden");

    clearTimeout(thinkTimer);
    askLoadingNotice?.classList.add("hidden");
    thinkTimer = setTimeout(() => askLoadingNotice?.classList.remove("hidden"), 3000);

    let rawAnswer = "";
    let firstTokenReceived = false;
    let retrievedSources = [];
    let timingStats = null;

    try {
      const response = await fetch("/api/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          k,
          algorithm,
          history: historyPayload,
          temperature: 0.0,
          seed: 42
        }),
        signal: currentAbortController.signal
      });

      if (!response.ok) {
        clearTimeout(thinkTimer);
        askLoadingNotice?.classList.add("hidden");
        const errJson = await response.json().catch(() => null);
        const code = errJson?.error?.code || "http_error";
        const msg = errJson?.error?.message || `HTTP ${response.status}`;
        showGlobalError(code, msg);
        contentEl.classList.remove("streaming");
        contentEl.textContent = `Error: ${msg}`;
        return;
      }

      await readSseStream(response, {
        signal: currentAbortController.signal,
        onEvent: ({ event, data }) => {
          if (event === "sources") {
            try {
              const parsed = JSON.parse(data);
              retrievedSources = parsed.sources || [];
              if (sourcesCountLabel) sourcesCountLabel.textContent = String(retrievedSources.length);
            } catch (_) {}
          } else if (event === "token") {
            if (!firstTokenReceived) {
              firstTokenReceived = true;
              clearTimeout(thinkTimer);
              askLoadingNotice?.classList.add("hidden");
              contentEl.replaceChildren();
            }
            try {
              const parsed = JSON.parse(data);
              const piece = parsed.t !== undefined ? parsed.t : (parsed.token || "");
              rawAnswer += piece;
              renderCitationsInElement(rawAnswer, contentEl);
              if (thread) thread.scrollTop = thread.scrollHeight;
            } catch (_) {}
          } else if (event === "done") {
            clearTimeout(thinkTimer);
            askLoadingNotice?.classList.add("hidden");
            try {
              const parsed = JSON.parse(data);
              timingStats = parsed.timings || {};
            } catch (_) {}
          } else if (event === "error") {
            clearTimeout(thinkTimer);
            askLoadingNotice?.classList.add("hidden");
            try {
              const parsed = JSON.parse(data);
              contentEl.appendChild(el("div", { className: "notice-box notice-warning" }, `Error: ${parsed.message || data}`));
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
          contentEl.classList.remove("streaming");

          // Save assistant message to chat history
          const finalAnswer = rawAnswer || contentEl.textContent || "";
          currentChat.messages.push({
            role: "assistant",
            content: finalAnswer,
            timestamp: Date.now(),
            sources: retrievedSources,
            timings: timingStats,
            question: question
          });
          saveChatData(currentChat);

          // Re-render full message list to attach action bar and glass-box accordion
          renderMessages(currentChat.messages);
        }
      });
    } catch (err) {
      clearTimeout(thinkTimer);
      askLoadingNotice?.classList.add("hidden");
      if (err.name !== "AbortError") {
        showGlobalError("stream_failed", err.message);
      }
      contentEl.classList.remove("streaming");
    } finally {
      clearTimeout(thinkTimer);
      askLoadingNotice?.classList.add("hidden");
      askSubmitBtn.disabled = false;
      askStopBtn.disabled = true;
      askStopBtn.classList.add("hidden");
      currentAbortController = null;
    }
  }

  function regenerateLastAnswer() {
    if (!activeChatId) return;
    const chat = getChatData(activeChatId);
    if (!chat || !chat.messages || chat.messages.length === 0) return;

    // Pop the last assistant message
    if (chat.messages[chat.messages.length - 1].role === "assistant") {
      chat.messages.pop();
    }
    // Find the previous user question
    const lastUser = [...chat.messages].reverse().find(m => m.role === "user");
    if (!lastUser) return;

    // Remove user message from chat array and resubmit
    chat.messages.pop();
    saveChatData(chat);
    submitQuestion(lastUser.content);
  }

  askForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuestion(askQuestionInput.value);
  });

  askStopBtn?.addEventListener("click", () => {
    currentAbortController?.abort();
  });

  // ---------------------------------------------------------------------------
  // 10. Listen to Global Chat Events from Sidebar
  // ---------------------------------------------------------------------------
  window.addEventListener("vectordb:new-chat", () => {
    startNewChat();
  });

  window.addEventListener("vectordb:load-chat", (e) => {
    if (e.detail?.chatId) {
      loadChat(e.detail.chatId);
    }
  });

  window.addEventListener("vectordb:delete-chat", (e) => {
    if (e.detail?.chatId) {
      deleteChat(e.detail.chatId);
    }
  });

  window.addEventListener("vectordb:clear-all-chats", () => {
    startNewChat();
  });

  // ---------------------------------------------------------------------------
  // 11. Initial Boot
  // ---------------------------------------------------------------------------
  refreshDocumentsList();

  const index = getChatsIndex();
  if (index.length > 0) {
    loadChat(index[0].id);
  } else {
    startNewChat();
  }
}
