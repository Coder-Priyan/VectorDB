/**
 * VectorDB HNSW Pure Logic Helpers & Playback State Machine
 *
 * Implements trace-to-coordinate mapping (with missing node handling),
 * layer color mapping, edge truncation formatters, and a pure playback state machine.
 */

export const LAYER_COLORS = [
  "#3b82f6", // Layer 0: Blue
  "#10b981", // Layer 1: Green
  "#f59e0b", // Layer 2: Amber
  "#8b5cf6", // Layer 3: Purple
  "#ef4444"  // Layer 4+: Red
];

export function getLayerColor(layer) {
  if (layer < 0) return "#94a3b8";
  return LAYER_COLORS[Math.min(layer, LAYER_COLORS.length - 1)];
}

/**
 * Formats edge count and truncation warning label.
 */
export function formatEdgeSummary(edgesCount, totalEdges, truncated) {
  const shown = Number(edgesCount) || 0;
  const total = Number(totalEdges) || shown;
  const isTrunc = Boolean(truncated) || shown < total;
  return {
    label: `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} edges`,
    isTruncated: isTrunc
  };
}

/**
 * Formats HNSW graph topology summary into safe display strings.
 * Gracefully handles empty or uninitialized graphs by displaying "-".
 *
 * @param {Object} info - API response from /api/hnsw/info or /api/docs/hnsw/info
 * @returns {{ nodesMaxLvl: string, entryPointId: string, nodesPerLayer: string, avgDegreePerLayer: string }}
 */
export function formatHnswTopologySummary(info) {
  if (!info || !info.numNodes || info.numNodes === 0) {
    return {
      nodesMaxLvl: "-",
      entryPointId: "-",
      nodesPerLayer: "-",
      avgDegreePerLayer: "-"
    };
  }
  const nPerL = (info.nodesPerLayer || []).map((c, l) => `L${l}: ${c}`).join(", ");
  const dPerL = (info.avgDegreePerLayer || []).map((d, l) => `L${l}: ${d.toFixed(1)}`).join(", ");
  return {
    nodesMaxLvl: `${info.numNodes} / ${info.maxLevel}`,
    entryPointId: info.entryPointId !== undefined && info.entryPointId !== null ? String(info.entryPointId) : "-",
    nodesPerLayer: nPerL || "-",
    avgDegreePerLayer: dPerL || "-"
  };
}

/**
 * Maps HNSW trace steps to 2D PCA positions using an ID -> {x, y} coordinate map.
 * Gracefully marks nodes not present in the PCA projection set.
 *
 * @param {Array<{layer: number, id: number, distance: number}>} trace
 * @param {Map<number, {x: number, y: number}>|Object} pcaMap
 * @returns {{ mappedSteps: Array<Object>, missingCount: number }}
 */
export function mapTraceToCoordinates(trace, pcaMap) {
  if (!trace || !Array.isArray(trace)) {
    return { mappedSteps: [], missingCount: 0 };
  }

  const isMap = pcaMap instanceof Map;
  const getCoord = (id) => isMap ? pcaMap.get(id) : pcaMap?.[id];

  const mappedSteps = [];
  let missingCount = 0;

  for (let i = 0; i < trace.length; i++) {
    const step = trace[i];
    const coord = getCoord(step.id);

    if (coord && typeof coord.x === "number" && typeof coord.y === "number") {
      mappedSteps.push({
        layer: step.layer,
        id: step.id,
        distance: step.distance,
        x: coord.x,
        y: coord.y,
        onMap: true
      });
    } else {
      missingCount++;
      mappedSteps.push({
        layer: step.layer,
        id: step.id,
        distance: step.distance,
        onMap: false
      });
    }
  }

  return { mappedSteps, missingCount };
}

/**
 * Pure Playback State Machine for Step-by-Step Search Animation.
 */
export class PlaybackController {
  constructor(steps = []) {
    this.steps = steps;
    this.currentIndex = -1;
    this.isPlaying = false;
  }

  setSteps(steps = []) {
    this.steps = steps;
    this.currentIndex = -1;
    this.isPlaying = false;
  }

  play() {
    if (this.steps.length === 0) return;
    if (this.currentIndex >= this.steps.length - 1) {
      this.currentIndex = -1;
    }
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  stepForward() {
    this.pause();
    if (this.currentIndex < this.steps.length - 1) {
      this.currentIndex++;
    }
    return this.getState();
  }

  stepBack() {
    this.pause();
    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else if (this.currentIndex === 0) {
      this.currentIndex = -1;
    }
    return this.getState();
  }

  tick() {
    if (!this.isPlaying) return this.getState();
    if (this.currentIndex < this.steps.length - 1) {
      this.currentIndex++;
    } else {
      this.isPlaying = false;
    }
    return this.getState();
  }

  seek(index) {
    this.pause();
    const clamped = Math.max(-1, Math.min(index, this.steps.length - 1));
    this.currentIndex = clamped;
    return this.getState();
  }

  reset() {
    this.pause();
    this.currentIndex = -1;
    return this.getState();
  }

  getState() {
    const total = this.steps.length;
    const isDone = total > 0 && this.currentIndex >= total - 1;
    return {
      currentIndex: this.currentIndex,
      totalSteps: total,
      isPlaying: this.isPlaying,
      currentStep: this.currentIndex >= 0 ? this.steps[this.currentIndex] : null,
      isDone
    };
  }
}

