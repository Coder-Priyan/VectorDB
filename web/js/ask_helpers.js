/**
 * VectorDB Ask Tab Glass-Box Response Mappers & Formatting Helpers
 *
 * Pure-logic parsers that map backend benchmark and HNSW trace JSON responses
 * to view models for UI rendering and automated unit testing.
 *
 * Zero-innerHTML & strict CSP compliant.
 */

/**
 * Maps POST /api/docs/benchmark or /api/benchmark server response to display rows.
 *
 * @param {object} bRes - Server response with { algorithms: { brute, kdtree, hnsw }, count, k }
 * @returns {Array<object>} Array of formatted row objects for rendering
 */
export function formatBenchmarkRows(bRes) {
  if (!bRes || !bRes.algorithms) return [];

  const algs = bRes.algorithms;
  const order = ["brute", "kdtree", "hnsw"];
  const labels = {
    brute: "Brute Force",
    kdtree: "KD-Tree",
    hnsw: "HNSW"
  };

  const rows = [];
  let maxLatency = 0;

  for (const key of order) {
    const data = algs[key];
    if (!data) continue;
    const lat = typeof data.latency_us === "number" ? data.latency_us : 0;
    if (lat > maxLatency) maxLatency = lat;
    const dist = typeof data.distance_computations === "number" ? data.distance_computations : 0;
    const recall = typeof data.recall_at_k === "number" ? data.recall_at_k : 1.0;

    rows.push({
      key,
      name: labels[key] || key.toUpperCase(),
      latencyUs: lat,
      latencyFormatted: lat < 1000 ? `${lat} μs` : `${(lat / 1000).toFixed(2)} ms`,
      distanceComputations: dist,
      recallFormatted: `${(recall * 100).toFixed(0)}%`
    });
  }

  return rows.map(r => ({
    ...r,
    percent: maxLatency > 0 ? Math.max(12, Math.round((r.latencyUs / maxLatency) * 100)) : 100
  }));
}

/**
 * Maps POST /api/hnsw/trace server response to summary statistics and text.
 *
 * @param {object} tRes - Server response with { stats: { nodesVisited, distanceComputations, visitedPerLayer }, trace, results }
 * @returns {object} Summary metadata and descriptive string
 */
export function formatTraceSummary(tRes) {
  if (!tRes) {
    return {
      nodesVisited: 0,
      layersCount: 0,
      distComps: 0,
      topKCount: 0,
      summaryText: "No trace data available."
    };
  }

  const trace = Array.isArray(tRes.trace) ? tRes.trace : [];
  const nodesVisited = typeof tRes.stats?.nodesVisited === "number"
    ? tRes.stats.nodesVisited
    : trace.length;

  let layersCount = 1;
  if (tRes.stats?.visitedPerLayer) {
    if (Array.isArray(tRes.stats.visitedPerLayer)) {
      layersCount = Math.max(1, tRes.stats.visitedPerLayer.length);
    } else if (typeof tRes.stats.visitedPerLayer === "object") {
      layersCount = Math.max(1, Object.keys(tRes.stats.visitedPerLayer).length);
    }
  } else if (trace.length > 0) {
    layersCount = Math.max(...trace.map(s => (typeof s.layer === "number" ? s.layer : 0))) + 1;
  }

  const distComps = typeof tRes.stats?.distanceComputations === "number"
    ? tRes.stats.distanceComputations
    : nodesVisited;

  const topKCount = Array.isArray(tRes.results) ? tRes.results.length : 3;

  const summaryText = `HNSW visited ${nodesVisited} node${nodesVisited === 1 ? "" : "s"} across ${layersCount} layer${layersCount === 1 ? "" : "s"} (${distComps} distance computations) to locate top ${topKCount} chunks.`;

  return {
    nodesVisited,
    layersCount,
    distComps,
    topKCount,
    summaryText
  };
}
