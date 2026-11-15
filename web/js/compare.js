/**
 * VectorDB Multi-Algorithm Benchmark Comparison Controller
 */

import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { el, createDropdown } from "./ui.js";
import { createIcon } from "./icons.js";
import {
  computeTimingStats,
  getCompareEmptyStateConfig,
  computeBarScale,
  computeRecallSquares,
  computeLatencyScale,
  formatRangeText,
  buildRankDiff,
  ALGORITHM_LABELS
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
  const lanesContent = byId("compare-lanes-content");
  const matrixContent = byId("compare-matrix-content");

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
    lanesContent?.replaceChildren();
    matrixContent?.replaceChildren();
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
    renderLanes(report, latencies);
    renderRankMatrix(report);
  }

  function renderLanes(report, latencies) {
    if (!lanesContent || !report || !report.algorithms) return;
    lanesContent.replaceChildren();

    const algs = report.algorithms;
    const stats = {
      brute: computeTimingStats(latencies?.brute || [algs.brute?.latency_us || 0]),
      kdtree: computeTimingStats(latencies?.kdtree || [algs.kdtree?.latency_us || 0]),
      hnsw: computeTimingStats(latencies?.hnsw || [algs.hnsw?.latency_us || 0])
    };

    // Shared scale for latency bars
    const latencyScale = computeLatencyScale({
      brute: stats.brute.median,
      kdtree: stats.kdtree.median,
      hnsw: stats.hnsw.median
    });

    // Shared linear scale for distance computation bars
    const distScale = computeBarScale([
      algs.brute?.distance_computations || 0,
      algs.kdtree?.distance_computations || 0,
      algs.hnsw?.distance_computations || 0
    ]);

    // Header row above the first lane
    const headerRow = el("div", { className: "compare-lanes-header-row" },
      el("div", {}, "Algorithm"),
      el("div", {}, "Latency (median, µs)"),
      el("div", {}, "Distance computations"),
      el("div", {}, "Top-k recall")
    );
    lanesContent.appendChild(headerRow);

    const kVal = report.k || 10;
    const algKeys = ["brute", "kdtree", "hnsw"];

    for (const alg of algKeys) {
      const aData = algs[alg] || {};
      const tStat = stats[alg];
      const medianUs = Math.round(tStat.median);
      const minMaxStr = formatRangeText(tStat.min, tStat.max);
      const latencyWidthPct = latencyScale.getBarWidthPercent(tStat.median);

      // 1. Name col
      const nameCol = el("div", { className: "compare-lane-name-col" },
        el("span", { className: `compare-lane-dot bg-${alg}` }),
        el("span", {}, ALGORITHM_LABELS[alg] || alg)
      );

      // 2. Latency col: 6px pill bar, median in mono at end, range in 11px muted mono below
      const latBarEl = el("div", { className: `compare-lane-bar bg-${alg}` });
      latBarEl.style.setProperty("width", `${latencyWidthPct}%`);
      const latencyCol = el("div", { className: "compare-lane-latency-col" },
        el("div", { className: "compare-lane-bar-wrap" },
          el("div", { className: "compare-lane-bar-track" }, latBarEl),
          el("span", { className: "compare-lane-bar-val font-mono" }, `${medianUs} µs`)
        ),
        el("span", { className: "compare-lane-latency-range font-mono" }, minMaxStr)
      );

      // 3. Distance computations col: 6px pill bar on shared linear scale, count in mono at end
      const distCount = aData.distance_computations ?? 0;
      const distWidthPct = distScale.getBarWidthPercent(distCount);
      const distBarEl = el("div", { className: `compare-lane-bar bg-${alg}` });
      distBarEl.style.setProperty("width", `${distWidthPct}%`);
      const distCol = el("div", { className: "compare-lane-dist-col" },
        el("div", { className: "compare-lane-bar-wrap" },
          el("div", { className: "compare-lane-bar-track" }, distBarEl),
          el("span", { className: "compare-lane-bar-val font-mono" }, String(distCount))
        )
      );

      // 4. Recall squares col: k rounded squares (10px, 4px gap, real k), filled in alg color, unfilled faint, recall % in mono
      const recallVal = aData.recall_at_k ?? 1.0;
      const recallSquares = computeRecallSquares(recallVal, kVal);
      const squaresWrap = el("div", { className: "compare-lane-squares-wrap" });
      for (let s = 0; s < recallSquares.filled; s++) {
        squaresWrap.appendChild(el("span", { className: `compare-lane-square filled bg-${alg}` }));
      }
      for (let s = 0; s < recallSquares.unfilled; s++) {
        squaresWrap.appendChild(el("span", { className: "compare-lane-square unfilled" }));
      }

      const recallPct = `${(recallVal * 100).toFixed(1)}%`;
      const recallCol = el("div", { className: "compare-lane-recall-col" },
        squaresWrap,
        el("span", { className: "compare-lane-recall-val font-mono" }, recallPct)
      );

      // Lane row
      const laneRow = el("div", { className: "compare-lane-row" },
        nameCol,
        latencyCol,
        distCol,
        recallCol
      );
      lanesContent.appendChild(laneRow);
    }

    // Legend line below lanes
    const legendEl = el("div", { className: "compare-lanes-legend" },
      "Latency: lower is better. Bars show work done. Squares: filled = found in ground truth. Timings are indicative: official benchmarks come from the C++ tool."
    );
    lanesContent.appendChild(legendEl);
  }

  function renderRankMatrix(report) {
    if (!matrixContent || !report || !report.algorithms) return;
    matrixContent.replaceChildren();

    const diffData = buildRankDiff(report);
    const nonBruteKeys = [
      { key: "kdtree", label: ALGORITHM_LABELS.kdtree || "KD-Tree" },
      { key: "hnsw", label: ALGORITHM_LABELS.hnsw || "HNSW" }
    ];

    const listWrap = el("div", { className: "compare-diff-list" });

    for (const { key, label } of nonBruteKeys) {
      const data = diffData[key] || { sameCount: 0, total: 0, mismatches: [] };
      const groupEl = el("div", { className: "compare-diff-group" });

      const headerEl = el("div", { className: "compare-diff-header" },
        el("span", { className: `compare-lane-dot bg-${key}` }),
        el("span", { className: "compare-diff-label" }, label),
        el("span", { className: "compare-diff-sep" }, "·"),
        el("span", { className: "compare-diff-summary" }, `${data.sameCount} of ${data.total} same rank`)
      );

      if (data.total > 0 && data.sameCount === data.total) {
        // Stroke-only muted-moss check glyph when all match, no chips
        const checkIcon = createIcon("check", 14, "compare-diff-check-icon");
        headerEl.appendChild(el("span", { className: "compare-diff-check-wrap" }, checkIcon));
      }

      groupEl.appendChild(headerEl);

      // If mismatches exist, display pill chips
      if (data.mismatches && data.mismatches.length > 0) {
        const chipsWrap = el("div", { className: "compare-diff-chips" });
        for (const m of data.mismatches) {
          const chipEl = el("div", { className: "compare-diff-chip" },
            el("span", { className: "compare-mismatch-dot" }),
            el("span", { className: "compare-diff-chip-text" },
              `Rank ${m.rank}: expected `,
              el("span", { className: "font-mono" }, `#${m.expected}`),
              ", got ",
              m.got !== null ? el("span", { className: "font-mono" }, `#${m.got}`) : "—"
            )
          );
          chipsWrap.appendChild(chipEl);
        }
        groupEl.appendChild(chipsWrap);
      }

      listWrap.appendChild(groupEl);
    }

    const noteEl = el("div", { className: "compare-diff-note" },
      "Matching ranks are not listed. Recall counts a hit at any rank; same rank is stricter."
    );

    matrixContent.appendChild(listWrap);
    matrixContent.appendChild(noteEl);
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
