/**
 * VectorDB Settings & System Configuration Controller
 *
 * Manages system health inspections, demo collection resets, random vector
 * generation, and document collection wiping.
 */

import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { el, formatBytes, formatOllamaModels } from "./ui.js";

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
      if (metricSelect && config?.metric) metricSelect.value = config.metric;
      if (mInput && config?.hnsw?.M) mInput.value = config.hnsw.M;
      if (efcInput && config?.hnsw?.efConstruction) efcInput.value = config.hnsw.efConstruction;

      if (footerVersionEl && health.version) {
        footerVersionEl.textContent = `v${health.version}`;
      }

      healthBox.replaceChildren(
        el("table", { className: "info-table" },
          el("tbody", {},
            el("tr", {}, el("td", {}, "Server status"), el("td", {}, health.status || "healthy")),
            el("tr", {}, el("td", {}, "Server version"), el("td", {}, health.version || "-")),
            el("tr", {}, el("td", {}, "Dimension"), el("td", {}, config.dimension)),
            el("tr", {}, el("td", {}, "Metric"), el("td", {}, config.metric)),
            el("tr", {}, el("td", {}, "HNSW parameters"), el("td", {}, `M=${config.hnsw?.M}, efC=${config.hnsw?.efConstruction}, efS=${config.hnsw?.efSearch}`)),
            el("tr", {}, el("td", {}, "Vectors count"), el("td", {}, stats.count)),
            el("tr", {}, el("td", {}, "Memory (approx)"), el("td", {}, formatBytes(stats.memory_bytes || 0))),
            el("tr", {}, el("td", {}, "Ollama models"), el("td", {}, formatOllamaModels(ollama)))
          )
        )
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

  // Refresh status when Settings tab is activated
  const settingsTabBtn = document.getElementById("tab-btn-settings");
  if (settingsTabBtn) {
    settingsTabBtn.addEventListener("click", () => {
      loadSystemStatus();
    });
  }

  loadSystemStatus();
}

