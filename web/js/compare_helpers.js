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
  const safeLatencies = (latencies && typeof latencies === "object") ? latencies : {};
  const algs = report?.algorithms || {};
  const algorithms = ["brute", "kdtree", "hnsw"];

  const res = {
    latency: { brute: 0, kdtree: 0, hnsw: 0 },
    dist: { brute: 0, kdtree: 0, hnsw: 0 },
    recall: { brute: 1.0, kdtree: 1.0, hnsw: 1.0 }
  };

  for (const alg of algorithms) {
    const aData = algs[alg] || {};
    const latList = safeLatencies[alg];
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
    title: "Latency (μs)",
    subtitle: "Lower is better",
    axisTitle: "Latency (μs)",
    format: v => `${Math.round(v)} μs`
  },
  dist: {
    key: "dist",
    title: "Distance Computations",
    subtitle: "Lower is better",
    axisTitle: "Distance Computations",
    format: v => `${Math.round(v)}`
  },
  recall: {
    key: "recall",
    title: "Recall@k",
    subtitle: "Higher is better",
    axisTitle: "Recall@k",
    format: v => `${(v * 100).toFixed(1)}%`
  }
};

/**
 * Calculates a "nice" upper bound, step size, and tick sequence for a numeric axis.
 * Produces ~5-6 ticks.
 *
 * @param {number} maxValue - The maximum data value to accommodate
 * @param {number} [targetTicks=5] - Desired approximate number of intervals
 * @returns {{ max: number, step: number, ticks: number[] }}
 */
export function niceAxis(maxValue, targetTicks = 5) {
  if (typeof maxValue !== "number" || isNaN(maxValue) || maxValue <= 0) {
    return {
      max: 10,
      step: 2,
      ticks: [0, 2, 4, 6, 8, 10]
    };
  }

  const roughStep = maxValue / Math.max(1, targetTicks);
  const exponent = Math.floor(Math.log10(roughStep));
  const magnitude = Math.pow(10, exponent);
  const normalized = roughStep / magnitude;

  let stepMultiplier;
  if (normalized < 1.5) {
    stepMultiplier = 1;
  } else if (normalized < 3.5) {
    stepMultiplier = 2;
  } else if (normalized < 7.5) {
    stepMultiplier = 5;
  } else {
    stepMultiplier = 10;
  }

  const step = stepMultiplier * magnitude;
  const max = Math.ceil(maxValue / step) * step;

  const ticks = [];
  const decimals = Math.max(0, -exponent + (stepMultiplier < 1 ? 1 : 0));
  for (let val = 0; val <= max + step * 0.001; val += step) {
    const rounded = Number(val.toFixed(decimals < 10 ? Math.min(6, Math.max(0, decimals)) : 2));
    if (rounded <= max) {
      ticks.push(rounded);
    }
  }

  if (ticks.length === 0 || ticks[0] !== 0) ticks.unshift(0);
  if (ticks[ticks.length - 1] < max) ticks.push(Number(max.toFixed(4)));

  return {
    max: Number(max.toFixed(4)),
    step: Number(step.toFixed(4)),
    ticks
  };
}

/**
 * Returns axis configuration (max, step, ticks, formatTick) tailored for each metric type.
 *
 * @param {string} metricKey - "latency" | "dist" | "recall"
 * @param {number} maxValue - Max value in the dataset
 * @returns {{ max: number, step: number, ticks: number[], formatTick: (v: number) => string }}
 */
export function getMetricAxisConfig(metricKey, maxValue) {
  if (metricKey === "recall") {
    return {
      max: 1.0,
      step: 0.2,
      ticks: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
      formatTick: (val) => `${Math.round(val * 100)}%`
    };
  }
  const axis = niceAxis(maxValue);
  return {
    ...axis,
    formatTick: (val) => String(val)
  };
}

/**
 * Maps raw benchmark report algorithms into chart rows with labels, colors, and formatted values.
 *
 * @param {string} metricKey - "latency" | "dist" | "recall"
 * @param {Object} report - Raw server response with report.algorithms
 * @param {Object} [latencies=null] - Optional repetition sample lists { brute: [], kdtree: [], hnsw: [] }
 * @returns {Array<{ algorithm: string, label: string, value: number, formattedValue: string, color: string }>}
 */
