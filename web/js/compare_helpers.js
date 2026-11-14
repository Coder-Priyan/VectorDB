/**
 * Pure Logic & Math Helpers for Multi-Algorithm Benchmark Comparison
 */

import { ALGORITHM_COLORS, THEME, DOC_FALLBACK_COLOR } from "./colors.js";

export { ALGORITHM_COLORS };

export const ALGORITHM_LABELS = {
  brute: "Brute Force",
  kdtree: "KD-Tree",
  hnsw: "HNSW"
};

/**
 * Computes median, min, and max from a numeric array.
 * @param {number[]} numbers
 * @returns {{ median: number, min: number, max: number, count: number }}
 */
export function computeTimingStats(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return { median: 0, min: 0, max: 0, count: 0 };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];

  let median = 0;
  const mid = Math.floor(count / 2);
  if (count % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }

  return { median, min, max, count };
}

/**
 * Compares candidate search results against brute-force ground truth results.
 * Returns enriched candidate list with ground-truth match status.
 *
 * @param {Array<{id: number, distance: number}>} candidateResults
 * @param {Array<{id: number, distance: number}>} groundTruthResults
 * @returns {Array<{id: number, distance: number, isMatch: boolean, rank: number}>}
 */
export function diffAgainstGroundTruth(candidateResults, groundTruthResults) {
  if (!Array.isArray(candidateResults)) return [];
  if (!Array.isArray(groundTruthResults)) {
    return candidateResults.map((r, i) => ({ ...r, isMatch: false, rank: i + 1 }));
  }

  const gtSet = new Set(groundTruthResults.map(r => r.id));

  return candidateResults.map((item, index) => ({
    id: item.id,
    distance: item.distance,
    isMatch: gtSet.has(item.id),
    rank: index + 1
  }));
}

/**
 * Computes relative percentage widths for horizontal comparison bars.
 * Clamped strictly between 0 and 100.
 *
 * @param {number[]} values
 * @param {number} [customMax]
 * @returns {number[]}
 */
export function computeBarWidths(values, customMax) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const max = customMax !== undefined && customMax > 0
    ? customMax
    : Math.max(...values, 0);

  if (max === 0) return values.map(() => 0);

  return values.map(v => {
    const clamped = Math.max(0, Number(v) || 0);
    return Math.min(100, Math.round((clamped / max) * 1000) / 10);
  });
}

/**
 * Resolves drawing dimensions in CSS pixels for canvas rendering under DPR scaling.
 * Returns CSS dimensions when finite and > 0, otherwise falls back to buffer dimensions
 * divided by dpr (defaulting to 1). Returns { w: 0, h: 0 } for invalid or non-positive input.
 *
 * @param {number} cssW - Client or bounding rect width in CSS px
 * @param {number} cssH - Client or bounding rect height in CSS px
 * @param {number} bufW - Internal canvas buffer width in device px
 * @param {number} bufH - Internal canvas buffer height in device px
 * @param {number} [dpr=1] - Device pixel ratio
 * @returns {{ w: number, h: number }}
 */
export function resolveChartSize(cssW, cssH, bufW, bufH, dpr = 1) {
  const safeDpr = (typeof dpr === "number" && Number.isFinite(dpr) && dpr > 0) ? dpr : 1;

  let w = 0;
  if (typeof cssW === "number" && Number.isFinite(cssW) && cssW > 0) {
    w = cssW;
  } else if (typeof bufW === "number" && Number.isFinite(bufW) && bufW > 0) {
    w = bufW / safeDpr;
  }

  let h = 0;
  if (typeof cssH === "number" && Number.isFinite(cssH) && cssH > 0) {
    h = cssH;
  } else if (typeof bufH === "number" && Number.isFinite(bufH) && bufH > 0) {
    h = bufH / safeDpr;
  }

  return { w, h };
}

/**
 * Computes side-by-side 3-panel chart layout geometry for comparison bars.
 * Returns left label gutter rect, 3 equal-width panel rects, and 3 row y positions.
 * All coordinates are in CSS pixels and clamped to stay within w x h without negative sizes.
 *
 * @param {number} w - Total width in CSS px
 * @param {number} h - Total height in CSS px
 * @param {object} [options]
 * @returns {{
 *   gutter: { x: number, y: number, w: number, h: number },
 *   panels: Array<{ x: number, y: number, w: number, h: number }>,
 *   rowY: number[],
 *   rowHeight: number,
 *   rows: Array<{ y: number, height: number }>
 * }}
 */
