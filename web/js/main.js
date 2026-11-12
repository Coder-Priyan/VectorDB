/**
 * VectorDB Web UI Main Entry Point
 *
 * Boots the UI application: manages tab navigation,
 * Ollama background status polling, and tab controllers.
 */

import { api } from "./api.js";
import { initTabs, updateOllamaBadge } from "./ui.js";
import { initAskTab } from "./ask.js";
import { initSettingsTab } from "./settings.js";
import { initExploreTab } from "./explore.js";
import { initHnswTab } from "./hnsw.js";
import { initCompareTab } from "./compare.js";

async function checkOllamaStatus() {
  const badgeEl = document.getElementById("ollama-status-badge");
  if (!badgeEl) return;
  try {
    const status = await api.getOllamaStatus();
    updateOllamaBadge(status, badgeEl);
  } catch (_) {
    updateOllamaBadge({ reachable: false }, badgeEl);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Tab Navigation
  initTabs(".tab-nav");

  // 2. Ollama Status Check and Refresh Button
  const checkBtn = document.getElementById("ollama-check-btn");
  checkBtn?.addEventListener("click", checkOllamaStatus);
  checkOllamaStatus();

  // 3. Initialize Functional Tabs
  initAskTab();
  initSettingsTab();
  initExploreTab();
  initHnswTab();
  initCompareTab();
});
