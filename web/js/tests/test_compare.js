/**
 * Unit Tests for Multi-Algorithm Compare Tab Pure Helpers
 */

import { describe, assert, assertEqual, assertNear } from "./framework.js";
import { computeTimingStats, diffAgainstGroundTruth, computeBarWidths, resolveChartSize, computeChartLayout } from "../compare_helpers.js";

export function registerCompareTests() {
  describe("Compare Timing Stats (compare_helpers.js)", (it) => {
    it("Empty array returns zeroed stats", () => {
      const stats = computeTimingStats([]);
      assertEqual(stats.count, 0);
      assertEqual(stats.median, 0);
      assertEqual(stats.min, 0);
      assertEqual(stats.max, 0);
    });

    it("Single element array returns identical min, max, and median", () => {
      const stats = computeTimingStats([42.5]);
      assertEqual(stats.count, 1);
      assertEqual(stats.median, 42.5);
      assertEqual(stats.min, 42.5);
      assertEqual(stats.max, 42.5);
    });

    it("Odd count array calculates exact median from unsorted input", () => {
      const stats = computeTimingStats([150, 45, 80, 200, 95]);
      assertEqual(stats.count, 5);
      assertEqual(stats.min, 45);
      assertEqual(stats.max, 200);
      assertEqual(stats.median, 95); // Sorted: [45, 80, 95, 150, 200]
    });

    it("Even count array calculates average of middle elements", () => {
      const stats = computeTimingStats([100, 200, 400, 300]);
      assertEqual(stats.count, 4);
      assertEqual(stats.min, 100);
      assertEqual(stats.max, 400);
      assertEqual(stats.median, 250); // Sorted: [100, 200, 300, 400] -> (200 + 300)/2
    });
  });

  describe("Compare Ground Truth Diff (compare_helpers.js)", (it) => {
    const groundTruth = [
      { id: 10, distance: 0.1 },
      { id: 20, distance: 0.2 },
      { id: 30, distance: 0.3 }
    ];

    it("Identifies exact match with ground truth", () => {
      const candidate = [
        { id: 10, distance: 0.1 },
        { id: 20, distance: 0.2 },
        { id: 30, distance: 0.3 }
      ];
      const diff = diffAgainstGroundTruth(candidate, groundTruth);
      assertEqual(diff.length, 3);
      assert(diff.every(r => r.isMatch), "All items should match ground truth");
      assertEqual(diff[0].rank, 1);
      assertEqual(diff[1].rank, 2);
      assertEqual(diff[2].rank, 3);
    });

    it("Flags candidate IDs missing from ground truth as differences", () => {
      const candidate = [
        { id: 10, distance: 0.1 },
        { id: 99, distance: 0.25 }, // Missing from GT
        { id: 30, distance: 0.3 }
      ];
      const diff = diffAgainstGroundTruth(candidate, groundTruth);
      assertEqual(diff.length, 3);
      assertEqual(diff[0].isMatch, true);
      assertEqual(diff[1].isMatch, false);
      assertEqual(diff[2].isMatch, true);
    });

    it("Handles empty candidate and ground truth gracefully", () => {
      const diff1 = diffAgainstGroundTruth([], groundTruth);
      assertEqual(diff1.length, 0);

      const diff2 = diffAgainstGroundTruth([{ id: 5, distance: 0.5 }], null);
      assertEqual(diff2.length, 1);
      assertEqual(diff2[0].isMatch, false);
    });
  });

  describe("Compare Bar Width Scaling (compare_helpers.js)", (it) => {
    it("Empty input returns empty array", () => {
      const widths = computeBarWidths([]);
      assertEqual(widths.length, 0);
    });

    it("Scales array relative to maximum value up to 100%", () => {
      const values = [50, 100, 25];
      const widths = computeBarWidths(values);
      assertEqual(widths.length, 3);
      assertEqual(widths[0], 50);
      assertEqual(widths[1], 100);
      assertEqual(widths[2], 25);
    });

    it("Honors custom max bound and clamps to 100%", () => {
      const values = [20, 80, 150];
      const widths = computeBarWidths(values, 100);
      assertEqual(widths[0], 20);
      assertEqual(widths[1], 80);
      assertEqual(widths[2], 100); // Clamped at 100
    });

    it("Zero values and degenerate maximum handled without NaN", () => {
      const widths = computeBarWidths([0, 0, 0]);
      assertEqual(widths.length, 3);
      assertEqual(widths[0], 0);
      assertEqual(widths[1], 0);
      assertEqual(widths[2], 0);
    });
  });

  describe("Compare Chart Size Resolution (compare_helpers.js)", (it) => {
    it("DPR 1 returns CSS size", () => {
      const size = resolveChartSize(680, 240, 680, 240, 1);
      assertEqual(size.w, 680);
      assertEqual(size.h, 240);
    });

    it("DPR 1.25 and 2 return CSS size not buffer size", () => {
      const size125 = resolveChartSize(680, 240, 850, 300, 1.25);
      assertEqual(size125.w, 680);
      assertEqual(size125.h, 240);

      const size2 = resolveChartSize(680, 240, 1360, 480, 2);
      assertEqual(size2.w, 680);
      assertEqual(size2.h, 240);
    });

    it("CSS 0 falls back to buffer size divided by dpr", () => {
      const size = resolveChartSize(0, 0, 1000, 500, 2);
      assertEqual(size.w, 500);
      assertEqual(size.h, 250);

      const sizeDpr1 = resolveChartSize(0, 0, 680, 260, 1);
      assertEqual(sizeDpr1.w, 680);
      assertEqual(sizeDpr1.h, 260);
    });

    it("NaN, negative, or invalid input returns 0x0 safely", () => {
      const sizeNaN = resolveChartSize(NaN, -50, undefined, null, 1);
      assertEqual(sizeNaN.w, 0);
      assertEqual(sizeNaN.h, 0);

      const sizeNegative = resolveChartSize(-10, -20, -100, -200, 1.5);
      assertEqual(sizeNegative.w, 0);
      assertEqual(sizeNegative.h, 0);
    });
  });

  describe("Compare Chart Layout Computation (compare_helpers.js)", (it) => {
    it("Three panels have equal width and do not overlap", () => {
      const layout = computeChartLayout(900, 140);
      assertEqual(layout.panels.length, 3);
      assertEqual(layout.panels[0].w, layout.panels[1].w);
      assertEqual(layout.panels[1].w, layout.panels[2].w);
      assert(layout.panels[0].w > 0, "Panels must have positive width");
      // Verify no overlap between panels
      assert(layout.panels[0].x + layout.panels[0].w <= layout.panels[1].x, "Panel 0 and 1 must not overlap");
      assert(layout.panels[1].x + layout.panels[1].w <= layout.panels[2].x, "Panel 1 and 2 must not overlap");
      // Gutter does not overlap first panel
      assert(layout.gutter.x + layout.gutter.w <= layout.panels[0].x, "Gutter and Panel 0 must not overlap");
    });

    it("All rects stay inside w x h bounding box", () => {
      const w = 800;
      const h = 140;
      const layout = computeChartLayout(w, h);
      // Gutter inside w x h
      assert(layout.gutter.x >= 0 && layout.gutter.x + layout.gutter.w <= w, "Gutter within width");
      assert(layout.gutter.y >= 0 && layout.gutter.y + layout.gutter.h <= h, "Gutter within height");
      // Panels inside w x h
      for (let i = 0; i < layout.panels.length; i++) {
        const p = layout.panels[i];
        assert(p.x >= 0 && p.x + p.w <= w, `Panel ${i} within width`);
        assert(p.y >= 0 && p.y + p.h <= h, `Panel ${i} within height`);
      }
      // Rows inside h
      for (let i = 0; i < layout.rows.length; i++) {
        const r = layout.rows[i];
        assert(r.y >= 0 && r.y + r.height <= h, `Row ${i} within height`);
      }
    });

    it("Very small w/h gives no negative sizes", () => {
      const cases = [
        computeChartLayout(0, 0),
        computeChartLayout(-50, 100),
        computeChartLayout(100, -20),
        computeChartLayout(20, 15)
      ];
      for (const layout of cases) {
        assert(layout.gutter.w >= 0 && layout.gutter.h >= 0 && layout.gutter.x >= 0 && layout.gutter.y >= 0, "Gutter coords non-negative");
        for (const p of layout.panels) {
          assert(p.w >= 0 && p.h >= 0 && p.x >= 0 && p.y >= 0, "Panel coords non-negative");
        }
        assert(layout.rowHeight >= 0, "rowHeight non-negative");
        for (const r of layout.rows) {
          assert(r.y >= 0 && r.height >= 0, "Row coords non-negative");
        }
      }
    });

    it("Row order and count are exactly 3 with non-decreasing y positions", () => {
      const layout = computeChartLayout(900, 140);
      assertEqual(layout.rows.length, 3);
      assertEqual(layout.rowY.length, 3);
      assert(layout.rowHeight > 0, "rowHeight must be positive for standard height");
      assertEqual(layout.rows[0].y, layout.rowY[0]);
      assertEqual(layout.rows[1].y, layout.rowY[1]);
      assertEqual(layout.rows[2].y, layout.rowY[2]);
      assert(layout.rowY[0] < layout.rowY[1], "Row 0 before Row 1");
      assert(layout.rowY[1] < layout.rowY[2], "Row 1 before Row 2");
      assertEqual(layout.rows[0].height, layout.rowHeight);
      assertEqual(layout.rows[1].height, layout.rowHeight);
      assertEqual(layout.rows[2].height, layout.rowHeight);
    });
  });
}

