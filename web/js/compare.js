/**
 * VectorDB Multi-Algorithm Benchmark Comparison Controller
 */

import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { el, createDropdown } from "./ui.js";
import { createIcon } from "./icons.js";
import {
  getCompareEmptyStateConfig,
  mapReportToCards
} from "./compare_helpers.js";

export function initCompareTab() {
  const byId = (id) => document.getElementById(id);
  const collWrap = byId("compare-coll-dropdown-wrap");
  const repeatWrap = byId("compare-repeat-dropdown-wrap");
  if (!collWrap || !repeatWrap) return;

  const urlParams = new URLSearchParams(window.location.search);
  const initialColl = urlParams.get("coll") === "docs" ? "docs" : "demo";

  const collDropdown = createDropdown(
    [
      { value: "demo", label: "Demo Vectors" },
      { value: "docs", label: "Document Chunks" }
    ],
    initialColl,
    () => {
      resetCompareView();
      updateCollectionVisibility();
      checkCollectionStats();
    },
    { id: "compare-coll-select", ariaLabel: "Collection" }
  );
  collWrap.replaceChildren(collDropdown.element);

  const repeatDropdown = createDropdown(
    [
      { value: "1", label: "1 run" },
      { value: "3", label: "3 runs" },
      { value: "5", label: "5 runs" },
      { value: "10", label: "10 runs" },
      { value: "20", label: "20 runs" }
    ],
    "5",
    null,
    { id: "compare-repeat-select", ariaLabel: "Repetitions" }
  );
  repeatWrap.replaceChildren(repeatDropdown.element);

  const collSelect = byId("compare-coll-select");
  const repeatSelect = byId("compare-repeat-select");

  const docsQueryWrap = byId("compare-docs-query-wrap");
  const docsQueryInput = byId("compare-docs-query-input");
  const demoRandomBtn = byId("compare-demo-random-btn");
  const docsRunBtn = byId("compare-docs-run-btn");

  const optionsBtn = byId("compare-options-btn");
  const optionsPopover = byId("compare-options-popover");
  const demoOptions = byId("compare-demo-options");
  const docsOptions = byId("compare-docs-options");

  const demoIdInput = byId("compare-demo-id-input");
  const demoIdBtn = byId("compare-demo-id-btn");
  const demoKInput = byId("compare-k-input");
  const demoEfInput = byId("compare-ef-input");

  const docsKInput = byId("compare-docs-k-input");
  const docsEfInput = byId("compare-docs-ef-input");

  const statusNotice = byId("compare-progress-status");
  const progressBar = byId("compare-progress-fill");
  const emptyStateBox = byId("compare-empty-state");
  const resultsCard = byId("compare-results-card");
  const cardsContainer = byId("compare-cards-container");
  const rankTooltipEl = byId("compare-rank-tooltip");

  function showTooltip(cell, cellData) {
    if (!rankTooltipEl || !resultsCard) return;
    const expectedText = cellData.expectedId !== null ? `#${cellData.expectedId}` : "-";
    const gotText = cellData.gotId !== null ? `#${cellData.gotId}` : "-";

    rankTooltipEl.replaceChildren(
      document.createTextNode(`Rank ${cellData.rank}: expected `),
      el("span", { className: "font-mono" }, expectedText),
      document.createTextNode(", got "),
      el("span", { className: "font-mono" }, gotText)
    );

    const cellRect = cell.getBoundingClientRect();
    const containerRect = resultsCard.getBoundingClientRect();
    let x = cellRect.left - containerRect.left + (cellRect.width / 2);
    let y = cellRect.top - containerRect.top - 28;

    if (y < 4) {
      y = cellRect.bottom - containerRect.top + 6;
    }

    const minX = 70;
    const maxX = Math.max(minX, containerRect.width - 70);
    x = Math.max(minX, Math.min(maxX, x));

    rankTooltipEl.style.left = `${Math.round(x)}px`;
    rankTooltipEl.style.top = `${Math.round(y)}px`;
    rankTooltipEl.style.transform = "translateX(-50%)";
    rankTooltipEl.classList.remove("hidden");
  }

  function hideTooltip() {
    if (!rankTooltipEl) return;
    rankTooltipEl.classList.add("hidden");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideTooltip();
    }
  });

  // Populate Options button icons
  const optionsIconSlot = optionsBtn?.querySelector(".compare-options-icon-slot");
  const optionsChevronSlot = optionsBtn?.querySelector(".compare-options-chevron-slot");
  if (optionsIconSlot && !optionsIconSlot.hasChildNodes()) {
    optionsIconSlot.appendChild(createIcon("sliders", 14));
  }
  if (optionsChevronSlot && !optionsChevronSlot.hasChildNodes()) {
    optionsChevronSlot.appendChild(createIcon("chevronDown", 12));
  }

  function toggleOptions(open) {
    if (!optionsPopover || !optionsBtn) return;
    const shouldOpen = open !== undefined ? open : optionsPopover.classList.contains("hidden");
    if (shouldOpen) {
      optionsPopover.classList.remove("hidden");
      optionsBtn.setAttribute("aria-expanded", "true");
      const isDocs = collDropdown.getValue() === "docs";
      const firstInput = isDocs ? docsKInput : demoKInput;
      firstInput?.focus();
    } else {
      optionsPopover.classList.add("hidden");
      optionsBtn.setAttribute("aria-expanded", "false");
    }
  }

  optionsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleOptions();
  });

  document.addEventListener("click", (e) => {
    if (!optionsPopover || optionsPopover.classList.contains("hidden")) return;
    if (!optionsPopover.contains(e.target) && !optionsBtn?.contains(e.target)) {
      toggleOptions(false);
    }
  });

  optionsPopover?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      toggleOptions(false);
      optionsBtn?.focus();
    }
  });

  const emptyIconSlot = byId("compare-empty-icon");
  if (emptyIconSlot && !emptyIconSlot.hasChildNodes()) {
    emptyIconSlot.appendChild(createIcon("activity", 32));
  }

  const emptyTitle = byId("compare-empty-title");
  const emptyDesc = byId("compare-empty-desc");
  const initialRunBtn = byId("compare-initial-run-btn");

  let currentDim = 128;
  let lastReportData = null;

  function showResultsView() {
    emptyStateBox?.classList.add("hidden");
    resultsCard?.classList.remove("hidden");
  }

  function showEmptyView() {
    emptyStateBox?.classList.remove("hidden");
    resultsCard?.classList.add("hidden");
  }

  function updateCollectionVisibility() {
    const isDocs = collDropdown.getValue() === "docs";
    demoRandomBtn?.classList.toggle("hidden", isDocs);
    docsRunBtn?.classList.toggle("hidden", !isDocs);
    docsQueryWrap?.classList.toggle("hidden", !isDocs);
    demoOptions?.classList.toggle("hidden", isDocs);
    docsOptions?.classList.toggle("hidden", !isDocs);
    if (initialRunBtn) {
      initialRunBtn.textContent = isDocs ? "Benchmark Document Chunks" : "Benchmark Demo Vectors";
    }
  }

  function resetCompareView() {
    lastReportData = null;
    hideTooltip();
    cardsContainer?.replaceChildren();
    if (statusNotice) statusNotice.textContent = "Ready to benchmark.";
    if (progressBar) {
      progressBar.classList.remove("running");
      progressBar.style.setProperty("width", "0%");
    }
  }

  function showDefaultEmptyState(title, desc) {
    if (!emptyStateBox) return;
    const isDocs = collDropdown.getValue() === "docs";
    if (emptyTitle) emptyTitle.textContent = title || "No benchmark yet";
    if (emptyDesc) emptyDesc.textContent = desc || "Run a benchmark to see latency, distance computations, recall and the top-k diff.";
    if (initialRunBtn) {
      initialRunBtn.textContent = isDocs ? "Benchmark Document Chunks" : "Benchmark Demo Vectors";
      initialRunBtn.classList.remove("hidden");
    }
    demoRandomBtn?.removeAttribute("disabled");
    demoIdBtn?.removeAttribute("disabled");
    docsRunBtn?.removeAttribute("disabled");
    showEmptyView();
  }

  async function checkCollectionStats() {
    clearGlobalError();
    const coll = collDropdown.getValue() || "demo";
    const isDocs = coll === "docs";
    try {
      let count = 0;
      if (isDocs) {
        const docsRes = await api.getDocs();
        count = docsRes.documents?.length || 0;
      } else {
        const stats = await api.getStats();
        currentDim = stats.dimension || 128;
        count = stats.count || 0;
      }

      const emptyCfg = getCompareEmptyStateConfig(coll, count, Boolean(lastReportData));

      if (count === 0) {
        resetCompareView();
        showEmptyNotice(emptyCfg.title, emptyCfg.description);
        return false;
      }

      if (!lastReportData) {
        showDefaultEmptyState(emptyCfg.title, emptyCfg.description);
      } else {
        showResultsView();
      }
      return true;
    } catch (err) {
      showGlobalError(err.code, err.message);
      return false;
    }
  }

  function showEmptyNotice(title, msg) {
    if (emptyTitle) emptyTitle.textContent = title || "Collection is empty";
    if (emptyDesc) emptyDesc.textContent = msg;
    if (initialRunBtn) initialRunBtn.classList.add("hidden");
    demoRandomBtn?.setAttribute("disabled", "true");
    demoIdBtn?.setAttribute("disabled", "true");
    docsRunBtn?.setAttribute("disabled", "true");
    if (statusNotice) statusNotice.textContent = "Ready to benchmark.";
    if (progressBar) {
      progressBar.classList.remove("running");
      progressBar.style.setProperty("width", "0%");
    }
    showEmptyView();
  }

  function generateRandomVector() {
    return Array.from({ length: currentDim }, () => (Math.random() - 0.5) * 2);
  }

  async function runBenchmarkSuite(getPayloadFn, isDocs) {
    clearGlobalError();
    resultsCard?.classList.add("hidden");
    if (progressBar) {
      progressBar.classList.add("running");
      progressBar.style.setProperty("width", "0%");
    }
    const ready = await checkCollectionStats();
    if (!ready) {
      progressBar?.classList.remove("running");
      return;
    }

    const repeatCount = parseInt(repeatDropdown.getValue() || "5", 10);
    const latencies = { brute: [], kdtree: [], hnsw: [] };
    let lastReport = null;

    try {
      // 1. Warm-up pass if repeatCount > 1 (discards KD-tree lazy build overhead)
      if (repeatCount > 1) {
        if (statusNotice) statusNotice.textContent = "Running warm-up pass (KD-Tree lazy construction)...";
        if (progressBar) progressBar.style.setProperty("width", "5%");
        const warmupPayload = await getPayloadFn();
        if (isDocs) {
          await api.benchmarkDocs(warmupPayload);
        } else {
          await api.benchmark(warmupPayload);
        }
      }

      // 2. Sequential timed repetitions
      for (let i = 1; i <= repeatCount; i++) {
        if (statusNotice) {
          statusNotice.textContent = `Running iteration ${i} of ${repeatCount}...`;
        }
        if (progressBar) {
          progressBar.style.setProperty("width", `${Math.round((i / repeatCount) * 100)}%`);
        }
        const payload = await getPayloadFn();
        const report = isDocs
          ? await api.benchmarkDocs(payload)
          : await api.benchmark(payload);

        lastReport = report;
        const algs = report.algorithms || {};
        if (algs.brute) latencies.brute.push(algs.brute.latency_us);
        if (algs.kdtree) latencies.kdtree.push(algs.kdtree.latency_us);
        if (algs.hnsw) latencies.hnsw.push(algs.hnsw.latency_us);
      }

      if (statusNotice) {
        statusNotice.textContent = `Completed ${repeatCount} benchmark run${repeatCount > 1 ? "s" : ""}.`;
      }
      if (progressBar) progressBar.style.setProperty("width", "100%");

      // Return progress line to muted when finished (no permanent amber)
      setTimeout(() => {
        if (progressBar) {
          progressBar.classList.remove("running");
          progressBar.style.setProperty("width", "0%");
        }
      }, 350);

      renderReport(lastReport, latencies);
    } catch (err) {
      if (statusNotice) statusNotice.textContent = "Benchmark failed.";
      if (progressBar) {
        progressBar.classList.remove("running");
        progressBar.style.setProperty("width", "0%");
      }
      showGlobalError(err.code, err.message);
    }
  }

  function renderReport(report, latencies) {
    if (!report || !report.algorithms) return;
    lastReportData = { report, latencies };
    showResultsView();
    renderCards(report, latencies);
  }

  function renderCards(report, latencies) {
    if (!cardsContainer || !report || !report.algorithms) return;
    cardsContainer.replaceChildren();

    const cardModels = mapReportToCards(report, latencies);

    for (const card of cardModels) {
      const alg = card.alg;

      // Card Header: dot + algorithm name only (nothing else)
      const headerEl = el("div", { className: "compare-card-header" },
        el("span", { className: `compare-card-dot bg-${alg}` }),
        el("span", {}, card.label)
      );

      // Row 2: Median latency
      const latBarEl = el("div", { className: `compare-latency-bar bg-${alg}` });
      latBarEl.style.setProperty("width", `${card.barWidthPct}%`);
      const latencyRow = el("div", { className: "compare-card-row compare-row-latency" },
        el("div", { className: "compare-row-top" },
          el("div", { className: "compare-row-label-group" },
            el("span", { className: "compare-metric-label" }, "Median latency"),
            el("span", { className: "compare-latency-range" }, `Range ${card.rangeText}`)
          ),
          el("div", { className: "compare-metric-val-wrap" },
            el("span", { className: "compare-metric-num" }, String(card.medianUs)),
            el("span", { className: "compare-metric-unit" }, "µs")
          )
        ),
        el("div", { className: "compare-latency-track" }, latBarEl)
      );

      // Row 3: Distance computations (no bar)
      const distRow = el("div", { className: "compare-card-row compare-row-dist" },
        el("div", { className: "compare-row-single" },
          el("span", { className: "compare-metric-label" }, "Distance computations"),
          el("span", { className: "compare-metric-num" }, String(card.distanceComputations))
        )
      );

      // Row 4: Top-k rank match
      const rankRow = el("div", { className: "compare-card-row compare-row-rank" });
      if (card.isBrute) {
        rankRow.appendChild(
          el("div", { className: "compare-row-top" },
            el("span", { className: "compare-metric-label" }, "Top-k rank match")
          )
        );
        rankRow.appendChild(
          el("span", { className: "compare-rank-ref" }, "Reference for the other algorithms")
        );
      } else {
        rankRow.appendChild(
          el("div", { className: "compare-row-top" },
            el("span", { className: "compare-metric-label" }, "Top-k rank match"),
            el("span", {
              className: "compare-rank-count",
              "aria-label": `${card.sameCount} of ${card.total} same rank`
            }, `${card.sameCount} / ${card.total}`)
          )
        );

        const stripEl = el("div", {
          className: "compare-rank-strip",
          role: "group",
          "aria-label": `${card.total} rank match indicators`
        });

        for (const cellData of (card.rankStrip || [])) {
          if (cellData.isMatch) {
            stripEl.appendChild(el("span", { className: `compare-rank-cell filled bg-${alg}` }));
          } else {
            const expectedText = cellData.expectedId !== null ? `#${cellData.expectedId}` : "-";
            const gotText = cellData.gotId !== null ? `#${cellData.gotId}` : "-";
            const emptyCell = el("span", {
              className: "compare-rank-cell empty",
              tabIndex: 0,
              "aria-label": `Rank ${cellData.rank}: expected ${expectedText}, got ${gotText}`
            });

            emptyCell.addEventListener("mouseenter", () => showTooltip(emptyCell, cellData));
            emptyCell.addEventListener("mouseleave", hideTooltip);
            emptyCell.addEventListener("focus", () => showTooltip(emptyCell, cellData));
            emptyCell.addEventListener("blur", hideTooltip);
            emptyCell.addEventListener("keydown", (e) => {
              if (e.key === "Escape") {
                hideTooltip();
                emptyCell.blur();
              }
            });

            stripEl.appendChild(emptyCell);
          }
        }

        rankRow.appendChild(stripEl);
      }

      // Row 5: Recall (plain primary text number, regular weight, sans)
      const recallRow = el("div", { className: "compare-card-row compare-row-recall" },
        el("div", { className: "compare-row-single" },
          el("span", { className: "compare-metric-label" }, "Recall"),
          el("span", { className: "compare-metric-num" }, card.recallPercent)
        )
      );

      // Card Container
      const cardEl = el("div", {
        className: "compare-card",
        "data-alg": alg,
        role: "region",
        "aria-label": card.label
      },
        headerEl,
        latencyRow,
        distRow,
        rankRow,
        recallRow
      );

      cardsContainer.appendChild(cardEl);
    }
  }

  // Event Handlers
  demoRandomBtn?.addEventListener("click", () => {
    withButtonBusy(demoRandomBtn, async () => {
      const k = parseInt(demoKInput?.value || "10", 10);
      const ef = parseInt(demoEfInput?.value || "50", 10);
      await runBenchmarkSuite(async () => ({ vector: generateRandomVector(), k, ef }), false);
    });
  });

  demoIdBtn?.addEventListener("click", () => {
    const id = parseInt(demoIdInput?.value || "0", 10);
    if (!id || id <= 0) return showGlobalError("validation_error", "Valid Vector ID required");

    withButtonBusy(demoIdBtn, async () => {
      const vecRes = await api.getVector(id);
      const k = parseInt(demoKInput?.value || "10", 10);
      const ef = parseInt(demoEfInput?.value || "50", 10);
      await runBenchmarkSuite(async () => ({ vector: vecRes.vector, k, ef }), false);
    });
  });

  docsRunBtn?.addEventListener("click", () => {
    const query = docsQueryInput?.value?.trim();
    if (!query) return showGlobalError("validation_error", "Query must not be empty");

    withButtonBusy(docsRunBtn, async () => {
      const k = parseInt(docsKInput?.value || "5", 10);
      const ef = parseInt(docsEfInput?.value || "50", 10);
      await runBenchmarkSuite(async () => ({ query, k, ef }), true);
    });
  });

  function onTabActivated() {
    checkCollectionStats();
    if (lastReportData) {
      renderReport(lastReportData.report, lastReportData.latencies);
    }
  }

  byId("tab-btn-compare")?.addEventListener("click", onTabActivated);

  const panelCompare = byId("panel-compare");
  if (panelCompare && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          if (!panelCompare.classList.contains("hidden")) {
            onTabActivated();
          }
        }
      }
    });
    observer.observe(panelCompare, { attributes: true, attributeFilter: ["class"] });
  }

  window.addEventListener("focus", () => {
    if (panelCompare && !panelCompare.classList.contains("hidden")) {
      onTabActivated();
    }
  });

  initialRunBtn?.addEventListener("click", () => {
    const isDocs = collDropdown.getValue() === "docs";
    if (isDocs) {
      docsRunBtn?.click();
    } else {
      demoRandomBtn?.click();
    }
  });

  updateCollectionVisibility();
  checkCollectionStats();
}
