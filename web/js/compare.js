/**
 * VectorDB Multi-Algorithm Benchmark Comparison Controller
 */

import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { el, formatDuration, formatSimilarity } from "./ui.js";
import { setupCanvasDpr } from "./canvas.js";
import { createIcon } from "./icons.js";
import {
  computeTimingStats,
  diffAgainstGroundTruth,
  drawComparisonBars,
  buildDiffRows,
  extractChartMetrics,
  drawMetricBarChart,
  ALGORITHM_LABELS,
  ALGORITHM_COLORS
} from "./compare_helpers.js";
import { isCanvasDrawable } from "./hnsw_helpers.js";

export function initCompareTab() {
  const byId = (id) => document.getElementById(id);
  const collSelect = byId("compare-coll-select");
  if (!collSelect) return;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("coll") === "docs" && collSelect) collSelect.value = "docs";

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
  const canvasLatency = byId("compare-chart-latency");
  const canvasDistances = byId("compare-chart-distances");
  const canvasRecall = byId("compare-chart-recall");
  const canvasBars = byId("compare-bars-canvas");
  const summaryTbody = byId("compare-summary-tbody");
  const topkResultsTable = byId("compare-topk-tbody");
  const emptyTitle = byId("compare-empty-title");
  const emptyDesc = byId("compare-empty-desc");
  const initialRunBtn = byId("compare-initial-run-btn");
  const controlsTitle = byId("compare-controls-title");
  const chartsCol = byId("compare-charts-col");

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
    const isDocs = collSelect.value === "docs";
    demoControls?.classList.toggle("hidden", isDocs);
    docsControls?.classList.toggle("hidden", !isDocs);
    if (controlsTitle) {
      controlsTitle.textContent = isDocs ? "Benchmark Document Chunks" : "Benchmark Demo Vectors";
    }
    if (initialRunBtn) {
      initialRunBtn.textContent = isDocs ? "Benchmark Document Chunks" : "Benchmark Demo Vectors";
    }
  }

  collSelect.addEventListener("change", () => {
    updateCollectionVisibility();
    lastReportData = null;
    checkCollectionStats();
  });

  function showDefaultEmptyState() {
    if (!emptyStateBox) return;
    const isDocs = collSelect?.value === "docs";
    if (emptyTitle) emptyTitle.textContent = "No benchmark yet";
    if (emptyDesc) emptyDesc.textContent = "Run a benchmark to see latency, distance computations, recall and the top-k diff.";
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
    const isDocs = collSelect.value === "docs";
    try {
      if (isDocs) {
        const docsRes = await api.getDocs();
        const totalDocs = docsRes.documents?.length || 0;
        if (totalDocs === 0) {
          showEmptyNotice("No documents ingested yet. Add documents in the Ask tab, or switch to the Demo collection.");
          return false;
        }
      } else {
        const stats = await api.getStats();
        currentDim = stats.dimension || 128;
        if (!stats.count || stats.count === 0) {
          showEmptyNotice("Demo collection is empty. Insert vectors in Settings, or run benchmarks on Document Chunks.");
          return false;
        }
      }
      if (!lastReportData) {
        showDefaultEmptyState();
      } else {
        showResultsView();
      }
      return true;
    } catch (err) {
      showGlobalError(err.code, err.message);
      return false;
    }
  }

  function showEmptyNotice(msg) {
    if (emptyTitle) emptyTitle.textContent = "Notice";
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

    const repeatCount = parseInt(repeatSelect?.value || "5", 10);
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

    const algs = report.algorithms;
    const stats = {
      brute: computeTimingStats(latencies.brute),
      kdtree: computeTimingStats(latencies.kdtree),
      hnsw: computeTimingStats(latencies.hnsw)
    };

    // Render Metrics Table
    summaryTbody?.replaceChildren();
    ["brute", "kdtree", "hnsw"].forEach((alg) => {
      const aData = algs[alg] || {};
      const tStat = stats[alg];
      const medianUs = tStat.median;
      const minMaxStr = `${Math.round(tStat.min)} - ${Math.round(tStat.max)} μs`;

      const tr = el("tr", {},
        el("td", { className: "fw-bold" },
          el("span", { className: `legend-swatch swatch-${alg} mr-1` }),
          ALGORITHM_LABELS[alg]
        ),
        el("td", {}, `${Math.round(medianUs)} μs (${formatDuration(medianUs / 1000)})`),
        el("td", { className: "text-xs text-muted" }, minMaxStr),
        el("td", {}, String(aData.distance_computations ?? "-")),
        el("td", {}, formatSimilarity(aData.recall_at_k ?? 1.0))
      );
      summaryTbody?.appendChild(tr);
    });

    // Render Canvas Chart
    renderChart();

    // Render Top-k Ground Truth Side-by-Side Comparison
    renderTopKComparison(report);
  }

  function renderChart() {
    if (!lastReportData) return;
    const isDark = true;
    const chartMetrics = extractChartMetrics(lastReportData.report, lastReportData.latencies);

    const renderSingleCanvas = (cvs, key) => {
      if (!cvs) return;
      const rect = cvs.getBoundingClientRect();
      if (!isCanvasDrawable(rect.width, rect.height)) return;
      const ctx = cvs.getContext("2d");
      setupCanvasDpr(cvs, ctx);
      drawMetricBarChart(cvs, key, chartMetrics[key], isDark);
    };

    renderSingleCanvas(canvasLatency, "latency");
    renderSingleCanvas(canvasDistances, "dist");
    renderSingleCanvas(canvasRecall, "recall");

    if (canvasBars) {
      const rect = canvasBars.getBoundingClientRect();
      if (isCanvasDrawable(rect.width, rect.height)) {
        const ctx = canvasBars.getContext("2d");
        setupCanvasDpr(canvasBars, ctx);
        const stats = {
          brute: computeTimingStats(lastReportData.latencies.brute),
          kdtree: computeTimingStats(lastReportData.latencies.kdtree),
          hnsw: computeTimingStats(lastReportData.latencies.hnsw)
        };
        const algs = lastReportData.report.algorithms;
        const chartData = {
          brute: { latency: stats.brute.median, dist: algs.brute?.distance_computations || 0, recall: algs.brute?.recall_at_k ?? 1 },
          kdtree: { latency: stats.kdtree.median, dist: algs.kdtree?.distance_computations || 0, recall: algs.kdtree?.recall_at_k ?? 1 },
          hnsw: { latency: stats.hnsw.median, dist: algs.hnsw?.distance_computations || 0, recall: algs.hnsw?.recall_at_k ?? 1 }
        };
        drawComparisonBars(canvasBars, chartData, isDark);
      }
    }
  }

  function renderTopKComparison(report) {
    if (!topkResultsTable) return;
    topkResultsTable.replaceChildren();

    const diffRows = buildDiffRows(report, 100);

    const formatCell = (item, isGt = false) => {
      if (!item) return el("span", { className: "text-muted" }, "-");
      const distStr = item.distance !== undefined ? ` (d=${Number(item.distance).toFixed(4)})` : "";
      const idSpan = el("span", { className: "font-mono" }, `#${item.id}${distStr}`);

      if (isGt) return idSpan;

      const badge = el("span", {
        className: item.isMatch ? "badge badge-success ml-1 text-xs" : "badge badge-warning ml-1 text-xs"
      }, item.isMatch ? "✓" : "diff");

      return el("div", { className: "flex-cell" }, idSpan, badge);
    };

    for (const row of diffRows) {
      const tr = el("tr", {},
        el("td", { className: "text-muted" }, String(row.rank)),
        el("td", {}, formatCell(row.brute, true)),
        el("td", {}, formatCell(row.kdtree, false)),
        el("td", {}, formatCell(row.hnsw, false))
      );
      topkResultsTable.appendChild(tr);
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

  let resizeRaf = null;
  function scheduleResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      if (lastReportData) renderChart();
    });
  }

  const targetObserver = chartsCol || canvas?.parentElement;
  if (targetObserver && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(scheduleResize);
    ro.observe(targetObserver);
  }

  byId("tab-btn-compare")?.addEventListener("click", () => {
    checkCollectionStats();
    if (lastReportData) {
      requestAnimationFrame(() => renderChart());
    }
  });

  window.addEventListener("resize", scheduleResize);

  byId("compare-initial-run-btn")?.addEventListener("click", () => {
    const isDocs = collSelect?.value === "docs";
    if (isDocs) {
      docsRunBtn?.click();
    } else {
      demoRandomBtn?.click();
    }
  });

  updateCollectionVisibility();
  checkCollectionStats();
}
