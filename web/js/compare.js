/**
 * VectorDB Multi-Algorithm Benchmark Comparison Controller
 */

import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { el, formatDuration, formatSimilarity } from "./ui.js";
import { setupCanvasDpr } from "./canvas.js";
import {
  computeTimingStats,
  diffAgainstGroundTruth,
  drawComparisonBars,
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
  const canvas = byId("compare-bars-canvas");
  const summaryTbody = byId("compare-summary-tbody");
  const topkResultsTable = byId("compare-topk-tbody");

  let currentDim = 128;
  let lastReportData = null;

  function updateCollectionVisibility() {
    const isDocs = collSelect.value === "docs";
    demoControls?.classList.toggle("hidden", isDocs);
    docsControls?.classList.toggle("hidden", !isDocs);
  }

  collSelect.addEventListener("change", () => {
    updateCollectionVisibility();
    checkCollectionStats();
  });

  async function checkCollectionStats() {
    clearGlobalError();
    const isDocs = collSelect.value === "docs";
    try {
      if (isDocs) {
        const docsRes = await api.getDocs();
        const totalDocs = docsRes.documents?.length || 0;
        if (totalDocs === 0) {
          showEmptyNotice("No documents ingested yet. Add documents in the Ask tab first.");
          return false;
        }
      } else {
        const stats = await api.getStats();
        currentDim = stats.dimension || 128;
        if (!stats.count || stats.count === 0) {
          showEmptyNotice("Demo collection is empty. Insert vectors in the Settings tab first.");
          return false;
        }
      }
      emptyStateBox?.classList.add("hidden");
      return true;
    } catch (err) {
      showGlobalError(err.code, err.message);
      return false;
    }
  }

  function showEmptyNotice(msg) {
    if (emptyStateBox) {
      emptyStateBox.textContent = msg;
      emptyStateBox.classList.remove("hidden");
    }
    if (progressBar) progressBar.style.setProperty("width", "0%");
    resultsCard?.classList.add("hidden");
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
    resultsCard?.classList.remove("hidden");

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
        el("td", { className: "font-mono" }, `${Math.round(medianUs)} μs (${formatDuration(medianUs / 1000)})`),
        el("td", { className: "font-mono text-xs text-muted" }, minMaxStr),
        el("td", { className: "font-mono" }, String(aData.distance_computations ?? "-")),
        el("td", { className: "font-mono" }, formatSimilarity(aData.recall_at_k ?? 1.0))
      );
      summaryTbody?.appendChild(tr);
    });

    // Render Canvas Chart
    renderChart();

    // Render Top-k Ground Truth Side-by-Side Comparison
    renderTopKComparison(report);
  }

  function renderChart() {
    if (!canvas || !lastReportData) return;
    const rect = canvas.getBoundingClientRect();
    if (!isCanvasDrawable(rect.width, rect.height)) return;

    const ctx = canvas.getContext("2d");
    setupCanvasDpr(canvas, ctx);

    const isDark = true;
    const algs = lastReportData.report.algorithms;
    const stats = {
      brute: computeTimingStats(lastReportData.latencies.brute),
      kdtree: computeTimingStats(lastReportData.latencies.kdtree),
      hnsw: computeTimingStats(lastReportData.latencies.hnsw)
    };

    const chartData = {
      brute: { latency: stats.brute.median, dist: algs.brute?.distance_computations || 0, recall: algs.brute?.recall_at_k ?? 1 },
      kdtree: { latency: stats.kdtree.median, dist: algs.kdtree?.distance_computations || 0, recall: algs.kdtree?.recall_at_k ?? 1 },
      hnsw: { latency: stats.hnsw.median, dist: algs.hnsw?.distance_computations || 0, recall: algs.hnsw?.recall_at_k ?? 1 }
    };

    drawComparisonBars(canvas, chartData, isDark);
  }

  function renderTopKComparison(report) {
    if (!topkResultsTable) return;
    topkResultsTable.replaceChildren();

    const bruteList = report.algorithms?.brute?.results || [];
    const kdtreeList = report.algorithms?.kdtree?.results || [];
    const hnswList = report.algorithms?.hnsw?.results || [];

    const kdtreeDiff = diffAgainstGroundTruth(kdtreeList, bruteList);
    const hnswDiff = diffAgainstGroundTruth(hnswList, bruteList);

    const rowCount = Math.max(bruteList.length, kdtreeList.length, hnswList.length);

    for (let i = 0; i < rowCount; i++) {
      const b = bruteList[i];
      const kd = kdtreeDiff[i];
      const hn = hnswDiff[i];

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

      const tr = el("tr", {},
        el("td", { className: "font-mono text-muted" }, String(i + 1)),
        el("td", {}, formatCell(b, true)),
        el("td", {}, formatCell(kd, false)),
        el("td", {}, formatCell(hn, false))
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

  const canvasWrapper = canvas?.parentElement;
  if (canvasWrapper && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(scheduleResize);
    ro.observe(canvasWrapper);
  }

  byId("tab-btn-compare")?.addEventListener("click", () => {
    checkCollectionStats();
    if (lastReportData) {
      requestAnimationFrame(() => renderChart());
    }
  });

  window.addEventListener("resize", scheduleResize);

  updateCollectionVisibility();
  checkCollectionStats();
}
