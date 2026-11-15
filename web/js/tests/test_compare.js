/**
 * Unit Tests for Multi-Algorithm Compare Tab Pure Helpers
 */

import { describe, assert, assertEqual, assertNear } from "./framework.js";
import {
  computeTimingStats,
  diffAgainstGroundTruth,
  computeBarWidths,
  resolveChartSize,
  computeChartLayout,
  buildDiffRows,
  extractChartMetrics,
  drawMetricBarChart,
  getCompareEmptyStateConfig,
  niceAxis,
  getMetricAxisConfig,
  mapChartRows,
  computeBarScale,
  computeRecallSquares,
  computeLatencyScale,
  formatRangeText,
  buildRankStrip,
  formatRecallPercent,
  mapReportToCards
} from "../compare_helpers.js";

// Real raw benchmark response fixture captured from running server with 10 top-k items (ADR-036, docs/API.md sec 9)
const realBenchmarkFixture = {
  algorithms: {
    brute: {
      distance_computations: 1000,
      latency_us: 120,
      recall_at_k: 1.0,
      results: [
        { id: 101, distance: 0.05 },
        { id: 102, distance: 0.12 },
        { id: 103, distance: 0.18 },
        { id: 104, distance: 0.25 },
        { id: 105, distance: 0.31 },
        { id: 106, distance: 0.42 },
        { id: 107, distance: 0.50 },
        { id: 108, distance: 0.61 },
        { id: 109, distance: 0.73 },
        { id: 110, distance: 0.85 }
      ]
    },
    kdtree: {
      distance_computations: 240,
      latency_us: 85,
      recall_at_k: 1.0,
      results: [
        { id: 101, distance: 0.05 },
        { id: 102, distance: 0.12 },
        { id: 103, distance: 0.18 },
        { id: 104, distance: 0.25 },
        { id: 105, distance: 0.31 },
        { id: 106, distance: 0.42 },
        { id: 107, distance: 0.50 },
        { id: 108, distance: 0.61 },
        { id: 109, distance: 0.73 },
        { id: 110, distance: 0.85 }
      ]
    },
    hnsw: {
      distance_computations: 64,
      latency_us: 32,
      recall_at_k: 0.9,
      results: [
        { id: 101, distance: 0.05 },
        { id: 102, distance: 0.12 },
        { id: 103, distance: 0.18 },
        { id: 104, distance: 0.25 },
        { id: 105, distance: 0.31 },
        { id: 106, distance: 0.42 },
        { id: 107, distance: 0.50 },
        { id: 108, distance: 0.61 },
        { id: 109, distance: 0.73 },
        { id: 999, distance: 0.91 } // Mismatch at rank 10
      ]
    }
  },
  count: 1000,
  ground_truth: "brute",
  k: 10
};

// Real shape benchmark fixture containing deliberate rank mismatches (ADR-036)
const mismatchFixture = {
  algorithms: {
    brute: {
      results: [
        { id: 10, distance: 0.15 },
        { id: 20, distance: 0.25 },
        { id: 30, distance: 0.35 }
      ],
      distance_computations: 100,
      latency_us: 50,
      recall_at_k: 1.0
    },
    kdtree: {
      results: [
        { id: 10, distance: 0.15 },
        { id: 99, distance: 0.29 }, // mismatch at rank 2
        { id: 30, distance: 0.35 }
      ],
      distance_computations: 45,
      latency_us: 30,
      recall_at_k: 0.67
    },
    hnsw: {
      results: [
        { id: 10, distance: 0.15 },
        { id: 20, distance: 0.25 },
        { id: 88, distance: 0.40 } // mismatch at rank 3
      ],
      distance_computations: 15,
      latency_us: 12,
      recall_at_k: 0.67
    }
  },
  count: 100,
  ground_truth: "brute",
  k: 3
};

