/**
 * VectorDB Web UI Main Entry Point
 *
 * Boots the UI application: manages tab navigation,
 * Ollama background status polling, and tab controllers.
 */

import { api } from "./api.js";
import { initTabs, updateOllamaBadge } from "./ui.js";
import { initSidebar } from "./sidebar.js";
import { initCommandPalette } from "./palette.js";
import { createInfoButton, startGuidedTour } from "./learn_content.js";
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
  // 1. Initialize Sidebar & App Shell
  initSidebar();
  initCommandPalette();

  // 2. Initialize Tab Navigation
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

  // 4. Mount Educational Info Buttons
  document.getElementById("ask-info-slot")?.appendChild(createInfoButton("rag"));
  document.getElementById("explore-info-slot")?.appendChild(createInfoButton("pca"));
  document.getElementById("hnsw-info-slot")?.appendChild(createInfoButton("hnsw"));
  document.getElementById("compare-info-slot")?.appendChild(createInfoButton("bruteforce"));
  document.getElementById("settings-info-slot")?.appendChild(createInfoButton("embeddings"));

  // 5. Check first-run guided tour
  startGuidedTour(false);
});
