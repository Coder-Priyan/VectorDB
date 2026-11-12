/**
 * VectorDB 2D Explore Pure Logic Helpers
 *
 * Provides hit-testing, deterministic document color assignment,
 * coordinate bounding, and star marker geometry.
 */

// Visually distinct warm/earth palette for document clusters (no blue/indigo/violet)
export const DOC_COLOR_PALETTE = [
  "#d9a441", // Warm amber
  "#529b67", // Muted sage green
  "#c47043", // Terracotta
  "#9c8269", // Warm taupe
  "#a0616a", // Dusty rose
  "#849646", // Olive bronze
  "#c89f65", // Ochre sand
  "#708a78"  // Muted moss
];

/**
 * Deterministically maps an integer document ID to a color palette hex code.
 */
export function getDocColor(docId) {
  if (docId === null || docId === undefined || isNaN(docId)) {
    return "#807c74"; // Warm neutral fallback
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