export function mapChartRows(metricKey, report, latencies = null) {
  const metrics = extractChartMetrics(report, latencies);
  const values = metrics[metricKey] || {};
  const cfg = METRIC_CONFIGS[metricKey] || METRIC_CONFIGS.latency;
  const algorithms = ["brute", "kdtree", "hnsw"];

  return algorithms.map(alg => {
    const rawVal = typeof values[alg] === "number" ? values[alg] : 0;
    return {
      algorithm: alg,
      label: ALGORITHM_LABELS[alg] || alg,
      value: rawVal,
      formattedValue: cfg.format(rawVal),
      color: ALGORITHM_COLORS[alg] || DOC_FALLBACK_COLOR
    };
  });
}

/**
 * Helper to draw a horizontal bar with slightly rounded right corners.
 */
function drawBarWithRoundedRightEnd(ctx, x, y, width, height, radius = 3) {
  if (width <= 0 || height <= 0) return;
  const r = Math.min(radius, width / 2, height / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath?.();
    ctx.roundRect(x, y, width, height, [0, r, r, 0]);
    ctx.fill?.();
    return;
  }
  ctx.beginPath?.();
  ctx.moveTo?.(x, y);
  ctx.lineTo?.(x + width - r, y);
  ctx.quadraticCurveTo?.(x + width, y, x + width, y + r);
  ctx.lineTo?.(x + width, y + height - r);
  ctx.quadraticCurveTo?.(x + width, y + height, x + width - r, y + height);
  ctx.lineTo?.(x, y + height);
  ctx.closePath?.();
  ctx.fill?.();
}

