/**
 * VectorDB Settings & System Configuration Controller
 *
 * Manages system health inspections, demo collection resets, random vector
 * generation, and document collection wiping.
 */

import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { el, formatBytes, createDropdown } from "./ui.js";
import { createIcon } from "./icons.js";

export function initSettingsTab() {
  const healthBox = document.getElementById("settings-health-box");
  const resetDemoForm = document.getElementById("settings-reset-demo-form");
  const randomDemoForm = document.getElementById("settings-random-demo-form");
  const resetDemoBtn = document.getElementById("demo-reset-btn");
  const resetDemoCancelBtn = document.getElementById("demo-reset-cancel-btn");
  const resetDemoStatus = document.getElementById("settings-reset-status");
  const insertRandomBtn = document.getElementById("demo-insert-random-btn");
  const randomStatus = document.getElementById("settings-random-status");
  const footerVersionEl = document.getElementById("footer-version");
  const statusTextEl = document.getElementById("settings-status-text");
  const modelsChipsEl = document.getElementById("settings-models-chips");
  const metricDropdownWrap = document.getElementById("demo-metric-dropdown-wrap");

  // Mount custom dark dropdown for Metric selection
  let metricDropdown = null;
  if (metricDropdownWrap) {
    metricDropdown = createDropdown(
      [
        { value: "cosine", label: "Cosine" },
        { value: "euclidean", label: "Euclidean" },
        { value: "manhattan", label: "Manhattan" }
      ],
      "cosine",
      null,
      { id: "demo-metric-select", ariaLabel: "Distance metric" }
    );
    metricDropdownWrap.replaceChildren(metricDropdown.element);
  }

  // Attach SVG icons to Documentation & Guides link buttons
  const testsIconSlot = document.getElementById("settings-tests-icon");
  if (testsIconSlot && testsIconSlot.children.length === 0) {
    testsIconSlot.appendChild(createIcon("external", 14));
  }

  const tourIconSlot = document.getElementById("settings-tour-icon");
  if (tourIconSlot && tourIconSlot.children.length === 0) {
    tourIconSlot.appendChild(createIcon("arrowRight", 14));
  }

  let resetStateTimer = null;
  let isResetPromptPending = false;

  function cancelResetPrompt() {
    if (resetStateTimer) {
      clearTimeout(resetStateTimer);
      resetStateTimer = null;
    }
    isResetPromptPending = false;
    if (resetDemoBtn) resetDemoBtn.textContent = "Reset Demo Collection";
    if (resetDemoCancelBtn) resetDemoCancelBtn.classList.add("hidden");
  }

  resetDemoCancelBtn?.addEventListener("click", cancelResetPrompt);

  /**
   * Loads and renders system health, config, and collection statistics.
   */
  async function loadSystemStatus() {
    if (!healthBox) return;
    try {
      const [health, config, stats, ollama] = await Promise.all([
        api.getHealth(),
        api.getConfig(),
        api.getStats(),
        api.getOllamaStatus().catch(() => ({ reachable: false, models: [] }))
      ]);

      const dimInput = document.getElementById("demo-dim-input");
      const metricSelect = document.getElementById("demo-metric-select");
      const mInput = document.getElementById("demo-m-input");
      const efcInput = document.getElementById("demo-efc-input");

      if (dimInput && config?.dimension) dimInput.value = config.dimension;
      if (metricDropdown && config?.metric) {
        metricDropdown.setValue(config.metric);
      } else if (metricSelect && config?.metric) {
        metricSelect.value = config.metric;
      }
      if (mInput && config?.hnsw?.M) mInput.value = config.hnsw.M;
      if (efcInput && config?.hnsw?.efConstruction) efcInput.value = config.hnsw.efConstruction;

      if (footerVersionEl && health.version) {
        footerVersionEl.textContent = `v${health.version}`;
      }

      if (statusTextEl) {
        statusTextEl.textContent = health.status || "ok";
      }

      // Update Persistence Status
      const persisStatusEl = document.getElementById("settings-persistence-status");
      const persisDirEl = document.getElementById("settings-persistence-dir");
      const persisHintEl = document.getElementById("settings-persistence-hint");

      if (health.persistence && health.persistence.enabled) {
        if (health.persistence.error) {
          if (persisStatusEl) persisStatusEl.textContent = `Active with error: ${health.persistence.error}`;
        } else {
          if (persisStatusEl) persisStatusEl.textContent = "Active (on-disk persistence)";
        }
        if (persisDirEl) persisDirEl.textContent = health.persistence.data_dir || "--";
        if (persisHintEl) persisHintEl.textContent = "Auto-saving collections on change. Snapshots loaded on startup.";
      } else {
        if (persisStatusEl) persisStatusEl.textContent = "Disabled (in-memory only)";
        if (persisDirEl) persisDirEl.textContent = "None (ephemeral)";
        if (persisHintEl) persisHintEl.textContent = "Pass --data-dir <path> on startup to persist collections across restarts.";
      }

      // Render Ollama Models chips
      if (modelsChipsEl) {
        if (!ollama || !ollama.reachable) {
          modelsChipsEl.replaceChildren(el("span", { className: "text-muted text-xs" }, "Ollama offline"));
        } else if (!ollama.models || ollama.models.length === 0) {
          modelsChipsEl.replaceChildren(el("span", { className: "text-muted text-xs" }, "None installed"));
        } else {
          modelsChipsEl.replaceChildren(
            ...ollama.models.map(m => el("span", { className: "settings-model-chip" }, m))
          );
        }
      }

      // Helper to construct a single metric tile in the 8-metric strip
      function makeMetricTile(label, value) {
        return el("div", { className: "settings-metric-tile" },
          el("span", { className: "settings-metric-label" }, label),
          el("span", { className: "settings-metric-val" }, value)
        );
      }

      // Render the 8 real server metrics in the strip
      healthBox.replaceChildren(
        makeMetricTile("Version", `v${health.version || "-"}`),
        makeMetricTile("Dimension", String(config?.dimension ?? "-")),
        makeMetricTile("Metric", String(config?.metric ?? "-")),
        makeMetricTile("M", String(config?.hnsw?.M ?? "-")),
        makeMetricTile("efConstruction", String(config?.hnsw?.efConstruction ?? "-")),
        makeMetricTile("efSearch", String(config?.hnsw?.efSearch ?? "-")),
        makeMetricTile("Vectors", String(stats?.count ?? 0)),
        makeMetricTile("Memory (approx)", formatBytes(stats?.memory_bytes || 0))
      );
    } catch (err) {
      healthBox.replaceChildren(
        el("p", { className: "text-muted" }, `Failed to load system status: ${err.message}`)
      );
    }
  }

  // Handle Demo Collection Reset
  if (resetDemoForm) {
    resetDemoForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearGlobalError();

      const dim = parseInt(document.getElementById("demo-dim-input").value, 10);
      const metric = document.getElementById("demo-metric-select").value;
      const M = parseInt(document.getElementById("demo-m-input").value, 10);
      const efConstruction = parseInt(document.getElementById("demo-efc-input").value, 10);

      const payload = {
        dimension: dim,
        metric,
        hnsw: {
          M,
          efConstruction
        }
      };

      await withButtonBusy(resetDemoBtn, async () => {
        try {
          await api.resetDemo(payload);
          await loadSystemStatus();
          if (resetDemoStatus) {
            resetDemoStatus.textContent = "Demo collection reset successfully.";
            resetDemoStatus.classList.remove("hidden");
            setTimeout(() => resetDemoStatus?.classList.add("hidden"), 5000);
          }
        } catch (err) {
          showGlobalError(err.code, `Reset failed: ${err.message}`);
        }
      });
    });

    if (resetDemoBtn) {
      resetDemoBtn.addEventListener("click", () => {
        if (!isResetPromptPending) {
          isResetPromptPending = true;
          resetDemoBtn.textContent = "Confirm reset";
          resetDemoCancelBtn?.classList.remove("hidden");
          resetStateTimer = setTimeout(cancelResetPrompt, 5000);
          return;
        }
        cancelResetPrompt();
        resetDemoForm.requestSubmit();
      });
    }
  }

  // Handle Random Demo Vectors Insertion
  if (randomDemoForm) {
    randomDemoForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearGlobalError();

      const count = parseInt(document.getElementById("demo-random-count").value, 10);
      if (isNaN(count) || count < 1 || count > 20000) {
        showGlobalError("validation_error", "Count must be between 1 and 20,000");
        return;
      }

      await withButtonBusy(insertRandomBtn, async () => {
        try {
          const res = await api.insertDemoRandom(count);
          await loadSystemStatus();
          if (randomStatus) {
            randomStatus.textContent = `Inserted ${res.inserted || count} random vectors.`;
            randomStatus.classList.remove("hidden");
            setTimeout(() => randomStatus?.classList.add("hidden"), 5000);
          }
        } catch (err) {
          showGlobalError(err.code, `Insert failed: ${err.message}`);
        }
      });
    });
  }

  // Handle Clear Chat History (two-step confirm)
  const clearChatsBtn = document.getElementById("settings-clear-chats-btn");
  const clearChatsCancelBtn = document.getElementById("settings-clear-chats-cancel-btn");
  const clearChatsStatus = document.getElementById("settings-clear-chats-status");
  let clearChatsTimer = null;
  let isClearChatsPending = false;

  function cancelClearChatsPrompt() {
    if (clearChatsTimer) {
      clearTimeout(clearChatsTimer);
      clearChatsTimer = null;
    }
    isClearChatsPending = false;
    if (clearChatsBtn) clearChatsBtn.textContent = "Clear Chat History";
    if (clearChatsCancelBtn) clearChatsCancelBtn.classList.add("hidden");
  }

  clearChatsCancelBtn?.addEventListener("click", cancelClearChatsPrompt);

  if (clearChatsBtn) {
    clearChatsBtn.addEventListener("click", () => {
      if (!isClearChatsPending) {
        isClearChatsPending = true;
        clearChatsBtn.textContent = "Confirm clear";
        clearChatsCancelBtn?.classList.remove("hidden");
        clearChatsTimer = setTimeout(cancelClearChatsPrompt, 5000);
        return;
      }
      cancelClearChatsPrompt();

      try {
        localStorage.removeItem("vectordb:chats");
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("vectordb:chats:")) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        window.dispatchEvent(new CustomEvent("vectordb:chats-updated", { detail: { activeChatId: null } }));
        window.dispatchEvent(new CustomEvent("vectordb:clear-all-chats"));
        if (clearChatsStatus) {
          clearChatsStatus.textContent = "Chat history cleared successfully.";
          clearChatsStatus.classList.remove("hidden");
          setTimeout(() => clearChatsStatus?.classList.add("hidden"), 5000);
        }
      } catch (err) {
        showGlobalError("storage_error", `Failed to clear chat history: ${err.message}`);
      }
    });
  }

  // Handle Guided Tour Trigger
  const startTourBtn = document.getElementById("settings-start-tour-btn");
  if (startTourBtn) {
    startTourBtn.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("vectordb:start-tour"));
    });
  }

  // Refresh status when Settings tab is activated
  const settingsTabBtn = document.getElementById("tab-btn-settings");
  if (settingsTabBtn) {
    settingsTabBtn.addEventListener("click", () => {
      loadSystemStatus();
    });
  }

  loadSystemStatus();
}

