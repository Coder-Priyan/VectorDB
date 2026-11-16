/**
 * VectorDB 2D Explore Pure Logic Helpers
 *
 * Provides hit-testing, deterministic document color assignment,
 * coordinate bounding, and star marker geometry.
 */

import { DOC_COLOR_PALETTE, DOC_FALLBACK_COLOR } from "./colors.js";

export { DOC_COLOR_PALETTE };

/**
 * Deterministically maps an integer document ID to a color palette hex code.
 */
export function getDocColor(docId) {
  if (docId === null || docId === undefined || isNaN(docId)) {
    return DOC_FALLBACK_COLOR;
  }
  const idNum = Math.abs(parseInt(docId, 10));
  return DOC_COLOR_PALETTE[idNum % DOC_COLOR_PALETTE.length];
}

/**
 * Computes min and max bounds for an array of 2D points.
 */
export function computeBounds(points) {
  if (!points || points.length === 0) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  if (minX === Infinity) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Finds the nearest point within a screen-pixel radius of (screenX, screenY).
 * Pure function: calculates screen coordinates via viewport.toScreen().
 *
 * @param {number} screenX - Mouse screen X
 * @param {number} screenY - Mouse screen Y
 * @param {Array<{x: number, y: number, id: any}>} points
 * @param {Object} viewport - Viewport with toScreen(x, y)
 * @param {number} [hitRadiusPx=8] - Threshold in pixels
 * @returns {Object|null} Nearest point or null if none within radius
 */
export function findHitPoint(screenX, screenY, points, viewport, hitRadiusPx = 8) {
  if (!points || points.length === 0 || !viewport) return null;

  let bestPoint = null;
  let bestDistSq = hitRadiusPx * hitRadiusPx;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const scr = viewport.toScreen(pt.x, pt.y);
    const dx = screenX - scr.x;
    const dy = screenY - scr.y;
    const distSq = dx * dx + dy * dy;

    if (distSq <= bestDistSq) {
      bestDistSq = distSq;
      bestPoint = pt;
    }
  }

  return bestPoint;
}

/**
 * Draws a 5-point star path centered at (cx, cy).
 */
export function drawStar(ctx, cx, cy, spikes = 5, outerRadius = 9, innerRadius = 4.5) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }

  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

/**
 * Returns the descriptive subtitle for the 2D PCA canvas based on active collection.
 * Pure function.
 *
 * @param {string} collection - "demo" | "docs"
 * @returns {string}
 */
export function getExploreCanvasSubtitle(collection) {
  return collection === "docs"
    ? "Each point is a document chunk, projected to 2D using PCA."
    : "Each point is a demo vector, projected to 2D using PCA.";
}

/**
 * Determines whether query actions should be disabled based on vector count.
 * Pure function.
 *
 * @param {number} count
 * @returns {boolean}
 */
export function isExploreActionDisabled(count) {
  return !count || count <= 0;
}

/**
 * Computes axis ticks and labels for 2D coordinate canvas.
 * Pure function.
 *
 * @param {number} minVal
 * @param {number} maxVal
 * @param {number} step
 * @returns {Array<{val: number, label: string}>}
 */
export function computeAxisTicks(minVal = -0.8, maxVal = 0.85, step = 0.2) {
  const ticks = [];
  for (let v = minVal; v <= maxVal; v += step) {
    const rounded = Math.round(v * 100) / 100;
    const label = Math.abs(rounded) < 0.001 ? "0.0" : rounded.toFixed(1);
    ticks.push({ val: rounded, label });
  }
  return ticks;
}

/**
 * Calculates a safe perimeter position for axis tick labels to prevent data collision.
 * Pure function.
 *
 * @param {number} coord - Projected screen coordinate
 * @param {number} edge - Canvas edge boundary
 * @param {number} margin - Safe inset margin
 * @returns {number} Clamped safe coordinate
 */
export function clampTickEdge(coord, edge, margin = 24) {
  return Math.min(Math.max(coord, margin), edge - margin);
}
