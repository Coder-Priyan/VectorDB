/**
 * VectorDB DOM & Formatting Utilities
 *
 * Implements safe, zero-innerHTML DOM construction helpers, accessible
 * keyboard tab navigation, citation pill renderers, and string formatters.
 */

import { createIcon } from "./icons.js";

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
    badgeEl.textContent = "Ollama offline";
    return;
  }

  const embedOk = status.embed_model_present;
  const chatOk = status.chat_model_present;

  if (embedOk && chatOk) {
    badgeEl.classList.add("badge-success");
    badgeEl.textContent = "Ollama online";
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
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIndex = (index + 1) % tabs.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
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

/**
 * Displays a lightweight toast notification.
 * Safe DOM creation, zero-innerHTML, accessible polite live region.
 */
export function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = el(
    "div",
    { className: `toast toast-${type}` },
    el("span", { className: "toast-message" }, message)
  );

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(4px)";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  }, duration);
}

/**
 * Calculates next index for dropdown keyboard navigation cycling.
 * Pure helper for unit testing and keyboard interaction.
 *
 * @param {number} currentIndex
 * @param {number} delta - +1 for down, -1 for up
 * @param {number} totalCount
 * @returns {number}
 */
export function getDropdownNextIndex(currentIndex, delta, totalCount) {
  if (totalCount <= 0) return -1;
  if (currentIndex < 0) {
    return delta >= 0 ? 0 : totalCount - 1;
  }
  return (currentIndex + delta + totalCount) % totalCount;
}

/**
 * Creates a reusable accessible dark dropdown component.
 *
 * @param {Array<{value: string, label: string}|string>} options
 * @param {string} initialValue
 * @param {Function} [onChange] - Callback when value changes
 * @param {Object} [config] - Optional config { id, ariaLabel, className }
 * @returns {{ element: HTMLElement, getValue: () => string, setValue: (val: string) => void }}
 */
export function createDropdown(options, initialValue, onChange, config = {}) {
  const normalizedOptions = (options || []).map(opt => {
    if (typeof opt === "object" && opt !== null) {
      return { value: String(opt.value), label: String(opt.label ?? opt.value) };
    }
    return { value: String(opt), label: String(opt) };
  });

  let currentValue = initialValue !== undefined && initialValue !== null
    ? String(initialValue)
    : (normalizedOptions[0]?.value || "");

  let isOpen = false;
  let highlightedIndex = normalizedOptions.findIndex(o => o.value === currentValue);
  if (highlightedIndex < 0 && normalizedOptions.length > 0) {
    highlightedIndex = 0;
  }

  const container = el("div", {
    className: `custom-dropdown ${config.className || ""}`.trim()
  });

  const hiddenInput = el("input", {
    type: "hidden",
    value: currentValue
  });
  hiddenInput.value = currentValue;
  if (config.id) {
    hiddenInput.id = config.id;
  }
  container.appendChild(hiddenInput);

  const curOpt = normalizedOptions.find(o => o.value === currentValue);
  const labelSpan = el("span", { className: "custom-dropdown-label" }, curOpt ? curOpt.label : currentValue);
  const chevronIcon = createIcon("chevronDown", 12, "custom-dropdown-chevron");

  const btn = el("button", {
    type: "button",
    className: "custom-dropdown-btn",
    "aria-haspopup": "listbox",
    "aria-expanded": "false",
    "aria-label": config.ariaLabel || "Select option"
  }, labelSpan, chevronIcon);
  container.appendChild(btn);

  const popup = el("div", {
    className: "custom-dropdown-popup",
    role: "listbox",
    tabindex: "-1",
    "aria-label": config.ariaLabel || "Options"
  });

  const optionEls = normalizedOptions.map((opt, idx) => {
    const isSelected = opt.value === currentValue;
    const optLabel = el("span", { className: "custom-dropdown-option-label" }, opt.label);
    const checkIcon = createIcon("check", 12, "custom-dropdown-check");
    if (!isSelected) {
      checkIcon.classList.add("hidden");
    }
    const optEl = el("div", {
      className: `custom-dropdown-option${isSelected ? " selected" : ""}`,
      role: "option",
      "aria-selected": String(isSelected),
      "data-value": opt.value,
      tabindex: "-1"
    }, optLabel, checkIcon);

    optEl.addEventListener("click", (e) => {
      e.stopPropagation();
      selectValue(opt.value);
      close();
      btn.focus?.();
    });

    optEl.addEventListener("mouseenter", () => {
      setHighlightedIndex(idx);
    });

    popup.appendChild(optEl);
    return optEl;
  });
  container.appendChild(popup);

  function setHighlightedIndex(idx) {
    highlightedIndex = idx;
    optionEls.forEach((el, i) => {
      el.classList.toggle("highlighted", i === idx);
      if (i === idx) {
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    container.classList.add("open");
    btn.setAttribute("aria-expanded", "true");

    try {
      const rect = container.getBoundingClientRect();
      const popupHeight = (normalizedOptions.length * 32) + 16;
      const spaceBelow = window.innerHeight - rect.bottom;
      const isDropup = spaceBelow < popupHeight || rect.bottom > (window.innerHeight - 80);
      popup.classList.toggle("dropup", isDropup);
    } catch (_) {}

    const curIdx = normalizedOptions.findIndex(o => o.value === currentValue);
    setHighlightedIndex(curIdx >= 0 ? curIdx : 0);

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    container.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("keydown", onKeyDown);
  }

  let inputDesc = null;
  try {
    inputDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  } catch (_) {}

  let isUpdating = false;

  function selectValue(newVal, triggerChange = true) {
    if (isUpdating) return;
    isUpdating = true;
    try {
      currentValue = newVal;
      if (inputDesc && inputDesc.set) {
        inputDesc.set.call(hiddenInput, newVal);
      } else {
        hiddenInput.value = newVal;
      }

      const selectedOpt = normalizedOptions.find(o => o.value === newVal);
      labelSpan.textContent = selectedOpt ? selectedOpt.label : newVal;

      optionEls.forEach((optEl, i) => {
        const isSel = normalizedOptions[i].value === newVal;
        optEl.classList.toggle("selected", isSel);
        optEl.setAttribute("aria-selected", String(isSel));
        const check = optEl.querySelector(".custom-dropdown-check");
        if (check) check.classList.toggle("hidden", !isSel);
      });

      if (triggerChange) {
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        if (typeof onChange === "function") {
          onChange(newVal);
        }
      }
    } finally {
      isUpdating = false;
    }
  }

  function onDocClick(e) {
    if (!container.contains(e.target)) {
      close();
    }
  }

  function onKeyDown(e) {
    if (!isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      btn.focus?.();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = getDropdownNextIndex(highlightedIndex, 1, normalizedOptions.length);
      setHighlightedIndex(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = getDropdownNextIndex(highlightedIndex, -1, normalizedOptions.length);
      setHighlightedIndex(prev);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
        selectValue(normalizedOptions[highlightedIndex].value);
      }
      close();
      btn.focus?.();
    } else if (e.key === "Tab") {
      close();
    }
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isOpen) close();
    else open();
  });

  btn.addEventListener("keydown", (e) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      open();
    }
  });

  if (inputDesc && inputDesc.get && inputDesc.set) {
    try {
      Object.defineProperty(hiddenInput, "value", {
        get() {
          return inputDesc.get.call(this);
        },
        set(v) {
          if (v === currentValue) return;
          inputDesc.set.call(this, v);
          selectValue(v, false);
        }
      });
    } catch (_) {}
  }

  return {
    element: container,
    getValue: () => currentValue,
    setValue: (val) => selectValue(val, true)
  };
}

