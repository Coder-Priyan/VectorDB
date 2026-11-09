/**
 * VectorDB 2D Viewport & Canvas Transforms
 *
 * Implements high-precision 2D affine transformations, zoom/pan bounds,
 * and devicePixelRatio handling for 2D vector projections.
 */

export class Viewport2D {
  constructor(width = 800, height = 600, padding = 40) {
    this.width = width;
    this.height = height;
    this.padding = padding;

    this.minX = -1;
    this.maxX = 1;
    this.minY = -1;
    this.maxY = 1;

    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  /**
   * Resets viewport view bounds to enclose data points with margin.
   */
  fitBounds(minX, maxX, minY, maxY) {
    // Avoid degenerate single-point bounds
    if (minX === maxX) {
      minX -= 1;
      maxX += 1;
    }
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;

    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  /**
   * Transforms data-space coordinates (x, y) to canvas pixel coordinates.
   */
  toScreen(dataX, dataY) {
    const usableW = Math.max(10, this.width - 2 * this.padding);
    const usableH = Math.max(10, this.height - 2 * this.padding);

    const normX = (dataX - this.minX) / (this.maxX - this.minX || 1);
    // Invert Y axis: larger data Y maps to smaller screen Y (canvas top)
    const normY = (this.maxY - dataY) / (this.maxY - this.minY || 1);

    const baseScreenX = this.padding + normX * usableW;
    const baseScreenY = this.padding + normY * usableH;

    // Apply zoom centered at canvas midpoint + pan offset
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    const screenX = centerX + (baseScreenX - centerX) * this.zoom + this.panX;
    const screenY = centerY + (baseScreenY - centerY) * this.zoom + this.panY;

    return { x: screenX, y: screenY };
  }

  /**
   * Transforms canvas pixel coordinates to data-space coordinates (x, y).
   * Exact algebraic inverse of toScreen().
   */
  toData(screenX, screenY) {
    const usableW = Math.max(10, this.width - 2 * this.padding);
    const usableH = Math.max(10, this.height - 2 * this.padding);

    const centerX = this.width / 2;
    const centerY = this.height / 2;

    const baseScreenX = (screenX - this.panX - centerX) / this.zoom + centerX;
    const baseScreenY = (screenY - this.panY - centerY) / this.zoom + centerY;

    const normX = (baseScreenX - this.padding) / usableW;
    const normY = (baseScreenY - this.padding) / usableH;

    const dataX = this.minX + normX * (this.maxX - this.minX);
    const dataY = this.maxY - normY * (this.maxY - this.minY);

    return { x: dataX, y: dataY };
  }

  /**
   * Zooms in or out centered at a specific canvas screen point.
   */
  zoomAt(screenX, screenY, factor) {
    const prevZoom = this.zoom;
    const newZoom = Math.min(Math.max(0.1, prevZoom * factor), 50.0);
    const scale = newZoom / prevZoom;

    // Adjust pan so screen (screenX, screenY) remains stationary in data space
    this.panX = screenX - (screenX - this.panX) * scale;
    this.panY = screenY - (screenY - this.panY) * scale;
    this.zoom = newZoom;
  }

  /**
   * Translates viewport by pixel delta.
   */
  pan(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }

  /**
   * Resets zoom and pan offsets back to origin.
   */
  resetView() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }
}

/**
 * Configures an HTML5 Canvas for high-DPI (Retina) rendering.
 */
export function setupCanvasDpr(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  const displayWidth = Math.floor(rect.width) || canvas.width;
  const displayHeight = Math.floor(rect.height) || canvas.height;

  canvas.width = Math.floor(displayWidth * dpr);
  canvas.height = Math.floor(displayHeight * dpr);

  ctx.resetTransform?.();
  ctx.scale(dpr, dpr);

  return { dpr, width: displayWidth, height: displayHeight };
}

