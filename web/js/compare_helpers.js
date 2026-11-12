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
 * Draws comparison bar charts on an HTML5 canvas without any inline CSS styles.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Record<string, { latency: number, dist: number, recall: number }>} data
 * @param {boolean} [isDark=false]
 */
export function drawComparisonBars(canvas, data, isDark = false) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, w, h);

  const algorithms = ["brute", "kdtree", "hnsw"];
  const textColor = "#f0ede6";
  const mutedColor = "#949087";
  const gridColor = "#2a2a2a";

  // Section configs
  const sections = [
    { title: "Latency (μs) - lower is better", key: "latency", max: Math.max(...algorithms.map(a => data[a]?.latency || 0), 1), format: v => `${Math.round(v)} μs` },
    { title: "Distance Computations - lower is better", key: "dist", max: Math.max(...algorithms.map(a => data[a]?.dist || 0), 1), format: v => `${v}` },
    { title: "Recall @ k - higher is better", key: "recall", max: 1.0, format: v => `${(v * 100).toFixed(1)}%` }
  ];

  const secHeight = (h - 20) / sections.length;
  const labelWidth = 85;
  const valueWidth = 75;
  const barStartX = labelWidth + 10;
  const maxBarWidth = w - barStartX - valueWidth - 15;

  sections.forEach((sec, sIdx) => {
    const secY = 10 + sIdx * secHeight;

    // Title
    ctx.fillStyle = mutedColor;
    ctx.font = '12px "IBM Plex Sans", sans-serif';
    ctx.fillText(sec.title, 10, secY + 12);

    // Baseline grid rule
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, secY + 16);
    ctx.lineTo(w - 10, secY + 16);
    ctx.stroke();

    const rowHeight = (secHeight - 24) / algorithms.length;

    algorithms.forEach((alg, aIdx) => {
      const rowY = secY + 22 + aIdx * rowHeight;
      const rawVal = data[alg]?.[sec.key] || 0;
      const fraction = sec.max > 0 ? Math.min(1.0, Math.max(0, rawVal / sec.max)) : 0;
      const barW = Math.max(2, Math.round(fraction * maxBarWidth));

      // Label
      ctx.fillStyle = textColor;
      ctx.font = '12px "IBM Plex Sans", sans-serif';
      ctx.fillText(ALGORITHM_LABELS[alg] || alg, 10, rowY + rowHeight - 4);

      // Bar
      ctx.fillStyle = ALGORITHM_COLORS[alg] || "#807c74";
      ctx.fillRect(barStartX, rowY + 2, barW, rowHeight - 5);

      // Value text
      ctx.fillStyle = textColor;
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillText(sec.format(rawVal), barStartX + barW + 6, rowY + rowHeight - 4);
    });
  });
}

