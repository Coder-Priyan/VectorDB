/**
 * VectorDB Web UI Main Entry Point
 *
 * Boots the UI application: manages light/dark theme persistence, tab navigation,
 * Ollama background status polling, and tab controllers.
 */

import { api } from "./api.js";
import { initTabs, updateOllamaBadge } from "./ui.js";
import { initAskTab } from "./ask.js";
import { initSettingsTab } from "./settings.js";
import { initExploreTab } from "./explore.js";
import { initHnswTab } from "./hnsw.js";
import { initCompareTab } from "./compare.js";

function initTheme() {
  const themeBtn = document.getElementById("theme-toggle-btn");
  const storedTheme = localStorage.getItem("vectordb-theme");
  const root = document.documentElement;

  if (storedTheme) {
    root.setAttribute("data-theme", storedTheme);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }

  function updateButtonLabel() {
    if (!themeBtn) return;
    const current = root.getAttribute("data-theme");
    themeBtn.textContent = current === "dark" ? "Light Mode" : "Dark Mode";
  }

  updateButtonLabel();

  themeBtn?.addEventListener("click", () => {
    const current = root.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("vectordb-theme", next);
    updateButtonLabel();
  });
}

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
  // 1. Initialize Theme
  initTheme();

  // 2. Initialize Tab Navigation
  initTabs(".tab-nav");

  // 3. Ollama Status Check and Refresh Button
  const checkBtn = document.getElementById("ollama-check-btn");
  checkBtn?.addEventListener("click", checkOllamaStatus);
  checkOllamaStatus();

  // 4. Initialize Functional Tabs
  initAskTab();
  initSettingsTab();
  initExploreTab();
  initHnswTab();
  initCompareTab();
});