/**
 * Draws a single horizontal bar chart with 3 rows (Brute Force, KD-Tree, HNSW),
 * value labels at the end of each bar, and an X-axis below with ticks and centered title.
 * Sized strictly in CSS pixels and DPR-safe.
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

  ctx.clearRect?.(0, 0, w, h);

  const algorithms = ["brute", "kdtree", "hnsw"];
  const cfg = METRIC_CONFIGS[metricKey] || METRIC_CONFIGS.latency;

  const maxDataVal = Math.max(...algorithms.map(a => metricValues?.[a] || 0), 0);
  const axisCfg = getMetricAxisConfig(metricKey, maxDataVal);
  const axisMax = axisCfg.max;

  const padLeft = 8;
  const padRight = 8;
  const labelWidth = 74;
  const barStartX = padLeft + labelWidth + 8;

  // Measure max formatted value text width to reserve right padding
  let maxValTextW = 32;
  if (ctx.measureText) {
    algorithms.forEach(alg => {
      const vStr = cfg.format(metricValues?.[alg] || 0);
      const measured = ctx.measureText(vStr)?.width || 30;
      if (measured > maxValTextW) maxValTextW = measured;
    });
  }
  const reservedValRoom = Math.max(46, Math.ceil(maxValTextW) + 10);
  const axisEndX = Math.max(barStartX + 30, w - padRight - reservedValRoom);
  const axisWidth = Math.max(1, axisEndX - barStartX);

  // Vertical layout budgeting: keep axis height fixed, let row gap adapt if space is tight
  const axisAreaHeight = 36;
  const barsAreaHeight = Math.max(30, h - axisAreaHeight);
  const rowCount = 3;
  const rowHeight = Math.max(12, barsAreaHeight / rowCount);
  const barHeight = Math.max(12, Math.min(18, Math.floor(rowHeight * 0.58)));

  // 1. Draw very faint vertical gridlines at ticks
  if (axisMax > 0 && Array.isArray(axisCfg.ticks)) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    axisCfg.ticks.forEach(t => {
      const tickX = Math.round(barStartX + (t / axisMax) * axisWidth);
      ctx.beginPath?.();
      ctx.moveTo?.(tickX, 2);
      ctx.lineTo?.(tickX, barsAreaHeight);
      ctx.stroke?.();
    });
  }

  // 2. Draw algorithm rows (label, solid rounded bar, mono value)
  algorithms.forEach((alg, idx) => {
    const rowY = idx * rowHeight;
    const rowCenterY = Math.round(rowY + rowHeight / 2);
    const barY = Math.round(rowCenterY - barHeight / 2);

    // Row label on left in sans
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '12px "IBM Plex Sans", sans-serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText?.(ALGORITHM_LABELS[alg] || alg, padLeft, rowCenterY);

    // Value and bar length
    const rawVal = metricValues?.[alg] || 0;
    const fraction = axisMax > 0 ? Math.min(1.0, Math.max(0, rawVal / axisMax)) : 0;
    const barW = Math.max(fraction > 0 ? 3 : 0, Math.round(fraction * axisWidth));
    const valStr = cfg.format(rawVal);

    // Draw solid bar with rounded right end (thicker: 14-18px)
    if (barW > 0) {
      ctx.fillStyle = ALGORITHM_COLORS[alg] || DOC_FALLBACK_COLOR;
      drawBarWithRoundedRightEnd(ctx, barStartX, barY, barW, barHeight, 3);
    }

    // Draw mono value label right after bar end (or inside bar if near max)
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textBaseline = "middle";
    const textW = ctx.measureText ? (ctx.measureText(valStr)?.width || 30) : 30;
    let valX = barStartX + barW + 6;

    if (valX + textW > w - padRight) {
      if (barW > textW + 12) {
        valX = barStartX + barW - textW - 6;
        ctx.fillStyle = THEME.white;
      } else {
        valX = Math.max(barStartX + 4, w - padRight - textW);
        ctx.fillStyle = THEME.textPrimary;
      }
    } else {
      ctx.fillStyle = THEME.textPrimary;
    }
    ctx.textAlign = "left";
    ctx.fillText?.(valStr, valX, rowCenterY);
  });

  // 3. Draw X-axis under the bars
  const axisY = barsAreaHeight + 2;

  // Thin hairline axis
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath?.();
  ctx.moveTo?.(barStartX, axisY);
  ctx.lineTo?.(axisEndX, axisY);
  ctx.stroke?.();

  // Tick marks and tick labels
  ctx.font = '10px "IBM Plex Sans", sans-serif';
  ctx.fillStyle = THEME.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  if (axisMax > 0 && Array.isArray(axisCfg.ticks)) {
    axisCfg.ticks.forEach(t => {
      const tickX = Math.round(barStartX + (t / axisMax) * axisWidth);
      ctx.beginPath?.();
      ctx.moveTo?.(tickX, axisY);
      ctx.lineTo?.(tickX, axisY + 3);
      ctx.stroke?.();

      const tickLabel = axisCfg.formatTick ? axisCfg.formatTick(t) : String(t);
      ctx.fillText?.(tickLabel, tickX, axisY + 5);
    });
  }

  // Axis title centered below ticks
  const axisTitle = cfg.axisTitle || cfg.title;
  const titleY = axisY + 18;
  ctx.font = '11px "IBM Plex Sans", sans-serif';
  ctx.fillStyle = THEME.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const centerAxisX = Math.round(barStartX + axisWidth / 2);
  ctx.fillText?.(axisTitle, centerAxisX, titleY);
}

/**
 * Resolves the empty-state presentation configuration (title, description, canRun)
 * for the Compare tab based on collection type, item count, and benchmark result status.
 *
 * @param {string} collection - "demo" | "docs"
 * @param {number} count - Count of vectors (demo) or documents (docs)
 * @param {boolean} [hasResults=false] - Whether benchmark results are currently present
 * @returns {{
 *   showEmpty: boolean,
 *   title: string,
 *   description: string,
 *   canRun: boolean,
 *   buttonText: string
 * }}
 */
