/**
 * Color Palette & Theme Tokens Unit Tests
 */
import { describe, assert, assertEqual } from "./framework.js";
import { THEME, ALGORITHM_COLORS, DOC_COLOR_PALETTE, DOC_FALLBACK_COLOR, LAYER_COLORS } from "../colors.js";

export function registerColorsTests() {
  describe("Colors & Theme Tokens (colors.js)", (it) => {
    it("THEME exports required Quiet Studio surface, text, and accent tokens", () => {
      assert(typeof THEME.bgCanvas === "string" && THEME.bgCanvas.startsWith("#"), "bgCanvas must be hex color");
      assert(typeof THEME.bgSurface === "string" && THEME.bgSurface.startsWith("#"), "bgSurface must be hex color");
      assert(typeof THEME.bgElevated === "string" && THEME.bgElevated.startsWith("#"), "bgElevated must be hex color");
      assertEqual(THEME.accent, "#d9a441");
      assertEqual(THEME.textPrimary, "#f0ede6");
      assertEqual(THEME.textMuted, "#827e77");
      assertEqual(THEME.borderSubtle, "#1c1c22");
    });

    it("ALGORITHM_COLORS defines distinct colors for brute, kdtree, and hnsw", () => {
      assertEqual(ALGORITHM_COLORS.brute, "#9c8269");
      assertEqual(ALGORITHM_COLORS.kdtree, "#708a78");
      assertEqual(ALGORITHM_COLORS.hnsw, "#d9a441");
      assert(ALGORITHM_COLORS.brute !== ALGORITHM_COLORS.kdtree, "brute and kdtree colors must differ");
      assert(ALGORITHM_COLORS.kdtree !== ALGORITHM_COLORS.hnsw, "kdtree and hnsw colors must differ");
    });

    it("DOC_COLOR_PALETTE contains at least 8 distinct valid hex color codes", () => {
      assert(Array.isArray(DOC_COLOR_PALETTE), "DOC_COLOR_PALETTE must be an array");
      assert(DOC_COLOR_PALETTE.length >= 8, "DOC_COLOR_PALETTE must have at least 8 colors");
      const hexPattern = /^#[0-9a-fA-F]{6}$/;
      DOC_COLOR_PALETTE.forEach((color, idx) => {
        assert(hexPattern.test(color), `Color at index ${idx} (${color}) must be valid 6-char hex`);
      });
      assert(hexPattern.test(DOC_FALLBACK_COLOR), "DOC_FALLBACK_COLOR must be valid hex");
    });

    it("LAYER_COLORS defines multi-layer graph colors matching depth progression", () => {
      assert(Array.isArray(LAYER_COLORS), "LAYER_COLORS must be an array");
      assert(LAYER_COLORS.length >= 4, "LAYER_COLORS must have at least 4 layers");
      assertEqual(LAYER_COLORS[0], "#6e6a63");
      assertEqual(LAYER_COLORS[2], "#d9a441");
      assertEqual(LAYER_COLORS[3], "#f0ede6");
    });
  });
}

