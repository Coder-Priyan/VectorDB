/**
 * VectorDB Learning Layer & Guided Tour
 *
 * Plain-language educational explainers and interactive step-by-step tour.
 * Zero-innerHTML and strict CSP compliant.
 */

import { el } from "./ui.js";
import { createIcon } from "./icons.js";

export const EXPLAINERS = {
  embeddings: {
    title: "What is a vector embedding?",
    summary: "A numeric list of numbers (coordinates) that captures semantic meaning.",
    content: "When you embed text using an AI model (like nomic-embed-text), the model maps the meaning of the words into a high-dimensional space (e.g. 768 dimensions). Sentences with similar meanings end up close together in this space, even if they use completely different vocabulary (e.g., 'puppy' and 'small dog')."
  },
  cosine: {
    title: "How does cosine similarity work?",
    summary: "Measures the angle between two vectors, ignoring their length.",
    content: "Cosine similarity calculates the cosine of the angle between two multi-dimensional vectors. A score of 1.0 means the directions point exactly the same way (identical meaning), 0.0 means orthogonal (unrelated), and -1.0 means opposite. Because it normalizes by vector magnitude, long and short documents can be compared fairly."
  },
  bruteforce: {
    title: "Why is brute-force search slow on large datasets?",
    summary: "It calculates distance to every single vector: O(N * D) complexity.",
    content: "Exact brute-force search compares the query vector against every stored vector in the database. With 1,000 vectors, it takes a few microseconds. With 1,000,000 vectors of dimension 768, it requires calculating over 768 million multiplications per query. Fast for small tests, but intractable for interactive search at scale."
  },
  kdtree: {
    title: "How does KD-Tree partition space?",
    summary: "A binary tree that alternates splitting dimensions to prune branches.",
    content: "A k-d tree recursively bisects points along each coordinate axis. During nearest neighbor search, it uses the branch boundaries to skip vast regions of space (branch pruning). While very fast in 2 to 8 dimensions, high-dimensional spaces (D > 30) suffer from the 'curse of dimensionality', where almost all branches must be checked."
  },
  hnsw: {
    title: "Why does HNSW scale to millions of vectors?",
    summary: "A multi-layer graph inspired by skip-lists, achieving sub-millisecond search.",
    content: "Hierarchical Navigable Small World (HNSW) constructs layers of proximity graphs. The top layers have few nodes and long-range highway edges for coarse navigation; lower layers have denser local connections. Search zooms in from top to bottom, finding approximate nearest neighbors in O(log N) time with over 98% recall."
  },
  pca: {
    title: "What is PCA and what does 2D projection lose?",
    summary: "Principal Component Analysis projects high dimensions onto the axes of highest variance.",
    content: "PCA finds orthogonal directions (principal components) along which the data varies most. Projecting 768-dimensional vectors onto the top 2 components lets you visualize clusters on a 2D screen. However, high-dimensional distance relationships are compressed, so two points near each other in 2D might actually be farther apart in 768D."
  },
  rag: {
    title: "What is grounded RAG and why do citation numbers matter?",
    summary: "Retrieval-Augmented Generation grounds LLM answers in verified local sources.",
    content: "Instead of asking an LLM to answer from its training memory (which risks hallucinations), RAG retrieves the most relevant chunks from your local documents and includes them in the prompt. Strict citation markers [1], [2] allow you to trace every fact directly back to the exact passage in your document."
  }
};

const TOUR_STEPS = [
  {
    target: "#app-sidebar",
    title: "VectorDB Workspace",
    text: "Welcome to VectorDB! This collapsible sidebar lets you start new chats, switch between interactive tabs, check Ollama connectivity, and access recent sessions."
  },
  {
    target: "#panel-ask",
    title: "Glass-Box Ask (RAG)",
    text: "Ask questions grounded in your local documents. Every answer includes streaming text with clickable citations and a detailed 'How this was answered' inspection panel."
  },
  {
    target: "#toggle-docs-drawer-btn",
    title: "Documents Drawer",
    text: "Open the Documents drawer to ingest text files, load sample data, inspect chunk boundaries, or delete documents from the local index."
  },
  {
    target: "#tab-btn-explore",
    title: "2D PCA Projection",
    text: "Visualize your high-dimensional vectors and document chunks in an interactive 2D map with variance ratios and live query projection."
  },
  {
    target: "#tab-btn-hnsw",
    title: "HNSW Graph & Search Trace",
    text: "Explore the multi-layer HNSW graph topology. Trace the exact hops taken across layers during nearest-neighbor search."
  },
  {
    target: "#tab-btn-compare",
    title: "Algorithm Benchmark",
    text: "Directly compare Brute Force, KD-Tree, and HNSW across latency, QPS, distance comparisons, and recall."
  }
];