export function getCompareEmptyStateConfig(collection, count, hasResults = false) {
  const isDocs = collection === "docs";
  const numItems = typeof count === "number" && !isNaN(count) ? Math.max(0, count) : 0;
  const buttonText = isDocs ? "Benchmark Document Chunks" : "Benchmark Demo Vectors";

  if (hasResults && numItems > 0) {
    return {
      showEmpty: false,
      title: "",
      description: "",
      canRun: true,
      buttonText
    };
  }

  if (numItems === 0) {
    return {
      showEmpty: true,
      title: isDocs ? "No documents yet" : "Collection is empty",
      description: isDocs
        ? "No documents ingested yet. Add documents in the Ask tab, or switch to the Demo collection."
        : "Demo collection is empty. Insert vectors in Settings, or run benchmarks on Document Chunks.",
      canRun: false,
      buttonText
    };
  }

  return {
    showEmpty: true,
    title: "No benchmark yet",
    description: "Run a benchmark to see latency, distance computations, recall and the top-k diff.",
    canRun: true,
    buttonText
  };
}

/**
 * Computes a shared linear scale for numeric values (e.g. distance computations).
 * Clamped strictly 0..100%. If max is 0, bar width is 0%.
 *
 * @param {number[]|Record<string, number>} values
 * @returns {{ max: number, getBarWidthPercent: (val: number) => number }}
 */
export function computeBarScale(values) {
  const list = Array.isArray(values)
    ? values
    : (values && typeof values === "object" ? Object.values(values) : []);
  const safeVals = list.map(v => Math.max(0, Number(v) || 0));
  const maxVal = Math.max(...safeVals, 0);

  return {
    max: maxVal,
    getBarWidthPercent: (val) => {
      if (maxVal === 0) return 0;
      const safeVal = Math.max(0, Number(val) || 0);
      return Math.min(100, Math.max(0, Math.round((safeVal / maxVal) * 100)));
    }
  };
}

/**
 * Computes filled and unfilled square counts for top-k recall visualization.
 *
 * @param {number} recall - 0.0 to 1.0
 * @param {number} k - requested or returned k
 * @returns {{ k: number, filled: number, unfilled: number }}
 */
export function computeRecallSquares(recall, k) {
  const safeK = Math.max(1, Math.round(Number(k) || 10));
  const safeRecall = Math.max(0, Math.min(1, Number(recall) || 0));
  const filled = Math.max(0, Math.min(safeK, Math.round(safeRecall * safeK)));
  const unfilled = safeK - filled;
  return { k: safeK, filled, unfilled };
}

/**
 * Computes shared linear scale for latency bars across algorithms.
 *
 * @param {number[]|Record<string, number>} medians
 * @returns {{ max: number, getBarWidthPercent: (median: number) => number }}
 */
export function computeLatencyScale(medians) {
  const values = Array.isArray(medians)
    ? medians
    : (medians && typeof medians === "object" ? Object.values(medians) : []);
  const safeVals = values.map(v => Math.max(0, Number(v) || 0));
  const maxVal = Math.max(...safeVals, 1);
  const scaleMax = maxVal * 1.15;

  return {
    max: scaleMax,
    getBarWidthPercent: (median) => {
      const safeMed = Math.max(0, Number(median) || 0);
      return Math.min(100, Math.max(2, Math.round((safeMed / scaleMax) * 100)));
    }
  };
}

/**
 * Formats min-max timing range text strictly in microseconds (µs).
 *
 * @param {number} min
 * @param {number} max
 * @returns {string}
 */
export function formatRangeText(min, max) {
  const safeMin = Math.max(0, Math.round(Number(min) || 0));
  const safeMax = Math.max(0, Math.round(Number(max) || 0));
  return `${safeMin} - ${safeMax} µs`;
}

/**
 * Formats recall_at_k as a percentage string with one decimal place.
 * Clamped between 0.0% and 100.0%. Fallback "0.0%".
 *
 * @param {number} recall
 * @returns {string}
 */
export function formatRecallPercent(recall) {
  if (typeof recall !== "number" || !Number.isFinite(recall)) {
    return "0.0%";
  }
  const clamped = Math.max(0, Math.min(1, recall));
  return `${(clamped * 100).toFixed(1)}%`;
}