export function computeChartLayout(w, h, options = {}) {
  const safeW = (typeof w === "number" && Number.isFinite(w) && w > 0) ? w : 0;
  const safeH = (typeof h === "number" && Number.isFinite(h) && h > 0) ? h : 0;

  const padLeft = options.paddingLeft ?? 12;
  const padRight = options.paddingRight ?? 12;
  const padTop = options.paddingTop ?? 10;
  const padBottom = options.paddingBottom ?? 10;
  const reqGutterW = options.gutterWidth ?? 80;
  const targetGap = options.gap ?? 16;
  const headerHeight = options.headerHeight ?? 24;

  if (safeW <= 0 || safeH <= 0) {
    return {
      gutter: { x: 0, y: 0, w: 0, h: 0 },
      panels: [
        { x: 0, y: 0, w: 0, h: 0 },
        { x: 0, y: 0, w: 0, h: 0 },
        { x: 0, y: 0, w: 0, h: 0 }
      ],
      rowY: [0, 0, 0],
      rowHeight: 0,
      rows: [
        { y: 0, height: 0 },
        { y: 0, height: 0 },
        { y: 0, height: 0 }
      ]
    };
  }

  // Vertical layout
  const contentY = Math.min(safeH, padTop + headerHeight);
  const contentH = Math.max(0, safeH - contentY - padBottom);
  const rowHeight = Math.max(0, Math.floor(contentH / 3));

  const rowY = [
    contentY,
    contentY + rowHeight,
    contentY + 2 * rowHeight
  ];

  const rows = [
    { y: rowY[0], height: rowHeight },
    { y: rowY[1], height: rowHeight },
    { y: rowY[2], height: rowHeight }
  ];

  // Horizontal layout
  const availW = Math.max(0, safeW - padLeft - padRight);
  const gutterX = Math.min(padLeft, safeW);
  const gutterW = Math.min(reqGutterW, availW);
  const gutterH = Math.max(0, safeH - padTop - padBottom);

  const gutter = {
    x: gutterX,
    y: padTop,
    w: gutterW,
    h: gutterH
  };

  const afterGutterX = gutterX + gutterW;
  const remainingW = Math.max(0, safeW - afterGutterX - padRight);

  // Spacing for 3 panels: 1 gap after gutter + 2 gaps between panels
  const gap = remainingW >= 3 * targetGap ? targetGap : Math.max(0, Math.floor(remainingW / 4));
  const panelsStartX = afterGutterX + (remainingW > 0 ? gap : 0);
  const panelsTotalW = Math.max(0, safeW - panelsStartX - padRight);
  const panelW = Math.max(0, Math.floor((panelsTotalW - 2 * gap) / 3));
  const panelH = gutterH;

  const panels = [
    { x: panelsStartX, y: padTop, w: panelW, h: panelH },
    { x: panelsStartX + panelW + gap, y: padTop, w: panelW, h: panelH },
    { x: panelsStartX + 2 * (panelW + gap), y: padTop, w: panelW, h: panelH }
  ];

  return {
    gutter,
    panels,
    rowY,
    rowHeight,
    rows
  };
}

/**
 * Draws comparison bar charts on an HTML5 canvas without any inline CSS styles.
 * Renders 3 side-by-side metric charts (Latency, Distance Computations, Recall @ k)
 * with a single left algorithm label gutter. Sized strictly in CSS pixels.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Record<string, { latency: number, dist: number, recall: number }>} data
 * @param {boolean} [isDark=false]
 */
