/**
 * VectorDB Color Palette & Theme Tokens
 *
 * Single source of truth for all canvas rendering and JavaScript-driven colors.
 * Matches the CSS custom properties defined in web/css/app.css.
 *
 * Strict CSP & zero-innerHTML compliant.
 */

export const THEME = Object.freeze({
  bgCanvas: "#09090b",
  bgSurface: "#121215",
  bgElevated: "#18181c",
  gridLine: "#1c1c22",
  borderSubtle: "#1c1c22",
  textPrimary: "#f0ede6",
  textSecondary: "#c4c1ba",
  textMuted: "#827e77",
  textInverse: "#09090b",
  accent: "#d9a441",
  accentHover: "#e5b14e",
  accentMuted: "#4a3819",
  accentTint: "rgba(217, 164, 65, 0.12)",
  danger: "#ef4444",
  success: "#22c55e",
  white: "#ffffff"
});

export const ALGORITHM_COLORS = Object.freeze({
  brute: "#9c8269",
  kdtree: "#708a78",
  hnsw: "#d9a441"
});

export const DOC_COLOR_PALETTE = Object.freeze([
  "#d9a441",
  "#529b67",
  "#c47043",
  "#9c8269",
  "#a0616a",
  "#849646",
  "#c89f65",
  "#708a78"
]);

export const DOC_FALLBACK_COLOR = "#807c74";

export const LAYER_COLORS = Object.freeze([
  "#6e6a63",
  "#a67c2e",
  "#d9a441",
  "#f0ede6"
]);