/**
 * Builds rank strip descriptors comparing candidate results against ground truth.
 *
 * @param {Array<{id: number|string}>} groundTruthResults
 * @param {Array<{id: number|string}>} candidateResults
 * @param {number} k
 * @returns {Array<{ rank: number, isMatch: boolean, expectedId: number|string|null, gotId: number|string|null }> & { sameCount: number, total: number, cells: Array }}
 */
export function buildRankStrip(groundTruthResults, candidateResults, k) {
  const safeK = Math.max(1, Math.min(100, Math.round(Number(k) || 10)));
  const gtList = Array.isArray(groundTruthResults) ? groundTruthResults.slice(0, safeK) : [];
  const candList = Array.isArray(candidateResults) ? candidateResults.slice(0, safeK) : [];

  let sameCount = 0;
  const cells = [];

  for (let i = 0; i < safeK; i++) {
    const rank = i + 1;
    const gtItem = gtList[i];
    const expectedId = (gtItem && gtItem.id !== undefined && gtItem.id !== null)
      ? gtItem.id
      : null;

    const candItem = candList[i];
    const gotId = (candItem && candItem.id !== undefined && candItem.id !== null)
      ? candItem.id
      : null;

    const isMatch = (expectedId !== null && gotId !== null && expectedId === gotId);
    if (isMatch) {
      sameCount++;
    }

    cells.push({ rank, isMatch, expectedId, gotId });
  }

  cells.sameCount = sameCount;
  cells.total = safeK;
  cells.cells = cells;
  return cells;
}

/**
 * Maps a benchmark report and latencies into 3 card view-models (brute, kdtree, hnsw).
 *
 * @param {Object} report
 * @param {Object} [latencies]
 * @returns {Array<{
 *   alg: "brute"|"kdtree"|"hnsw",
 *   label: string,
 *   isBrute: boolean,
 *   medianUs: number,
 *   rangeText: string,
 *   barWidthPct: number,
 *   distanceComputations: number,
 *   rankStrip: Array<{ rank: number, isMatch: boolean, expectedId: number|string|null, gotId: number|string|null }>|null,
 *   sameCount: number,
 *   total: number,
 *   recallPercent: string
 * }>}
 */
export function mapReportToCards(report, latencies) {
  if (!report || typeof report !== "object" || !report.algorithms) {
    return [];
  }

  const algs = report.algorithms;
  const stats = {
    brute: computeTimingStats(latencies?.brute || [algs.brute?.latency_us || 0]),
    kdtree: computeTimingStats(latencies?.kdtree || [algs.kdtree?.latency_us || 0]),
    hnsw: computeTimingStats(latencies?.hnsw || [algs.hnsw?.latency_us || 0])
  };

  const latencyScale = computeBarScale([
    stats.brute.median,
    stats.kdtree.median,
    stats.hnsw.median
  ]);

  const kVal = Math.max(1, Math.round(Number(report.k) || 10));
  const bruteResults = Array.isArray(algs.brute?.results) ? algs.brute.results : [];
  const algKeys = ["brute", "kdtree", "hnsw"];

  return algKeys.map(alg => {
    const aData = algs[alg] || {};
    const tStat = stats[alg];
    const medianUs = Math.round(tStat.median);
    const rangeText = formatRangeText(tStat.min, tStat.max);
    const barWidthPct = latencyScale.getBarWidthPercent(tStat.median);
    const distanceComputations = Math.max(0, Math.round(Number(aData.distance_computations) || 0));
    const recallPercent = formatRecallPercent(aData.recall_at_k);
    const isBrute = alg === "brute";

    let rankStrip = null;
    let sameCount = 0;
    let total = kVal;

    if (!isBrute) {
      rankStrip = buildRankStrip(bruteResults, aData.results, kVal);
      sameCount = rankStrip.sameCount;
      total = rankStrip.total;
    }

    return {
      alg,
      label: ALGORITHM_LABELS[alg] || alg,
      isBrute,
      medianUs,
      rangeText,
      barWidthPct,
      distanceComputations,
      rankStrip,
      sameCount,
      total,
      recallPercent
    };
  });
}