export function drawComparisonBars(canvas, data, isDark = false) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  const { w, h } = resolveChartSize(
    rect?.width || canvas.clientWidth || 0,
    rect?.height || canvas.clientHeight || 0,
    canvas.width,
    canvas.height,
    dpr
  );

  if (w <= 0 || h <= 0) return;

  ctx.fillStyle = THEME.bgCanvas;
  ctx.fillRect(0, 0, w, h);

  const layout = computeChartLayout(w, h, { gutterWidth: 80, gap: 16 });

  const algorithms = ["brute", "kdtree", "hnsw"];
  const textColor = THEME.textPrimary;
  const mutedColor = THEME.textMuted;
  const gridColor = THEME.gridLine;

  // 1. Draw left label gutter (once for the 3 algorithms)
  if (layout.gutter.w > 0 && layout.rowHeight > 0) {
    ctx.fillStyle = textColor;
    ctx.font = '12px "IBM Plex Sans", sans-serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    algorithms.forEach((alg, aIdx) => {
      const rowY = layout.rowY[aIdx];
      const rowCenterY = rowY + Math.floor(layout.rowHeight / 2);
      ctx.fillText(ALGORITHM_LABELS[alg] || alg, layout.gutter.x, rowCenterY);
    });
  }

  // 2. Section configs for the 3 side-by-side panels
  const sections = [
    {
      fullTitle: "Latency (μs) - lower is better",
      shortTitle: "Latency (μs)",
      compactTitle: "Latency",
      key: "latency",
      max: Math.max(...algorithms.map(a => data?.[a]?.latency || 0), 1),
      format: v => `${Math.round(v)} μs`
    },
    {
      fullTitle: "Distance Computations - lower is better",
      shortTitle: "Distance Computations",
      compactTitle: "Distances",
      key: "dist",
      max: Math.max(...algorithms.map(a => data?.[a]?.dist || 0), 1),
      format: v => `${v}`
    },
    {
      fullTitle: "Recall @ k - higher is better",
      shortTitle: "Recall @ k",
      compactTitle: "Recall",
      key: "recall",
      max: 1.0,
      format: v => `${(v * 100).toFixed(1)}%`
    }
  ];

  // 3. Draw each panel
  sections.forEach((sec, sIdx) => {
    const panel = layout.panels[sIdx];
    if (!panel || panel.w <= 0 || panel.h <= 0) return;

    // Pick best fitting title
    ctx.font = '11px "IBM Plex Sans", sans-serif';
    let displayTitle = sec.fullTitle;
    if (ctx.measureText(displayTitle).width > panel.w) {
      displayTitle = sec.shortTitle;
    }
    if (ctx.measureText(displayTitle).width > panel.w) {
      displayTitle = sec.compactTitle;
    }

    // Title
    ctx.fillStyle = mutedColor;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(displayTitle, panel.x, panel.y + 2);

    // Divider line removed per T-042 quiet studio specification

    if (layout.rowHeight <= 0) return;

    const barHeight = Math.max(2, Math.min(14, layout.rowHeight - 8));

    algorithms.forEach((alg, aIdx) => {
      const rowY = layout.rowY[aIdx];
      const barY = rowY + Math.floor((layout.rowHeight - barHeight) / 2);
      const rowCenterY = rowY + Math.floor(layout.rowHeight / 2);

      const rawVal = data?.[alg]?.[sec.key] || 0;
      const fraction = sec.max > 0 ? Math.min(1.0, Math.max(0, rawVal / sec.max)) : 0;

      const valStr = sec.format(rawVal);
      ctx.font = '11px "IBM Plex Mono", monospace';
      const valWidth = ctx.measureText(valStr).width;

      const textPad = 6;
      const maxBarW = Math.max(0, panel.w - valWidth - textPad - 4);
      const barW = maxBarW > 0 ? Math.max(2, Math.round(fraction * maxBarW)) : 0;

      // Draw horizontal bar
      if (barW > 0) {
        ctx.fillStyle = ALGORITHM_COLORS[alg] || DOC_FALLBACK_COLOR;
        ctx.fillRect(panel.x, barY, barW, barHeight);
      }

      // Draw value text
      if (panel.w > valWidth + 4) {
        const valX = panel.x + barW + textPad;
        const clampedValX = Math.min(valX, panel.x + panel.w - valWidth);
        ctx.fillStyle = textColor;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(valStr, clampedValX, rowCenterY);
      }
    });
  });
}

/**
 * Builds structured diff rows for the Top-k Ground Truth comparison table
 * using real server benchmark response fixture data.
 *
 * @param {object} report - Benchmark report containing algorithms: { brute, kdtree, hnsw }
 * @param {number} [maxRows=10] - Maximum rows to return (default: 10)
 * @returns {Array<{
 *   rank: number,
 *   brute: { id: number, distance: number } | null,
 *   kdtree: { id: number, distance: number, isMatch: boolean } | null,
 *   hnsw: { id: number, distance: number, isMatch: boolean } | null
 * }>}
 */
export function buildDiffRows(report, maxRows = 10) {
  if (!report || typeof report !== "object" || !report.algorithms) return [];

  const bruteList = Array.isArray(report.algorithms.brute?.results) ? report.algorithms.brute.results : [];
  const kdtreeList = Array.isArray(report.algorithms.kdtree?.results) ? report.algorithms.kdtree.results : [];
  const hnswList = Array.isArray(report.algorithms.hnsw?.results) ? report.algorithms.hnsw.results : [];

  const kdtreeDiff = diffAgainstGroundTruth(kdtreeList, bruteList);
  const hnswDiff = diffAgainstGroundTruth(hnswList, bruteList);

  const total = Math.max(bruteList.length, kdtreeList.length, hnswList.length);
  const limit = typeof maxRows === "number" && maxRows > 0 ? Math.min(total, maxRows) : total;
  const rows = [];

  for (let i = 0; i < limit; i++) {
    const b = bruteList[i] || null;
    const kd = kdtreeDiff[i] || null;
    const hn = hnswDiff[i] || null;

    rows.push({
      rank: i + 1,
      brute: b ? { id: b.id, distance: b.distance } : null,
      kdtree: kd ? { id: kd.id, distance: kd.distance, isMatch: Boolean(kd.isMatch) } : null,
      hnsw: hn ? { id: hn.id, distance: hn.distance, isMatch: Boolean(hn.isMatch) } : null
    });
  }

  return rows;
}