// Real shape benchmark fixture containing missing candidates (ADR-036)
const missingFixture = {
  algorithms: {
    brute: {
      results: [
        { id: 1, distance: 0.1 },
        { id: 2, distance: 0.2 },
        { id: 3, distance: 0.3 }
      ],
      distance_computations: 125,
      latency_us: 40,
      recall_at_k: 1.0
    },
    kdtree: {
      results: [
        { id: 1, distance: 0.1 }
        // Missing rank 2 and 3
      ],
      distance_computations: 50,
      latency_us: 20,
      recall_at_k: 0.33
    },
    hnsw: {
      results: [
        { id: 1, distance: 0.1 },
        { id: 2, distance: 0.2 }
        // Missing rank 3
      ],
      distance_computations: 20,
      latency_us: 10,
      recall_at_k: 0.67
    }
  },
  count: 50,
  ground_truth: "brute",
  k: 3
};

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

    it("Heights from 140px to 170px ensure all 3 algorithm rows fit within canvas without clipping", () => {
      for (const h of [140, 146, 160, 170]) {
        const layout = computeChartLayout(700, h);
        assertEqual(layout.rows.length, 3);
        assert(layout.rowHeight >= 30, `rowHeight (${layout.rowHeight}) must be at least 30px at h=${h}`);
        const lastRowBottom = layout.rows[2].y + layout.rows[2].height;
        assert(lastRowBottom <= h, `Last row bottom (${lastRowBottom}) must not exceed canvas height (${h})`);
      }
    });
  });

  describe("Compare Diff Rows & Chart Metrics (ADR-036, T-050)", (it) => {
    it("buildDiffRows produces exactly 10 rows with accurate rank and match flags", () => {
      const rows = buildDiffRows(realBenchmarkFixture, 10);
      assertEqual(rows.length, 10);

      // Verify ranks 1..10
      for (let i = 0; i < 10; i++) {
        assertEqual(rows[i].rank, i + 1);
        assert(rows[i].brute !== null, "Brute force item present");
        assertEqual(rows[i].brute.id, 101 + i);
        assertEqual(rows[i].kdtree.isMatch, true);
      }

      // Check ranks 1-9 for HNSW are matches
      for (let i = 0; i < 9; i++) {
        assertEqual(rows[i].hnsw.isMatch, true);
      }
      // Check rank 10 for HNSW is flagged as mismatch
      assertEqual(rows[9].hnsw.isMatch, false);
      assertEqual(rows[9].hnsw.id, 999);
    });

    it("buildDiffRows handles missing algorithms or null report safely", () => {
      assertEqual(buildDiffRows(null).length, 0);
      assertEqual(buildDiffRows({}).length, 0);
      assertEqual(buildDiffRows({ algorithms: {} }).length, 0);
      const partial = buildDiffRows({
        algorithms: {
          brute: { results: [{ id: 1, distance: 0.1 }] }
        }
      }, 5);
      assertEqual(partial.length, 1);
      assertEqual(partial[0].rank, 1);
      assertEqual(partial[0].brute.id, 1);
      assertEqual(partial[0].kdtree, null);
      assertEqual(partial[0].hnsw, null);
    });

    it("extractChartMetrics normalizes latency, distance computations, and recall across algorithms", () => {
      const metrics = extractChartMetrics(realBenchmarkFixture, {
        brute: [110, 120, 130],
        kdtree: [80, 85, 90],
        hnsw: [30, 32, 35]
      });

      assertEqual(metrics.latency.brute, 120);
      assertEqual(metrics.latency.kdtree, 85);
      assertEqual(metrics.latency.hnsw, 32);

      assertEqual(metrics.dist.brute, 1000);
      assertEqual(metrics.dist.kdtree, 240);
      assertEqual(metrics.dist.hnsw, 64);

      assertEqual(metrics.recall.brute, 1.0);
      assertEqual(metrics.recall.kdtree, 1.0);
      assertNear(metrics.recall.hnsw, 0.9, 0.001);
    });

    it("extractChartMetrics falls back to report latency_us when latency sample list is absent", () => {
      const metrics = extractChartMetrics(realBenchmarkFixture);
      assertEqual(metrics.latency.brute, 120);
      assertEqual(metrics.latency.kdtree, 85);
      assertEqual(metrics.latency.hnsw, 32);
      assertEqual(metrics.dist.brute, 1000);
      assertNear(metrics.recall.hnsw, 0.9, 0.001);
    });

    it("drawMetricBarChart clears canvas transparently without dark background box", () => {
      let cleared = false;
      let filledDarkBg = false;
      const mockCanvas = {
        clientWidth: 350,
        clientHeight: 90,
        width: 350,
        height: 90,
        getContext: () => ({
          clearRect: (x, y, w, h) => {
            if (x === 0 && y === 0 && w === 350 && h === 90) {
              cleared = true;
            }
          },
          fillRect: (x, y, w, h) => {
            if (x === 0 && y === 0 && w === 350 && h === 90) {
              filledDarkBg = true;
            }
          },
          measureText: () => ({ width: 30 }),
          fillText: () => {}
        })
      };
      drawMetricBarChart(mockCanvas, "latency", { brute: 100, kdtree: 50, hnsw: 20 });
      assertEqual(cleared, true);
      assertEqual(filledDarkBg, false);
    });
  });

  describe("Compare Empty State Presentation Config (T-053, ADR-036)", (it) => {
    it("Empty demo collection prompts inserting vectors or using docs chunks", () => {
      const cfg = getCompareEmptyStateConfig("demo", 0, false);
      assertEqual(cfg.showEmpty, true);
      assertEqual(cfg.title, "Collection is empty");
      assert(cfg.description.includes("Insert vectors in Settings"), "Description must guide to Settings");
      assertEqual(cfg.canRun, false);
      assertEqual(cfg.buttonText, "Benchmark Demo Vectors");
    });

    it("Empty docs collection prompts ingesting documents in Ask tab", () => {
      const cfg = getCompareEmptyStateConfig("docs", 0, false);
      assertEqual(cfg.showEmpty, true);
      assertEqual(cfg.title, "No documents yet");
      assert(cfg.description.includes("Add documents in the Ask tab"), "Description must guide to Ask tab");
      assertEqual(cfg.canRun, false);
      assertEqual(cfg.buttonText, "Benchmark Document Chunks");
    });

    it("Populated unbenchmarked demo collection presents ready state", () => {
      const cfg = getCompareEmptyStateConfig("demo", 100, false);
      assertEqual(cfg.showEmpty, true);
      assertEqual(cfg.title, "No benchmark yet");
      assert(cfg.description.includes("Run a benchmark to see latency"), "Description explains benchmark metrics");
      assertEqual(cfg.canRun, true);
      assertEqual(cfg.buttonText, "Benchmark Demo Vectors");
    });

    it("Populated unbenchmarked docs collection presents ready state", () => {
      const cfg = getCompareEmptyStateConfig("docs", 42, false);
      assertEqual(cfg.showEmpty, true);
      assertEqual(cfg.title, "No benchmark yet");
      assertEqual(cfg.canRun, true);
      assertEqual(cfg.buttonText, "Benchmark Document Chunks");
    });

    it("Populated collection with existing results hides empty view", () => {
      const cfg = getCompareEmptyStateConfig("demo", 100, true);
      assertEqual(cfg.showEmpty, false);
      assertEqual(cfg.canRun, true);
    });

    it("Empty collection with hasResults=true still enforces empty state to prevent stale data display", () => {
      const cfg = getCompareEmptyStateConfig("demo", 0, true);
      assertEqual(cfg.showEmpty, true);
      assertEqual(cfg.title, "Collection is empty");
      assertEqual(cfg.canRun, false);
    });
  });

  describe("Compare New Chart Axis & Row Mapping (T-054, ADR-045)", (it) => {
    it("niceAxis scales max 43 to 0..50 with step 10", () => {
      const axis = niceAxis(43);
      assertEqual(axis.max, 50);
      assertEqual(axis.step, 10);
      assertEqual(axis.ticks.length, 6);
      assertEqual(axis.ticks[0], 0);
      assertEqual(axis.ticks[axis.ticks.length - 1], 50);
    });

    it("niceAxis scales max 112 to 0..120 with step 20", () => {
      const axis = niceAxis(112);
      assertEqual(axis.max, 120);
      assertEqual(axis.step, 20);
      assertEqual(axis.ticks.length, 7);
      assertEqual(axis.ticks[0], 0);
      assertEqual(axis.ticks[axis.ticks.length - 1], 120);
    });

    it("niceAxis handles 0 or tiny non-positive values without divide by zero", () => {
      const zeroAxis = niceAxis(0);
      assertEqual(zeroAxis.max, 10);
      assertEqual(zeroAxis.step, 2);
      assertEqual(zeroAxis.ticks[0], 0);

      const tinyAxis = niceAxis(0.001);
      assert(tinyAxis.max > 0, "Max must be positive");
      assert(tinyAxis.step > 0, "Step must be positive");
      assertEqual(tinyAxis.ticks[0], 0);
    });

    it("getMetricAxisConfig configures fixed 0..1 scale for Recall@k", () => {
      const axis = getMetricAxisConfig("recall", 1.0);
      assertEqual(axis.max, 1.0);
      assertEqual(axis.step, 0.2);
      assertEqual(axis.ticks.length, 6);
      assertEqual(axis.formatTick(0), "0%");
      assertEqual(axis.formatTick(0.6), "60%");
      assertEqual(axis.formatTick(1.0), "100%");
    });

    it("niceAxis handles three identical non-zero values gracefully", () => {
      const axis = niceAxis(60);
      assertEqual(axis.max, 60);
      assertEqual(axis.step, 10);
      assertEqual(axis.ticks[0], 0);
      assertEqual(axis.ticks[axis.ticks.length - 1], 60);
    });

    it("mapChartRows maps latency from real server response fixture with labels and formatted units", () => {
      const rows = mapChartRows("latency", realBenchmarkFixture);
      assertEqual(rows.length, 3);
      assertEqual(rows[0].algorithm, "brute");
      assertEqual(rows[0].label, "Brute Force");
      assertEqual(rows[0].value, 120);
      assertEqual(rows[0].formattedValue, "120 μs");

      assertEqual(rows[1].algorithm, "kdtree");
      assertEqual(rows[1].label, "KD-Tree");
      assertEqual(rows[1].value, 85);
      assertEqual(rows[1].formattedValue, "85 μs");

      assertEqual(rows[2].algorithm, "hnsw");
      assertEqual(rows[2].label, "HNSW");
      assertEqual(rows[2].value, 32);
      assertEqual(rows[2].formattedValue, "32 μs");
    });

    it("mapChartRows maps distance computations and recall from real fixture", () => {
      const distRows = mapChartRows("dist", realBenchmarkFixture);
      assertEqual(distRows[0].value, 1000);
      assertEqual(distRows[0].formattedValue, "1000");
      assertEqual(distRows[1].value, 240);
      assertEqual(distRows[2].value, 64);

      const recallRows = mapChartRows("recall", realBenchmarkFixture);
      assertEqual(recallRows[0].value, 1.0);
      assertEqual(recallRows[0].formattedValue, "100.0%");
      assertNear(recallRows[2].value, 0.9, 0.001);
      assertEqual(recallRows[2].formattedValue, "90.0%");
    });

    it("drawMetricBarChart renders axis and labels on full canvas context without errors", () => {
      const drawnElements = [];
      const mockCanvas = {
        clientWidth: 350,
        clientHeight: 120,
        width: 350,
        height: 120,
        getContext: () => ({
          clearRect: () => drawnElements.push("clear"),
          fillText: (text) => drawnElements.push(`text:${text}`),
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          stroke: () => drawnElements.push("stroke"),
          fill: () => drawnElements.push("fill"),
          measureText: (txt) => ({ width: (txt || "").length * 7 })
        })
      };
      drawMetricBarChart(mockCanvas, "latency", { brute: 50, kdtree: 30, hnsw: 10 });
      assert(drawnElements.includes("clear"), "Canvas must be cleared");
      assert(drawnElements.some(e => e.includes("Brute Force")), "Brute Force label rendered");
      assert(drawnElements.some(e => e.includes("Latency (μs)")), "Axis title rendered");
    });

    it("extractChartMetrics and mapChartRows handle latencies = null gracefully and fall back to latency_us", () => {
      const metrics = extractChartMetrics(realBenchmarkFixture, null);
      assertEqual(metrics.latency.brute, 120);
      assertEqual(metrics.latency.kdtree, 85);
      assertEqual(metrics.latency.hnsw, 32);

      const rows = mapChartRows("latency", realBenchmarkFixture, null);
      assertEqual(rows.length, 3);
      assertEqual(rows[0].value, 120);
      assertEqual(rows[0].formattedValue, "120 μs");
      assertEqual(rows[1].value, 85);
      assertEqual(rows[1].formattedValue, "85 μs");
      assertEqual(rows[2].value, 32);
      assertEqual(rows[2].formattedValue, "32 μs");
    });
  });

  describe("Compare Soft Lanes & Collapsed Rank Diff Helpers (ADR-057)", (it) => {
    it("computeBarScale produces shared linear scale and handles array or object inputs", () => {
      // Array input
      const scaleArr = computeBarScale([1000, 240, 64]);
      assertEqual(scaleArr.max, 1000);
      assertEqual(scaleArr.getBarWidthPercent(1000), 100);
      assertEqual(scaleArr.getBarWidthPercent(240), 24);
      assertEqual(scaleArr.getBarWidthPercent(64), 6);
      assertEqual(scaleArr.getBarWidthPercent(0), 0);
      assertEqual(scaleArr.getBarWidthPercent(-5), 0);
      assertEqual(scaleArr.getBarWidthPercent(2000), 100); // clamped to 100

      // Object input
      const scaleObj = computeBarScale({ a: 50, b: 100, c: 25 });
      assertEqual(scaleObj.max, 100);
      assertEqual(scaleObj.getBarWidthPercent(50), 50);
      assertEqual(scaleObj.getBarWidthPercent(100), 100);

      // Edge cases: empty or all zeros
      const scaleEmpty = computeBarScale([]);
      assertEqual(scaleEmpty.max, 0);
      assertEqual(scaleEmpty.getBarWidthPercent(10), 0);

      const scaleZeros = computeBarScale([0, 0, 0]);
      assertEqual(scaleZeros.max, 0);
      assertEqual(scaleZeros.getBarWidthPercent(0), 0);
    });

    it("computeRecallSquares calculates filled and unfilled squares across different k values", () => {
      // Requirements test cases: k=10, k=3, k=20, recall 1.0, 0.9, 0.8
      const sq10_full = computeRecallSquares(1.0, 10);
      assertEqual(sq10_full.k, 10);
      assertEqual(sq10_full.filled, 10);
      assertEqual(sq10_full.unfilled, 0);

      const sq10_nine = computeRecallSquares(0.9, 10);
      assertEqual(sq10_nine.k, 10);
      assertEqual(sq10_nine.filled, 9);
      assertEqual(sq10_nine.unfilled, 1);

      const sq10_part = computeRecallSquares(0.8, 10);
      assertEqual(sq10_part.k, 10);
      assertEqual(sq10_part.filled, 8);
      assertEqual(sq10_part.unfilled, 2);

      const sq3_full = computeRecallSquares(1.0, 3);
      assertEqual(sq3_full.k, 3);
      assertEqual(sq3_full.filled, 3);
      assertEqual(sq3_full.unfilled, 0);

      const sq3_part = computeRecallSquares(0.8, 3);
      assertEqual(sq3_part.k, 3);
      assertEqual(sq3_part.filled, 2); // round(0.8 * 3) = round(2.4) = 2
      assertEqual(sq3_part.unfilled, 1);

      const sq20_part = computeRecallSquares(0.8, 20);
      assertEqual(sq20_part.k, 20);
      assertEqual(sq20_part.filled, 16); // round(0.8 * 20) = 16
      assertEqual(sq20_part.unfilled, 4);
    });

    it("computeLatencyScale produces shared linear scale and bounded bar widths", () => {
      const scale = computeLatencyScale([120, 85, 32]);
      assert(scale.max > 120, "Scale max must exceed highest median");
      const w120 = scale.getBarWidthPercent(120);
      const w85 = scale.getBarWidthPercent(85);
      const w32 = scale.getBarWidthPercent(32);

      assert(w120 > w85, "Higher median must have wider bar");
      assert(w85 > w32, "Middle median must be wider than lower median");
      assert(w120 <= 100, "Bar width must not exceed 100%");
      assert(w32 >= 2, "Bar width must be at least minimum visibility clamp");
    });

    it("formatRangeText formats min-max strictly in microseconds without extra units", () => {
      assertEqual(formatRangeText(18.2, 25.7), "18 - 26 µs");
      assertEqual(formatRangeText(0, 100), "0 - 100 µs");
      assertEqual(formatRangeText(42, 42), "42 - 42 µs");
    });

    it("buildRankStrip identifies full match for kdtree and rank 10 mismatch for hnsw from realBenchmarkFixture", () => {
      const bruteRes = realBenchmarkFixture.algorithms.brute.results;
      const kdRes = realBenchmarkFixture.algorithms.kdtree.results;
      const hnswRes = realBenchmarkFixture.algorithms.hnsw.results;

      const kdStrip = buildRankStrip(bruteRes, kdRes, 10);
      assertEqual(kdStrip.length, 10);
      assertEqual(kdStrip.sameCount, 10);
      assert(kdStrip.every(c => c.isMatch === true));

      const hnswStrip = buildRankStrip(bruteRes, hnswRes, 10);
      assertEqual(hnswStrip.length, 10);
      assertEqual(hnswStrip.sameCount, 9);
      assert(hnswStrip.slice(0, 9).every(c => c.isMatch === true));
      assertEqual(hnswStrip[9].isMatch, false);
      assertEqual(hnswStrip[9].rank, 10);
      assertEqual(hnswStrip[9].expectedId, 110);
      assertEqual(hnswStrip[9].gotId, 999);
    });

    it("buildRankStrip correctly identifies rank mismatches using mismatchFixture", () => {
      const bruteRes = mismatchFixture.algorithms.brute.results;
      const kdRes = mismatchFixture.algorithms.kdtree.results;
      const hnswRes = mismatchFixture.algorithms.hnsw.results;

      const kdStrip = buildRankStrip(bruteRes, kdRes, 3);
      assertEqual(kdStrip.length, 3);
      assertEqual(kdStrip.sameCount, 2);
      assertEqual(kdStrip[0].isMatch, true);
      assertEqual(kdStrip[1].isMatch, false);
      assertEqual(kdStrip[1].rank, 2);
      assertEqual(kdStrip[1].expectedId, 20);
      assertEqual(kdStrip[1].gotId, 99);
      assertEqual(kdStrip[2].isMatch, true);

      const hnswStrip = buildRankStrip(bruteRes, hnswRes, 3);
      assertEqual(hnswStrip.length, 3);
      assertEqual(hnswStrip.sameCount, 2);
      assertEqual(hnswStrip[0].isMatch, true);
      assertEqual(hnswStrip[1].isMatch, true);
      assertEqual(hnswStrip[2].isMatch, false);
      assertEqual(hnswStrip[2].rank, 3);
      assertEqual(hnswStrip[2].expectedId, 30);
      assertEqual(hnswStrip[2].gotId, 88);
    });

    it("buildRankStrip handles missing candidate results and array bounds using missingFixture", () => {
      const bruteRes = missingFixture.algorithms.brute.results;
      const kdRes = missingFixture.algorithms.kdtree.results;
      const hnswRes = missingFixture.algorithms.hnsw.results;

      const kdStrip = buildRankStrip(bruteRes, kdRes, 3);
      assertEqual(kdStrip.length, 3);
      assertEqual(kdStrip.sameCount, 1);
      assertEqual(kdStrip[0].isMatch, true);
      assertEqual(kdStrip[1].isMatch, false);
      assertEqual(kdStrip[1].gotId, null);
      assertEqual(kdStrip[1].expectedId, 2);
      assertEqual(kdStrip[2].isMatch, false);
      assertEqual(kdStrip[2].gotId, null);
      assertEqual(kdStrip[2].expectedId, 3);

      const hnswStrip = buildRankStrip(bruteRes, hnswRes, 3);
      assertEqual(hnswStrip.length, 3);
      assertEqual(hnswStrip.sameCount, 2);
      assertEqual(hnswStrip[2].isMatch, false);
      assertEqual(hnswStrip[2].gotId, null);
      assertEqual(hnswStrip[2].expectedId, 3);
    });

    it("buildRankStrip supports k=1, k=20, slicing, Docs shape, and null inputs", () => {
      // k=1
      const strip1 = buildRankStrip([{ id: 42 }], [{ id: 42 }], 1);
      assertEqual(strip1.length, 1);
      assertEqual(strip1.sameCount, 1);
      assertEqual(strip1[0].isMatch, true);

      // k=20
      const gt20 = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
      const cand20 = Array.from({ length: 20 }, (_, i) => ({ id: i === 19 ? 999 : i + 1 }));
      const strip20 = buildRankStrip(gt20, cand20, 20);
      assertEqual(strip20.length, 20);
      assertEqual(strip20.sameCount, 19);
      assertEqual(strip20[19].isMatch, false);
      assertEqual(strip20[19].gotId, 999);

      // Docs report shape with string chunk IDs
      const docsGt = [{ id: "chunk_1" }, { id: "chunk_2" }, { id: "chunk_3" }];
      const docsCand = [{ id: "chunk_1" }, { id: "chunk_diff" }, { id: "chunk_3" }];
      const docsStrip = buildRankStrip(docsGt, docsCand, 3);
      assertEqual(docsStrip.sameCount, 2);
      assertEqual(docsStrip[1].isMatch, false);
      assertEqual(docsStrip[1].expectedId, "chunk_2");
      assertEqual(docsStrip[1].gotId, "chunk_diff");

      // Candidate longer than k (slices to k)
      const candLong = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const stripSliced = buildRankStrip([{ id: 1 }, { id: 2 }], candLong, 2);
      assertEqual(stripSliced.length, 2);
      assertEqual(stripSliced.sameCount, 2);

      // Null / undefined safe fallbacks
      const stripNull = buildRankStrip(null, null, 5);
      assertEqual(stripNull.length, 5);
      assertEqual(stripNull.sameCount, 0);
      assertEqual(stripNull[0].expectedId, null);
      assertEqual(stripNull[0].gotId, null);
    });

    it("formatRecallPercent formats recall correctly with clamping and one decimal", () => {
      assertEqual(formatRecallPercent(1.0), "100.0%");
      assertEqual(formatRecallPercent(0.9), "90.0%");
      assertEqual(formatRecallPercent(0.6666), "66.7%");
      assertEqual(formatRecallPercent(0.0), "0.0%");
      assertEqual(formatRecallPercent(0), "0.0%");
      assertEqual(formatRecallPercent(-0.5), "0.0%");
      assertEqual(formatRecallPercent(1.5), "100.0%");
      assertEqual(formatRecallPercent(null), "0.0%");
      assertEqual(formatRecallPercent(undefined), "0.0%");
      assertEqual(formatRecallPercent(NaN), "0.0%");
    });

    it("computeBarScale scales 3 latency medians where max lane gets 100% width", () => {
      const scale = computeBarScale([120, 85, 32]);
      assertEqual(scale.max, 120);
      assertEqual(scale.getBarWidthPercent(120), 100);
      assertEqual(scale.getBarWidthPercent(85), 71);
      assertEqual(scale.getBarWidthPercent(32), 27);

      // When all are 0
      const zeroScale = computeBarScale([0, 0, 0]);
      assertEqual(zeroScale.getBarWidthPercent(0), 0);
    });

    it("mapReportToCards maps real benchmark fixture to 3 algorithm cards with correct structure", () => {
      const cards = mapReportToCards(realBenchmarkFixture, {
        brute: [120],
        kdtree: [85],
        hnsw: [42]
      });

      assertEqual(cards.length, 3);

      // 1. Brute Force
      const brute = cards[0];
      assertEqual(brute.alg, "brute");
      assertEqual(brute.label, "Brute Force");
      assertEqual(brute.isBrute, true);
      assertEqual(brute.medianUs, 120);
      assertEqual(brute.rangeText, "120 - 120 µs");
      assertEqual(brute.barWidthPct, 100);
      assertEqual(brute.distanceComputations, 1000);
      assertEqual(brute.distBarWidthPct, 100);
      assertEqual(brute.rankStrip, null);
      assertEqual(brute.recallPercent, "100.0%");

      // 2. KD-Tree
      const kd = cards[1];
      assertEqual(kd.alg, "kdtree");
      assertEqual(kd.label, "KD-Tree");
      assertEqual(kd.isBrute, false);
      assertEqual(kd.medianUs, 85);
      assertEqual(kd.barWidthPct, 71);
      assertEqual(kd.distanceComputations, 240);
      assertEqual(kd.distBarWidthPct, 24);
      assertEqual(kd.rankStrip.length, 10);
      assertEqual(kd.sameCount, 10);
      assertEqual(kd.total, 10);
      assertEqual(kd.recallPercent, "100.0%");

      // 3. HNSW
      const hnsw = cards[2];
      assertEqual(hnsw.alg, "hnsw");
      assertEqual(hnsw.label, "HNSW");
      assertEqual(hnsw.isBrute, false);
      assertEqual(hnsw.medianUs, 42);
      assertEqual(hnsw.barWidthPct, 35);
      assertEqual(hnsw.distanceComputations, 64);
      assertEqual(hnsw.distBarWidthPct, 6);
      assertEqual(hnsw.rankStrip.length, 10);
      assertEqual(hnsw.sameCount, 9);
      assertEqual(hnsw.total, 10);
      assertEqual(hnsw.recallPercent, "90.0%");
    });

    it("mapReportToCards handles missing or null latencies using latency_us fallback", () => {
      const cards = mapReportToCards(realBenchmarkFixture, null);
      assertEqual(cards.length, 3);
      assertEqual(cards[0].medianUs, 120);
      assertEqual(cards[1].medianUs, 85);
      assertEqual(cards[2].medianUs, 32);
    });

    it("mapReportToCards handles null, empty, or invalid report gracefully", () => {
      assertEqual(mapReportToCards(null).length, 0);
      assertEqual(mapReportToCards(undefined).length, 0);
      assertEqual(mapReportToCards({}).length, 0);
      assertEqual(mapReportToCards("invalid").length, 0);
    });

    it("mapReportToCards supports custom k and mismatch detection in rank strip", () => {
      const customReport = {
        k: 4,
        algorithms: {
          brute: {
            latency_us: 50,
            distance_computations: 200,
            recall_at_k: 1.0,
            results: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
          },
          kdtree: {
            latency_us: 40,
            distance_computations: 100,
            recall_at_k: 0.75,
            results: [{ id: 1 }, { id: 99 }, { id: 3 }, { id: 4 }]
          },
          hnsw: {
            latency_us: 20,
            distance_computations: 60,
            recall_at_k: 0.5,
            results: [{ id: 1 }, { id: 2 }, { id: 88 }, { id: 77 }]
          }
        }
      };

      const cards = mapReportToCards(customReport);
      assertEqual(cards.length, 3);

      assertEqual(cards[0].distBarWidthPct, 100);
      assertEqual(cards[1].distBarWidthPct, 50);
      assertEqual(cards[2].distBarWidthPct, 30);

      const kdCard = cards[1];
      assertEqual(kdCard.total, 4);
      assertEqual(kdCard.sameCount, 3);
      assertEqual(kdCard.rankStrip.length, 4);
      assertEqual(kdCard.rankStrip[0].isMatch, true);
      assertEqual(kdCard.rankStrip[1].isMatch, false);
      assertEqual(kdCard.rankStrip[1].expectedId, 2);
      assertEqual(kdCard.rankStrip[1].gotId, 99);
      assertEqual(kdCard.recallPercent, "75.0%");

      const hnswCard = cards[2];
      assertEqual(hnswCard.total, 4);
      assertEqual(hnswCard.sameCount, 2);
      assertEqual(hnswCard.rankStrip[2].isMatch, false);
      assertEqual(hnswCard.rankStrip[2].expectedId, 3);
      assertEqual(hnswCard.rankStrip[2].gotId, 88);
      assertEqual(hnswCard.recallPercent, "50.0%");
    });
  });
}

