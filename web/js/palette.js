/**
 * VectorDB Command Palette
 *
 * Keyboard-first (Ctrl+K / Cmd+K) command navigation.
 * Zero-innerHTML and strict CSP compliant.
 */

import { el } from "./ui.js";
import { createIcon } from "./icons.js";

const COMMANDS = [
  {
    id: "new-chat",
    title: "New chat",
    category: "Chat",
    icon: "plus",
    keywords: ["new", "chat", "ask", "reset"],
    action: () => {
      const btn = document.getElementById("sidebar-new-chat-btn");
      if (btn) btn.click();
    }
  },
  {
    id: "nav-ask",
    title: "Go to Ask (RAG)",
    category: "Navigation",
    icon: "chat",
    keywords: ["ask", "rag", "chat", "query", "answer"],
    action: () => {
      const tab = document.getElementById("tab-btn-ask");
      if (tab) tab.click();
    }
  },
  {
    id: "nav-explore",
    title: "Go to Explore (PCA)",
    category: "Navigation",
    icon: "explore",
    keywords: ["explore", "pca", "2d", "projection", "visualize"],
    action: () => {
      const tab = document.getElementById("tab-btn-explore");
      if (tab) tab.click();
    }
  },
  {
    id: "nav-hnsw",
    title: "Go to HNSW Graph",
    category: "Navigation",
    icon: "graph",
    keywords: ["hnsw", "graph", "layers", "trace", "search path"],
    action: () => {
      const tab = document.getElementById("tab-btn-hnsw");
      if (tab) tab.click();
    }
  },
  {
    id: "nav-compare",
    title: "Go to Compare",
    category: "Navigation",
    icon: "compare",
    keywords: ["compare", "benchmark", "recall", "speed", "brute force", "kd-tree"],
    action: () => {
      const tab = document.getElementById("tab-btn-compare");
      if (tab) tab.click();
    }
  },
  {
    id: "nav-settings",
    title: "Go to Settings",
    category: "Navigation",
    icon: "settings",
    keywords: ["settings", "config", "server", "reset", "demo"],
    action: () => {
      const tab = document.getElementById("tab-btn-settings");
      if (tab) tab.click();
    }
  },
  {
    id: "run-tour",
    title: "Re-run guided tour",
    category: "Help",
    icon: "info",
    keywords: ["tour", "help", "tutorial", "guide", "onboarding"],
    action: () => {
      window.dispatchEvent(new CustomEvent("vectordb:start-tour"));
    }
  },
  {
    id: "inspect-ollama",
    title: "Inspect Ollama status",
    category: "System",
    icon: "search",
    keywords: ["ollama", "status", "health", "model", "ping"],
    action: () => {
      const btn = document.getElementById("ollama-check-btn");
      if (btn) btn.click();
    }
  },
  {
    id: "clear-demo",
    title: "Clear demo collection",
    category: "Data",
    icon: "trash",
    keywords: ["clear", "reset", "demo", "vectors"],
    action: () => {
      const tab = document.getElementById("tab-btn-settings");
      if (tab) tab.click();
      const resetBtn = document.getElementById("demo-reset-btn");
      if (resetBtn) resetBtn.scrollIntoView({ behavior: "smooth" });
    }
  },
  {
    id: "clear-docs",
    title: "Clear documents collection",
    category: "Data",
    icon: "trash",
    keywords: ["clear", "reset", "docs", "documents", "rag"],
    action: () => {
      const tab = document.getElementById("tab-btn-ask");
      if (tab) tab.click();
      const resetBtn = document.getElementById("doc-reset-btn");
      if (resetBtn) resetBtn.click();
    }
  }
];

export function initCommandPalette() {
  const modal = document.getElementById("command-palette-modal");
  const input = document.getElementById("command-palette-input");
  const list = document.getElementById("command-palette-list");
  const openBtn = document.getElementById("open-palette-btn");

  if (!modal || !input || !list) return;

  let activeIndex = 0;
  let filteredCommands = [...COMMANDS];

  function renderList() {
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (filteredCommands.length === 0) {
      const empty = el("div", { className: "palette-empty" }, "No commands found");
      list.appendChild(empty);
      return;
    }

    filteredCommands.forEach((cmd, idx) => {
      const isSelected = idx === activeIndex;
      const item = el(
        "div",
        {
          className: `palette-item${isSelected ? " selected" : ""}`,
          role: "option",
          "aria-selected": isSelected ? "true" : "false"
        },
        el("div", { className: "palette-item-left" },
          createIcon(cmd.icon, 16, "palette-item-icon"),
          el("span", { className: "palette-item-title" }, cmd.title)
        ),
        el("span", { className: "palette-item-category" }, cmd.category)
      );

      item.addEventListener("click", () => {
        executeCommand(cmd);
      });

      list.appendChild(item);
    });

    // Ensure selected item is visible
    const selectedEl = list.children[activeIndex];
    if (selectedEl && typeof selectedEl.scrollIntoView === "function") {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }

  function filterCommands(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      filteredCommands = [...COMMANDS];
    } else {
      filteredCommands = COMMANDS.filter(c => {
        if (c.title.toLowerCase().includes(q)) return true;
        if (c.category.toLowerCase().includes(q)) return true;
        return c.keywords.some(k => k.includes(q));
      });
    }
    activeIndex = 0;
    renderList();
  }

  function executeCommand(cmd) {
    closePalette();
    try {
      cmd.action();
    } catch (err) {
      console.error("Failed to execute command:", err);
    }
  }

  function openPalette() {
    modal.classList.remove("hidden");
    input.value = "";
    filterCommands("");
    setTimeout(() => input.focus(), 10);
  }

  function closePalette() {
    modal.classList.add("hidden");
  }

  // Keyboard navigation inside palette
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        activeIndex = (activeIndex + 1) % filteredCommands.length;
        renderList();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        activeIndex = (activeIndex - 1 + filteredCommands.length) % filteredCommands.length;
        renderList();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[activeIndex]) {
        executeCommand(filteredCommands[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    }
  });

  input.addEventListener("input", (e) => {
    filterCommands(e.target.value);
  });

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closePalette();
    }
  });

  if (openBtn) {
    openBtn.addEventListener("click", openPalette);
  }

  // Global hotkeys: Ctrl+K, Cmd+K, and N for new chat when not typing in inputs
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      if (modal.classList.contains("hidden")) {
        openPalette();
      } else {
        closePalette();
      }
    } else if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      e.preventDefault();
      closePalette();
    } else if (
      (e.key === "n" || e.key === "N") &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      document.activeElement?.tagName !== "INPUT" &&
      document.activeElement?.tagName !== "TEXTAREA" &&
      modal.classList.contains("hidden")
    ) {
      const askTab = document.getElementById("tab-btn-ask");
      if (askTab && askTab.classList.contains("active")) {
        e.preventDefault();
        const newChatBtn = document.getElementById("sidebar-new-chat-btn");
        if (newChatBtn) newChatBtn.click();
      }
    }
  });
}
