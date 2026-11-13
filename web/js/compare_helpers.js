/**
 * Pure Logic & Math Helpers for Multi-Algorithm Benchmark Comparison
 */

export const ALGORITHM_COLORS = {
  brute: "#9c8269",   // Taupe
  kdtree: "#708a78",  // Moss
  hnsw: "#d9a441"     // Amber
};

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

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, w, h);

  const layout = computeChartLayout(w, h, { gutterWidth: 80, gap: 16 });

  const algorithms = ["brute", "kdtree", "hnsw"];
  const textColor = "#f0ede6";
  const mutedColor = "#949087";
  const gridColor = "#2a2a2a";

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

    // Baseline grid rule below title
    const contentY = layout.rowY[0];
    const dividerY = Math.max(panel.y + 16, contentY - 6);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panel.x, dividerY);
    ctx.lineTo(panel.x + panel.w, dividerY);
    ctx.stroke();

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
        ctx.fillStyle = ALGORITHM_COLORS[alg] || "#807c74";
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

