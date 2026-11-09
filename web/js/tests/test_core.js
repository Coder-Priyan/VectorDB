/**
 * Core Logic Tests: SSE parser, 2D Viewport, Citations, and Formatters
 */
import { describe, assert, assertEqual, assertNear } from "./framework.js";
import { SseParser } from "../sse.js";
import { Viewport2D } from "../canvas.js";
import { el, formatBytes, formatDuration, formatSimilarity, calculateMedian, parseCitations } from "../ui.js";

export function registerCoreTests() {
  describe("SSE Parser (sse.js)", (it) => {
    it("Single complete event parsing", () => {
      const parser = new SseParser();
      const events = parser.feed("event: token\ndata: {\"t\":\"hello\"}\n\n");
      assertEqual(events.length, 1);
      assertEqual(events[0].event, "token");
      assertEqual(events[0].data, "{\"t\":\"hello\"}");
    });

    it("Events split across network chunk boundaries", () => {
      const parser = new SseParser();
      let events = parser.feed("event: tok");
      assertEqual(events.length, 0);
      events = parser.feed("en\ndata: {\"t\":\"world\"}\n\n");
      assertEqual(events.length, 1);
      assertEqual(events[0].event, "token");
      assertEqual(events[0].data, "{\"t\":\"world\"}");
    });

    it("Multi-byte UTF-8 split across chunks", () => {
      const parser = new SseParser();
      let events = parser.feed("event: token\ndata: こん");
      assertEqual(events.length, 0);
      events = parser.feed("にちは 🌍\n\n");
      assertEqual(events.length, 1);
      assertEqual(events[0].data, "こんにちは 🌍");
    });

    it("SSE comment lines and ping frames ignored", () => {
      const parser = new SseParser();
      const events = parser.feed(": ping\n: keep-alive\nevent: done\ndata: {\"status\":\"ok\"}\n\n");
      assertEqual(events.length, 1);
      assertEqual(events[0].event, "done");
    });

    it("Unknown event types handled without throwing", () => {
      const parser = new SseParser();
      const events = parser.feed("event: custom_unknown\ndata: 12345\n\n");
      assertEqual(events.length, 1);
      assertEqual(events[0].event, "custom_unknown");
      assertEqual(events[0].data, "12345");
    });

    it("Multiline data field concatenation", () => {
      const parser = new SseParser();
      const events = parser.feed("event: msg\ndata: line 1\ndata: line 2\n\n");
      assertEqual(events.length, 1);
      assertEqual(events[0].data, "line 1\nline 2");
    });
  });

  describe("2D Canvas Viewport (canvas.js)", (it) => {
    it("toScreen and toData are exact algebraic inverses", () => {
      const vp = new Viewport2D(800, 600, 40);
      vp.fitBounds(-10, 10, -5, 5);
      const testPoints = [{ x: 0, y: 0 }, { x: -10, y: -5 }, { x: 10, y: 5 }, { x: 3.42, y: -1.89 }];
      for (const pt of testPoints) {
        const screen = vp.toScreen(pt.x, pt.y);
        const inverted = vp.toData(screen.x, screen.y);
        assertNear(inverted.x, pt.x, 1e-4, "Data X inverted match");
        assertNear(inverted.y, pt.y, 1e-4, "Data Y inverted match");
      }
    });

    it("Zooming scales coordinates properly", () => {
      const vp = new Viewport2D(800, 600, 40);
      vp.fitBounds(-1, 1, -1, 1);
      const before = vp.toScreen(0.5, 0.5);
      vp.zoomAt(400, 300, 2.0);
      assertEqual(vp.zoom, 2.0);
      const after = vp.toScreen(0.5, 0.5);
      assert(after.x !== before.x, "Screen coordinates shifted under zoom");
    });

    it("Panning shifts screen coordinates by delta", () => {
      const vp = new Viewport2D(800, 600, 40);
      vp.fitBounds(-1, 1, -1, 1);
      const before = vp.toScreen(0, 0);
      vp.pan(25, -15);
      const after = vp.toScreen(0, 0);
      assertNear(after.x - before.x, 25, 1e-4, "Pan X delta");
      assertNear(after.y - before.y, -15, 1e-4, "Pan Y delta");
    });

    it("Degenerate bounds handled without division by zero", () => {
      const vp = new Viewport2D(800, 600, 40);
      vp.fitBounds(5, 5, 5, 5);
      const s = vp.toScreen(5, 5);
      assert(!isNaN(s.x) && !isNaN(s.y), "Screen coordinates are finite");
    });
  });

  describe("UI & Citation Safety (ui.js)", (it) => {
    it("parseCitations separates citations from text spans", () => {
      const text = "Bentley introduced KD-Trees [1], while Malkov created HNSW [2].";
      const parts = parseCitations(text);
      assertEqual(parts.length, 5);
      assertEqual(parts[0].type, "text");
      assertEqual(parts[0].text, "Bentley introduced KD-Trees ");
      assertEqual(parts[1].type, "citation");
      assertEqual(parts[1].n, 1);
      assertEqual(parts[2].type, "text");
      assertEqual(parts[2].text, ", while Malkov created HNSW ");
      assertEqual(parts[3].type, "citation");
      assertEqual(parts[3].n, 2);
      assertEqual(parts[4].type, "text");
      assertEqual(parts[4].text, ".");
    });

    it("parseCitations handles plain text without brackets", () => {
      const text = "No citations here.";
      const parts = parseCitations(text);
      assertEqual(parts.length, 1);
      assertEqual(parts[0].type, "text");
    });

    it("DOM element builder creates text nodes without executing HTML", () => {
      const payload = "<script>alert(1)</script><img src=x onerror=alert(2)>";
      const node = el("div", { className: "safe-box" }, payload);
      assertEqual(node.textContent, payload);
      assertEqual(node.children.length, 0, "No child elements created from HTML text");
    });
  });

  describe("Formatting & Math Helpers (ui.js)", (it) => {
    it("calculateMedian odd and even lengths", () => {
      assertEqual(calculateMedian([5, 1, 3]), 3);
      assertEqual(calculateMedian([10, 20, 30, 40]), 25);
      assertEqual(calculateMedian([42]), 42);
      assertEqual(calculateMedian([]), 0);
    });

    it("formatBytes scales correctly", () => {
      assertEqual(formatBytes(0), "0 B");
      assertEqual(formatBytes(512), "512 B");
      assertEqual(formatBytes(1024), "1.0 KB");
      assertEqual(formatBytes(2097152), "2.0 MB");
    });

    it("formatDuration handles ms and seconds", () => {
      assertEqual(formatDuration(42.5), "42.5 ms");
      assertEqual(formatDuration(1500), "1.50 s");
    });

    it("formatSimilarity formats percentage", () => {
      assertEqual(formatSimilarity(0.774), "77.4%");
      assertEqual(formatSimilarity(1.0), "100.0%");
    });
  });
}

