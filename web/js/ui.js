/**
 * VectorDB DOM & Formatting Utilities
 *
 * Implements safe, zero-innerHTML DOM construction helpers, accessible
 * keyboard tab navigation, citation pill renderers, and string formatters.
 */

/**
 * Creates an HTML element with attributes and children without innerHTML.
 * Ensures untrusted server data is always inserted as text nodes.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (val === null || val === undefined) continue;
    if (key === "className") {
      node.className = val;
    } else if (key.startsWith("data-")) {
      node.setAttribute(key, val);
    } else if (key.startsWith("aria-")) {
      node.setAttribute(key, val);
    } else if (key === "textContent") {
      node.textContent = val;
    } else {
      node.setAttribute(key, val);
    }
  }

  for (const child of children) {
    if (child === null || child === undefined) continue;
    if (typeof child === "string" || typeof child === "number") {
      node.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      node.appendChild(child);
    }
  }

  return node;
}

/**
 * Formats byte counts into human-readable strings (B, KB, MB).
 */
export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  if (!bytes || isNaN(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${val} ${units[i]}`;
}

/**
 * Formats millisecond latency durations cleanly.
 */
export function formatDuration(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return "-";
  if (ms < 1000) {
    return `${Number(ms).toFixed(1)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Formats float similarity [0.0, 1.0] as percentage.
 */
export function formatSimilarity(sim) {
  if (sim === null || sim === undefined || isNaN(sim)) return "-";
  return `${(sim * 100).toFixed(1)}%`;
}

/**
 * Calculates statistical median of a numeric array.
 */
export function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Splits text into plain-text spans and citation pill tokens like [1], [2].
 * Returns array of { type: "text" | "citation", text: string, n?: number }.
 */
export function parseCitations(text) {
  if (!text) return [];
  const parts = [];
  const regex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        text: text.slice(lastIndex, match.index)
      });
    }
    parts.push({
      type: "citation",
      text: match[0],
      n: parseInt(match[1], 10)
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      text: text.slice(lastIndex)
    });
  }

  return parts;
}

/**
 * Updates Ollama Status Badge with reachability and model availability.
 */
export function updateOllamaBadge(status, badgeEl) {
  if (!badgeEl) return;
  badgeEl.className = "badge";

  if (!status || !status.reachable) {
    badgeEl.classList.add("badge-danger");
    badgeEl.textContent = "Ollama Unreachable (11434)";
    return;
  }

  const embedOk = status.embed_model_present;
  const chatOk = status.chat_model_present;

  if (embedOk && chatOk) {
    badgeEl.classList.add("badge-success");
    badgeEl.textContent = `Ollama Online (${status.version || "ok"})`;
  } else {
    badgeEl.classList.add("badge-warning");
    const missing = [];
    if (!embedOk) missing.push("nomic-embed-text");
    if (!chatOk) missing.push("llama3.2");
    badgeEl.textContent = `Model Missing: ${missing.join(", ")}`;
    badgeEl.title = `Run: ollama pull ${missing.join(" && ollama pull ")}`;
  }
}

/**
 * Formats Ollama models list or status message for table display.
 * @param {Object} status - Status object with { reachable, models }
 * @returns {string} Formatted model list or fallback status message
 */
export function formatOllamaModels(status) {
  if (!status || !status.reachable) {
    return "Ollama Offline";
  }
  if (Array.isArray(status.models) && status.models.length > 0) {
    return status.models.join(", ");
  }
  return "None installed";
}

/**
 * Initializes Keyboard-Accessible Tab Navigation (WAI-ARIA Tablist pattern).
 */
export function initTabs(tablistSelector = ".tab-nav") {
  const tablist = document.querySelector(tablistSelector);
  if (!tablist) return;

  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

  function activateTab(tab, setFocus = true, updateHash = true) {
    tabs.forEach(t => {
      const isSelected = t === tab;
      t.setAttribute("aria-selected", isSelected ? "true" : "false");
      t.setAttribute("tabindex", isSelected ? "0" : "-1");
      t.classList.toggle("active", isSelected);
    });

    const targetPanelId = tab.getAttribute("aria-controls");
    panels.forEach(p => {
      const match = p.id === targetPanelId;
      p.classList.toggle("hidden", !match);
      p.classList.toggle("active", match);
    });

    if (updateHash && targetPanelId) {
      const hashName = targetPanelId.replace(/^panel-/, "");
      if (window.location.hash !== `#${hashName}`) {
        window.history.replaceState(null, "", `#${hashName}`);
      }
    }

    if (setFocus) {
      tab.focus();
    }
  }

  function applyHash() {
    const raw = (window.location.hash || "").replace(/^#/, "").toLowerCase();
    if (!raw) return;
    const matchingTab = tabs.find(t => t.getAttribute("aria-controls") === `panel-${raw}`);
    if (matchingTab) {
      activateTab(matchingTab, false, false);
      matchingTab.dispatchEvent(new Event("click"));
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab, false, true));

    tab.addEventListener("keydown", (e) => {
      let nextIndex = null;
      if (e.key === "ArrowRight") {
        nextIndex = (index + 1) % tabs.length;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        activateTab(tabs[nextIndex], true, true);
      }
    });
  });

  window.addEventListener("hashchange", applyHash);
  applyHash();
}

/**
 * Determines whether a scrolling container should auto-scroll to the bottom.
 * Returns true when remaining distance to the bottom is within threshold.
 */
export function shouldAutoScroll(scrollTop, scrollHeight, clientHeight, threshold = 40) {
  return (scrollHeight - scrollTop - clientHeight) <= threshold;
}

