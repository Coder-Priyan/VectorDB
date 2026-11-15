/**
 * VectorDB Multi-Algorithm Benchmark Comparison Controller
 */

import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { el, createDropdown } from "./ui.js";
import { createIcon } from "./icons.js";
import {
  computeTimingStats,
  getCompareEmptyStateConfig,
  computeDotScale,
  computeDotCount,
  computeRecallSquares,
  computeLatencyScale,
  formatRangeText,
  buildRankMatrix,
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
      { value: "1", label: "1 (Single run)" },
      { value: "3", label: "3 (Warmup + 3 runs)" },
      { value: "5", label: "5 (Warmup + 5 runs)" },
      { value: "10", label: "10 (Warmup + 10 runs)" },
      { value: "20", label: "20 (Warmup + 20 runs)" }
    ],
    "5",
    null,
    { id: "compare-repeat-select", ariaLabel: "Repetitions" }
  );
  repeatWrap.replaceChildren(repeatDropdown.element);

  const collSelect = byId("compare-coll-select");
  const repeatSelect = byId("compare-repeat-select");

  const demoControls = byId("compare-demo-controls");
  const docsControls = byId("compare-docs-controls");
  const demoRandomBtn = byId("compare-demo-random-btn");
  const demoIdInput = byId("compare-demo-id-input");
  const demoIdBtn = byId("compare-demo-id-btn");
  const demoKInput = byId("compare-k-input");
  const demoEfInput = byId("compare-ef-input");

  const docsQueryInput = byId("compare-docs-query-input");
  const docsRunBtn = byId("compare-docs-run-btn");
  const docsKInput = byId("compare-docs-k-input");
  const docsEfInput = byId("compare-docs-ef-input");

  const statusNotice = byId("compare-progress-status");
  const progressBar = byId("compare-progress-fill");
  const emptyStateBox = byId("compare-empty-state");
  const resultsCard = byId("compare-results-card");
  const lanesContent = byId("compare-lanes-content");
  const matrixContent = byId("compare-matrix-content");

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
    demoControls?.classList.toggle("hidden", isDocs);
    docsControls?.classList.toggle("hidden", !isDocs);
    if (initialRunBtn) {
      initialRunBtn.textContent = isDocs ? "Benchmark Document Chunks" : "Benchmark Demo Vectors";
    }
  }

  function resetCompareView() {
    lastReportData = null;
    lanesContent?.replaceChildren();
    matrixContent?.replaceChildren();
    if (statusNotice) statusNotice.textContent = "Ready to benchmark.";
    if (progressBar) progressBar.style.setProperty("width", "0%");
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
    if (progressBar) progressBar.style.setProperty("width", "0%");
    showEmptyView();
  }

  function generateRandomVector() {
    return Array.from({ length: currentDim }, () => (Math.random() - 0.5) * 2);
  }

  async function runBenchmarkSuite(getPayloadFn, isDocs) {
    clearGlobalError();
    resultsCard?.classList.add("hidden");
    if (progressBar) progressBar.style.setProperty("width", "0%");
    const ready = await checkCollectionStats();
    if (!ready) return;

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

      renderReport(lastReport, latencies);
    } catch (err) {
      if (statusNotice) statusNotice.textContent = "Benchmark failed.";
      if (progressBar) progressBar.style.setProperty("width", "0%");
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

    // Dot scale for distance computations
    const maxComputations = Math.max(
      algs.brute?.distance_computations || 0,
      algs.kdtree?.distance_computations || 0,
      algs.hnsw?.distance_computations || 0
    );
    const { scale: dotScale } = computeDotScale(maxComputations);

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
      const barWidthPct = latencyScale.getBarWidthPercent(tStat.median);

      // 1. Name col
      const nameCol = el("div", { className: "compare-lane-name-col" },
        el("span", { className: `compare-lane-dot bg-${alg}` }),
        el("span", {}, ALGORITHM_LABELS[alg] || alg)
      );

      // 2. Latency col
      const barEl = el("div", { className: `compare-lane-latency-bar bg-${alg}` });
      barEl.style.setProperty("width", `${barWidthPct}%`);
      const latencyCol = el("div", { className: "compare-lane-latency-col" },
        el("div", { className: "compare-lane-latency-bar-wrap" },
          el("div", { className: "compare-lane-latency-track" }, barEl),
          el("span", { className: "compare-lane-latency-val" }, `${medianUs} µs`)
        ),
        el("span", { className: "compare-lane-latency-range" }, minMaxStr)
      );

      // 3. Distance computations col (dot matrix in rows of 25)
      const distCount = aData.distance_computations ?? 0;
      const numDots = computeDotCount(distCount, dotScale);
      const dotsGrid = el("div", { className: "compare-lane-dots-grid" });
      const numRows = Math.ceil(numDots / 25);
      for (let r = 0; r < numRows; r++) {
        const rowEl = el("div", { className: "compare-lane-dots-row" });
        const dotsInRow = Math.min(25, numDots - (r * 25));
        for (let d = 0; d < dotsInRow; d++) {
          rowEl.appendChild(el("span", { className: `compare-lane-dot-unit bg-${alg}` }));
        }
        dotsGrid.appendChild(rowEl);
      }

      const dotsCol = el("div", { className: "compare-lane-dots-col" },
        dotsGrid,
        el("span", { className: "compare-lane-dots-total" }, String(distCount))
      );

      // 4. Recall squares col
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
        el("span", { className: "compare-lane-recall-val" }, recallPct)
      );

      // Lane row
      const laneRow = el("div", { className: "compare-lane-row" },
        nameCol,
        latencyCol,
        dotsCol,
        recallCol
      );
      lanesContent.appendChild(laneRow);
    }

    // Legend line below lanes
    let legendText = "Latency: lower is better. Dots: fewer is less work. Squares: filled = found in ground truth.";
    if (dotScale > 1) {
      legendText += ` (1 dot = ${dotScale} computations)`;
    }
    const legendEl = el("div", { className: "compare-lanes-legend" }, legendText);
    lanesContent.appendChild(legendEl);
  }

  function renderRankMatrix(report) {
    if (!matrixContent || !report || !report.algorithms) return;
    matrixContent.replaceChildren();

    const matrixData = buildRankMatrix(report);
    const scrollContainer = el("div", { className: "compare-matrix-scroll", tabindex: "0", "aria-label": "Top-k Rank Matrix" });
    const tableEl = el("table", { className: "compare-matrix-table" });

    // Table header row: Rank columns
    const theadEl = el("thead", {});
    const headerTr = el("tr", { className: "compare-matrix-header-row" },
      el("th", { className: "compare-matrix-label-th" }, "Algorithm")
    );
    for (const rank of matrixData.columns) {
      headerTr.appendChild(el("th", { className: "compare-matrix-col-th" }, `#${rank}`));
    }
    theadEl.appendChild(headerTr);
    tableEl.appendChild(theadEl);

    // Table body rows: Brute Force (GT), KD-Tree, HNSW
    const tbodyEl = el("tbody", {});
    for (const row of matrixData.rows) {
      const tr = el("tr", { className: "compare-matrix-row" });
      const labelTd = el("td", { className: "compare-matrix-label-td" },
        el("span", { className: `compare-lane-dot bg-${row.algorithm} mr-2` }),
        el("span", {}, row.label)
      );
      tr.appendChild(labelTd);

      for (const cell of row.cells) {
        const td = el("td", { className: "compare-matrix-td" });
        if (cell.status === "missing") {
          td.appendChild(el("span", { className: "compare-matrix-missing" }, "—"));
        } else {
          const idSpan = el("span", { className: "compare-matrix-id" }, `#${cell.id}`);
          const distStr = cell.distance !== null && cell.distance !== undefined
            ? Number(cell.distance).toFixed(4)
            : "";
          const distSpan = el("span", { className: "compare-matrix-dist" }, distStr);
          const cellWrap = el("div", { className: "compare-matrix-cell" }, idSpan, distSpan);

          if (cell.status === "match") {
            const checkIcon = createIcon("check", 12, "compare-matrix-check");
            cellWrap.appendChild(el("span", { className: "compare-matrix-glyph" }, checkIcon));
          } else if (cell.status === "mismatch") {
            const dashIcon = createIcon("dash", 12, "compare-matrix-dash");
            cellWrap.appendChild(el("span", { className: "compare-matrix-glyph" }, dashIcon));
          }

          td.appendChild(cellWrap);
        }
        tr.appendChild(td);
      }
      tbodyEl.appendChild(tr);
    }
    tableEl.appendChild(tbodyEl);
    scrollContainer.appendChild(tableEl);

    const legendEl = el("div", { className: "compare-matrix-legend" },
      "Check = same vector at the same rank as the ground truth."
    );

    matrixContent.appendChild(scrollContainer);
    matrixContent.appendChild(legendEl);
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