/**
 * Extracts and normalizes chart metric rows across algorithms from benchmark report.
 *
 * @param {object} report - Benchmark report containing algorithms
 * @param {object} [latencies] - Map of algorithm to latency sample arrays
 * @returns {{
 *   latency: Record<string, number>,
 *   dist: Record<string, number>,
 *   recall: Record<string, number>
 * }}
 */
export function extractChartMetrics(report, latencies = {}) {
  const algs = report?.algorithms || {};
  const algorithms = ["brute", "kdtree", "hnsw"];

  const res = {
    latency: { brute: 0, kdtree: 0, hnsw: 0 },
    dist: { brute: 0, kdtree: 0, hnsw: 0 },
    recall: { brute: 1.0, kdtree: 1.0, hnsw: 1.0 }
  };

  for (const alg of algorithms) {
    const aData = algs[alg] || {};
    const latList = latencies[alg];
    if (Array.isArray(latList) && latList.length > 0) {
      res.latency[alg] = computeTimingStats(latList).median;
    } else {
      res.latency[alg] = typeof aData.latency_us === "number" ? aData.latency_us : 0;
    }
    res.dist[alg] = typeof aData.distance_computations === "number" ? aData.distance_computations : 0;
    res.recall[alg] = typeof aData.recall_at_k === "number" ? aData.recall_at_k : 1.0;
  }

  return res;
}

/**
 * Metric configurations for individual stacked bar charts.
 */
export const METRIC_CONFIGS = {
  latency: {
    key: "latency",
    title: "Latency (μs) — lower is better",
    format: v => `${Math.round(v)} μs`
  },
  dist: {
    key: "dist",
    title: "Distance Computations — lower is better",
    format: v => `${v}`
  },
  recall: {
    key: "recall",
    title: "Recall@k — higher is better",
    format: v => `${(v * 100).toFixed(1)}%`
  }
};

/**
 * Draws a single horizontal bar chart with 3 rows (Brute Force, KD-Tree, HNSW)
 * and the metric value at the end of each bar. Sized strictly in CSS pixels.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} metricKey - "latency" | "dist" | "recall"
 * @param {Record<string, number>} metricValues - Map of algorithm to metric number
 * @param {boolean} [isDark=true]
 */
export function drawMetricBarChart(canvas, metricKey, metricValues, isDark = true) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  const { w, h } = resolveChartSize(
    rect?.width || canvas.clientWidth || 0,
    rect?.height || canvas.clientHeight || 0,
    canvas.width,
    canvas.height,
    dpr
  );

  if (w <= 0 || h <= 0) return;

  ctx.clearRect(0, 0, w, h);

  const algorithms = ["brute", "kdtree", "hnsw"];
  const cfg = METRIC_CONFIGS[metricKey] || METRIC_CONFIGS.latency;

  const maxVal = metricKey === "recall"
    ? 1.0
    : Math.max(...algorithms.map(a => metricValues?.[a] || 0), 1);

  const padLeft = 8;
  const padRight = 8;
  const labelWidth = 74;
  const barStartX = padLeft + labelWidth + 8;
  const rowCount = 3;
  const rowHeight = Math.max(0, Math.floor(h / rowCount));
  const barHeight = Math.max(6, Math.min(14, rowHeight - 12));

  algorithms.forEach((alg, idx) => {
    const rowY = idx * rowHeight;
    const rowCenterY = rowY + Math.floor(rowHeight / 2);
    const barY = rowCenterY - Math.floor(barHeight / 2);

    // Algorithm name on left
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '12px "IBM Plex Sans", sans-serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(ALGORITHM_LABELS[alg] || alg, padLeft, rowCenterY);

    // Value calculation
    const rawVal = metricValues?.[alg] || 0;
    const fraction = maxVal > 0 ? Math.min(1.0, Math.max(0, rawVal / maxVal)) : 0;
    const valStr = cfg.format(rawVal);

    ctx.font = '11px "IBM Plex Mono", monospace';
    const valWidth = ctx.measureText(valStr).width;
    const textPad = 8;
    const maxBarW = Math.max(0, w - barStartX - valWidth - textPad - padRight);
    const barW = maxBarW > 0 ? Math.max(3, Math.round(fraction * maxBarW)) : 0;

    // Draw horizontal bar
    if (barW > 0) {
      ctx.fillStyle = ALGORITHM_COLORS[alg] || DOC_FALLBACK_COLOR;
      ctx.fillRect(barStartX, barY, barW, barHeight);
    }

    // Draw value at the end of the bar
    if (w > barStartX + valWidth) {
      const valX = barStartX + barW + textPad;
      const clampedValX = Math.min(valX, w - valWidth - padRight);
      ctx.fillStyle = THEME.textPrimary;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(valStr, clampedValX, rowCenterY);
    }
  });
}

