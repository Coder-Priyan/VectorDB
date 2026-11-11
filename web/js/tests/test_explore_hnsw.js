/**
 * Unit Tests for Explore & HNSW Pure Logic Modules
 */
import { describe, assert, assertEqual, assertNear } from "./framework.js";
import { Viewport2D } from "../canvas.js";
import { findHitPoint, getDocColor, computeBounds, DOC_COLOR_PALETTE } from "../explore_helpers.js";
import { getLayerColor, formatEdgeSummary, formatHnswTopologySummary, mapTraceToCoordinates, PlaybackController, LAYER_COLORS, isCanvasDrawable } from "../hnsw_helpers.js";

export function registerExploreHnswTests() {
  describe("Hit-Testing (explore_helpers.js)", (it) => {
    const vp = new Viewport2D(800, 600, 40);
    vp.fitBounds(-10, 10, -10, 10);
    const pts = [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 5, y: 5 },
      { id: 3, x: -5, y: -5 }
    ];

    it("Exact hit returns the target point", () => {
      const scr = vp.toScreen(0, 0);
      const hit = findHitPoint(scr.x, scr.y, pts, vp, 8);
      assert(hit !== null, "Hit point found");
      assertEqual(hit.id, 1);
    });

    it("Point within 8px threshold is detected", () => {
      const scr = vp.toScreen(5, 5);
      const hit = findHitPoint(scr.x + 4, scr.y - 4, pts, vp, 8);
      assert(hit !== null, "Hit point found within radius");
      assertEqual(hit.id, 2);
    });

    it("Point outside hit radius returns null", () => {
      const scr = vp.toScreen(0, 0);
      const hit = findHitPoint(scr.x + 30, scr.y + 30, pts, vp, 8);
      assertEqual(hit, null);
    });

    it("Empty points list returns null safely", () => {
      const hit = findHitPoint(100, 100, [], vp, 8);
      assertEqual(hit, null);
    });
  });

  describe("Color & Bounds Helpers (explore_helpers.js)", (it) => {
    it("getDocColor maps deterministically to palette", () => {
      const c1 = getDocColor(0);
      const c2 = getDocColor(DOC_COLOR_PALETTE.length);
      assertEqual(c1, DOC_COLOR_PALETTE[0]);
      assertEqual(c2, DOC_COLOR_PALETTE[0]);
      assertEqual(getDocColor(1), DOC_COLOR_PALETTE[1]);
    });

    it("getDocColor handles invalid input with fallback", () => {
      assertEqual(getDocColor(null), "#64748b");
      assertEqual(getDocColor(undefined), "#64748b");
    });

    it("computeBounds calculates min and max coordinates", () => {
      const pts = [{ x: -3, y: 4 }, { x: 7, y: -2 }, { x: 0, y: 1 }];
      const b = computeBounds(pts);
      assertEqual(b.minX, -3);
      assertEqual(b.maxX, 7);
      assertEqual(b.minY, -2);
      assertEqual(b.maxY, 4);
    });

    it("computeBounds handles empty list with fallback", () => {
      const b = computeBounds([]);
      assertEqual(b.minX, -1);
      assertEqual(b.maxX, 1);
    });
  });

  describe("HNSW Layer & Edge Helpers (hnsw_helpers.js)", (it) => {
    it("getLayerColor maps layers to color scheme", () => {
      assertEqual(getLayerColor(0), LAYER_COLORS[0]);
      assertEqual(getLayerColor(1), LAYER_COLORS[1]);
      assertEqual(getLayerColor(10), LAYER_COLORS[LAYER_COLORS.length - 1]);
    });

    it("formatEdgeSummary detects truncation correctly", () => {
      const res1 = formatEdgeSummary(2000, 2000, false);
      assertEqual(res1.isTruncated, false);
      assertEqual(res1.label, "Showing 2,000 of 2,000 edges");

      const res2 = formatEdgeSummary(2000, 8500, true);
      assertEqual(res2.isTruncated, true);
      assertEqual(res2.label, "Showing 2,000 of 8,500 edges");
    });

    it("mapTraceToCoordinates maps present and missing nodes", () => {
      const trace = [
        { layer: 2, id: 10, distance: 0.8 },
        { layer: 1, id: 20, distance: 0.5 },
        { layer: 0, id: 999, distance: 0.2 } // Missing from PCA
      ];
      const pcaMap = new Map([
        [10, { x: 1.2, y: 3.4 }],
        [20, { x: -0.5, y: 2.1 }]
      ]);

      const result = mapTraceToCoordinates(trace, pcaMap);
      assertEqual(result.mappedSteps.length, 3);
      assertEqual(result.missingCount, 1);
      assertEqual(result.mappedSteps[0].onMap, true);
      assertEqual(result.mappedSteps[0].x, 1.2);
      assertEqual(result.mappedSteps[2].onMap, false);
      assertEqual(result.mappedSteps[2].id, 999);
    });

    it("formatHnswTopologySummary formats populated graph correctly", () => {
      const info = {
        numNodes: 2000,
        maxLevel: 3,
        entryPointId: 1050,
        nodesPerLayer: [2000, 122, 14, 1],
        avgDegreePerLayer: [24.3, 15.8, 11.2, 4.0]
      };
      const s = formatHnswTopologySummary(info);
      assertEqual(s.nodesMaxLvl, "2000 / 3");
      assertEqual(s.entryPointId, "1050");
      assertEqual(s.nodesPerLayer, "L0: 2000, L1: 122, L2: 14, L3: 1");
      assertEqual(s.avgDegreePerLayer, "L0: 24.3, L1: 15.8, L2: 11.2, L3: 4.0");
    });

    it("formatHnswTopologySummary handles empty or uninitialized graph safely", () => {
      const emptyInfo = {
        numNodes: 0,
        maxLevel: -1,
        entryPointId: 0,
        nodesPerLayer: [],
        avgDegreePerLayer: []
      };
      const s1 = formatHnswTopologySummary(emptyInfo);
      assertEqual(s1.nodesMaxLvl, "-");
      assertEqual(s1.entryPointId, "-");
      assertEqual(s1.nodesPerLayer, "-");
      assertEqual(s1.avgDegreePerLayer, "-");

      const s2 = formatHnswTopologySummary(null);
      assertEqual(s2.nodesMaxLvl, "-");
      assertEqual(s2.entryPointId, "-");
    });
  });

  describe("Playback State Machine (hnsw_helpers.js)", (it) => {
    const steps = [
      { layer: 1, id: 1, distance: 0.9 },
      { layer: 0, id: 2, distance: 0.5 },
      { layer: 0, id: 3, distance: 0.1 }
    ];

    it("Initializes in reset paused state", () => {
      const pb = new PlaybackController(steps);
      const st = pb.getState();
      assertEqual(st.currentIndex, -1);
      assertEqual(st.totalSteps, 3);
      assertEqual(st.isPlaying, false);
      assertEqual(st.isDone, false);
      assertEqual(st.currentStep, null);
    });

    it("stepForward and stepBack navigate accurately", () => {
      const pb = new PlaybackController(steps);
      pb.stepForward();
      assertEqual(pb.getState().currentIndex, 0);
      assertEqual(pb.getState().currentStep.id, 1);

      pb.stepForward();
      pb.stepForward();
      assertEqual(pb.getState().currentIndex, 2);
      assertEqual(pb.getState().isDone, true);

      // Past boundary stays clamped
      pb.stepForward();
      assertEqual(pb.getState().currentIndex, 2);

      // Step back
      pb.stepBack();
      assertEqual(pb.getState().currentIndex, 1);
    });

    it("tick advances index and stops at end", () => {
      const pb = new PlaybackController(steps);
      pb.play();
      assertEqual(pb.getState().isPlaying, true);

      pb.tick(); // index 0
      assertEqual(pb.getState().currentIndex, 0);
      pb.tick(); // index 1
      pb.tick(); // index 2
      assertEqual(pb.getState().currentIndex, 2);
      assertEqual(pb.getState().isDone, true);

      pb.tick(); // reaches end -> auto pause
      assertEqual(pb.getState().isPlaying, false);
    });

    it("seek and reset jump to target index", () => {
      const pb = new PlaybackController(steps);
      pb.seek(1);
      assertEqual(pb.getState().currentIndex, 1);
      assertEqual(pb.getState().currentStep.id, 2);

      pb.seek(99); // Clamped to max
      assertEqual(pb.getState().currentIndex, 2);

      pb.reset();
      assertEqual(pb.getState().currentIndex, -1);
      assertEqual(pb.getState().isPlaying, false);
    });
  });

  describe("Canvas Drawable Guard (hnsw_helpers.js)", (it) => {
    it("Positive finite dimensions are drawable", () => {
      assertEqual(isCanvasDrawable(680, 460), true);
      assertEqual(isCanvasDrawable(1, 1), true);
      assertEqual(isCanvasDrawable(1920, 1080), true);
    });

    it("Zero dimensions are not drawable", () => {
      assertEqual(isCanvasDrawable(0, 460), false);
      assertEqual(isCanvasDrawable(680, 0), false);
      assertEqual(isCanvasDrawable(0, 0), false);
    });

    it("Negative dimensions are not drawable", () => {
      assertEqual(isCanvasDrawable(-10, 460), false);
      assertEqual(isCanvasDrawable(680, -5), false);
      assertEqual(isCanvasDrawable(-10, -10), false);
    });

    it("Non-numeric or NaN dimensions are not drawable", () => {
      assertEqual(isCanvasDrawable(NaN, 460), false);
      assertEqual(isCanvasDrawable(680, NaN), false);
      assertEqual(isCanvasDrawable(undefined, 460), false);
      assertEqual(isCanvasDrawable(680, null), false);
      assertEqual(isCanvasDrawable(Infinity, 460), false);
    });
  });
}

