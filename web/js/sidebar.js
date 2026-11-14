/**
 * VectorDB Sidebar Controller
 *
 * Manages collapsible sidebar, navigation icons, recent chats listing,
 * and sidebar interactions. Strict CSP & zero-innerHTML compliant.
 */

import { el } from "./ui.js";
import { createIcon } from "./icons.js";

const SIDEBAR_COLLAPSED_KEY = "vectordb:sidebar-collapsed";
const CHATS_STORAGE_KEY = "vectordb:chats";

export function initSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  const newChatBtn = document.getElementById("sidebar-new-chat-btn");
  const recentList = document.getElementById("recent-chats-list");

  if (!sidebar) return;

  // Restore collapsed state
  const isCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  if (isCollapsed) {
    sidebar.classList.add("collapsed");
  }

  // Populate toggle button icon
  if (toggleBtn) {
    updateToggleBtnIcon(toggleBtn, sidebar.classList.contains("collapsed"));
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      const collapsed = sidebar.classList.contains("collapsed");
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
      updateToggleBtnIcon(toggleBtn, collapsed);
    });
  }

  // Populate New Chat button icon
  if (newChatBtn) {
    const iconSlot = newChatBtn.querySelector(".sidebar-btn-icon");
    if (iconSlot && !iconSlot.hasChildNodes()) {
      iconSlot.appendChild(createIcon("plus", 14));
    }
    newChatBtn.addEventListener("click", () => {
      const askTab = document.getElementById("tab-btn-ask");
      if (askTab && !askTab.classList.contains("active")) {
        askTab.click();
      }
      window.dispatchEvent(new CustomEvent("vectordb:new-chat"));
    });
  }

  // Populate Nav Icons
  document.querySelectorAll(".sidebar-nav-item").forEach(item => {
    const iconSlot = item.querySelector(".nav-icon");
    if (iconSlot && !iconSlot.hasChildNodes()) {
      const iconName = iconSlot.getAttribute("data-icon") || "info";
      iconSlot.appendChild(createIcon(iconName, 16));
    }
  });

  // Render recent chats
  function renderRecentChats(activeChatId = null) {
    if (!recentList) return;

    while (recentList.firstChild) {
      recentList.removeChild(recentList.firstChild);
    }

    let chats = [];
    try {
      const raw = localStorage.getItem(CHATS_STORAGE_KEY);
      if (raw) {
        chats = JSON.parse(raw);
      }
    } catch (_) {
      chats = [];
    }

    if (!Array.isArray(chats) || chats.length === 0) {
      const empty = el("div", { className: "recent-chats-empty" }, "No recent chats");
      recentList.appendChild(empty);
      return;
    }

    // Display up to 10 latest
    const displayChats = chats.slice(0, 10);

    displayChats.forEach(chat => {
      const isActive = chat.id === activeChatId;
      const title = chat.title || "Untitled chat";

      const deleteBtn = el("button", {
        className: "recent-chat-delete-btn",
        title: "Delete chat",
        "aria-label": `Delete ${title}`,
        type: "button"
      });
      deleteBtn.appendChild(createIcon("trash", 12));

      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("vectordb:delete-chat", {
          detail: { chatId: chat.id }
        }));
      });

      const item = el(
        "div",
        {
          className: `recent-chat-item${isActive ? " active" : ""}`,
          role: "button",
          tabIndex: 0,
          "data-chat-id": chat.id,
          title: title
        },
        createIcon("chat", 14, "recent-chat-icon"),
        el("span", { className: "recent-chat-title" }, title),
        deleteBtn
      );

      item.addEventListener("click", () => {
        const askTab = document.getElementById("tab-btn-ask");
        if (askTab && !askTab.classList.contains("active")) {
          askTab.click();
        }
        window.dispatchEvent(new CustomEvent("vectordb:load-chat", {
          detail: { chatId: chat.id }
        }));
      });

      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          item.click();
        }
      });

      recentList.appendChild(item);
    });
  }

  function updateToggleBtnIcon(btn, collapsed) {
    while (btn.firstChild) {
      btn.removeChild(btn.firstChild);
    }
    btn.appendChild(createIcon(collapsed ? "chevron" : "chevronDown", 14));
  }

  window.addEventListener("vectordb:chats-updated", (e) => {
    const activeId = e.detail?.activeChatId || null;
    renderRecentChats(activeId);
  });

  renderRecentChats();
}
