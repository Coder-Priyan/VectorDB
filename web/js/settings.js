/**
 * VectorDB Settings & System Configuration Controller
 *
 * Manages system health inspections, demo collection resets, random vector
 * generation, and document collection wiping.
 */

import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { el, formatBytes } from "./ui.js";

export function initSettingsTab() {
  const healthBox = document.getElementById("settings-health-box");
  const resetDemoForm = document.getElementById("settings-reset-demo-form");
  const randomDemoForm = document.getElementById("settings-random-demo-form");
  const resetDemoBtn = document.getElementById("demo-reset-btn");
  const insertRandomBtn = document.getElementById("demo-insert-random-btn");
  const footerVersionEl = document.getElementById("footer-version");

  /**
   * Loads and renders system health, config, and collection statistics.
   */
  async function loadSystemStatus() {
    if (!healthBox) return;
    try {
      const [health, config, stats] = await Promise.all([
        api.getHealth(),
        api.getConfig(),
        api.getStats()
      ]);

      if (footerVersionEl && health.version) {
        footerVersionEl.textContent = `v${health.version}`;
      }

      healthBox.replaceChildren(
        el("table", { className: "info-table" },
          el("tbody", {},
            el("tr", {}, el("td", {}, "Server Status"), el("td", {}, health.status || "healthy")),
            el("tr", {}, el("td", {}, "Server Version"), el("td", {}, health.version || "-")),
            el("tr", {}, el("td", {}, "Demo Dimension"), el("td", {}, config.dimension)),
            el("tr", {}, el("td", {}, "Demo Metric"), el("td", {}, config.metric)),
            el("tr", {}, el("td", {}, "HNSW Parameters"), el("td", {}, `M=${config.hnsw?.M}, efC=${config.hnsw?.efConstruction}, efS=${config.hnsw?.efSearch}`)),
            el("tr", {}, el("td", {}, "Demo Vectors Count"), el("td", {}, stats.count)),
            el("tr", {}, el("td", {}, "Demo Memory (Approx)"), el("td", {}, formatBytes(stats.memory_bytes || 0)))
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
          alert("Demo collection reset successfully!");
        } catch (err) {
          showGlobalError(err.code, `Reset failed: ${err.message}`);
        }
      });
    });
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
          alert(`Inserted ${res.inserted || count} random vectors!`);
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