const TOUR_STORAGE_KEY = "vectordb:tour-completed";

/**
 * Creates an interactive "What is this?" information button.
 */
export function createInfoButton(topicKey) {
  const spec = EXPLAINERS[topicKey];
  if (!spec) return document.createDocumentFragment();

  const btn = el("button", {
    type: "button",
    className: "learn-info-btn",
    title: `Explain: ${spec.title}`,
    "aria-label": `Learn more about ${spec.title}`
  });
  btn.appendChild(createIcon("info", 14));

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    showInfoModal(spec);
  });

  return btn;
}

/**
 * Shows a centered modal with plain-language explainer content.
 */
export function showInfoModal(spec) {
  const existing = document.getElementById("learn-info-modal");
  if (existing) existing.remove();

  const backdrop = el("div", {
    id: "learn-info-modal",
    className: "palette-backdrop",
    role: "dialog",
    "aria-modal": "true"
  });

  const card = el("div", { className: "palette-card learn-modal-card" },
    el("div", { className: "learn-modal-header" },
      el("div", { className: "learn-modal-title" },
        createIcon("info", 18),
        el("span", {}, spec.title)
      ),
      el("button", {
        type: "button",
        className: "sidebar-icon-btn",
        "aria-label": "Close"
      }, createIcon("chevron", 14))
    ),
    el("div", { className: "learn-modal-body" },
      el("p", { className: "learn-modal-summary" }, spec.summary),
      el("p", { className: "learn-modal-content" }, spec.content)
    )
  );

  const closeBtn = card.querySelector(".sidebar-icon-btn");
  closeBtn?.addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  const onKey = (e) => {
    if (e.key === "Escape") {
      backdrop.remove();
      window.removeEventListener("keydown", onKey);
    }
  };
  window.addEventListener("keydown", onKey);

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
}

/**
 * Runs the guided tour.
 */
export function startGuidedTour(force = false) {
  if (!force && localStorage.getItem(TOUR_STORAGE_KEY) === "true") {
    return;
  }

  let currentStep = 0;
  let overlayEl = document.getElementById("tour-overlay");
  if (overlayEl) overlayEl.remove();

  overlayEl = el("div", { id: "tour-overlay", className: "tour-overlay" });
  const tooltip = el("div", { className: "tour-tooltip" });
  overlayEl.appendChild(tooltip);
  document.body.appendChild(overlayEl);

  function renderStep(idx) {
    if (idx >= TOUR_STEPS.length) {
      finishTour();
      return;
    }

    const step = TOUR_STEPS[idx];
    const targetEl = document.querySelector(step.target);

    while (tooltip.firstChild) {
      tooltip.removeChild(tooltip.firstChild);
    }

    const header = el("div", { className: "tour-tooltip-header" },
      el("span", { className: "tour-step-badge" }, `Step ${idx + 1} of ${TOUR_STEPS.length}`),
      el("h4", { className: "tour-tooltip-title" }, step.title)
    );

    const body = el("p", { className: "tour-tooltip-text" }, step.text);

    const prevBtn = el("button", {
      type: "button",
      className: `btn btn-sm btn-ghost${idx === 0 ? " hidden" : ""}`
    }, "Back");
    prevBtn.addEventListener("click", () => {
      if (currentStep > 0) {
        currentStep--;
        renderStep(currentStep);
      }
    });

    const nextBtn = el("button", {
      type: "button",
      className: "btn btn-sm btn-primary"
    }, idx === TOUR_STEPS.length - 1 ? "Finish" : "Next");
    nextBtn.addEventListener("click", () => {
      currentStep++;
      renderStep(currentStep);
    });

    const skipBtn = el("button", {
      type: "button",
      className: "btn btn-sm btn-ghost"
    }, "Skip");
    skipBtn.addEventListener("click", finishTour);

    const footer = el("div", { className: "tour-tooltip-footer" },
      skipBtn,
      el("div", { className: "btn-group" }, prevBtn, nextBtn)
    );

    tooltip.appendChild(header);
    tooltip.appendChild(body);
    tooltip.appendChild(footer);

    // Position near target
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const top = Math.max(20, Math.min(window.innerHeight - 250, rect.top + 20));
      const left = Math.max(20, Math.min(window.innerWidth - 380, rect.right + 20));
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    } else {
      tooltip.style.top = "30%";
      tooltip.style.left = "40%";
    }
  }

  function finishTour() {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    if (overlayEl) overlayEl.remove();
  }

  renderStep(0);
}

// Global listener for tour requests from command palette
window.addEventListener("vectordb:start-tour", () => {
  startGuidedTour(true);
});
