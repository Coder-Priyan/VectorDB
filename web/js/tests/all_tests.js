/**
 * VectorDB Browser Unit Test Runner
 *
 * Hermetic unit tests for pure JavaScript modules:
 * SseParser, Viewport2D, citation parsing, formatting, and DOM security.
 */

import { SseParser } from "../sse.js";
import { Viewport2D } from "../canvas.js";
import { el, formatBytes, formatDuration, formatSimilarity, calculateMedian, parseCitations } from "../ui.js";

const suites = [];

function describe(suiteName, fn) {
  const tests = [];
  fn((testName, testFn) => tests.push({ name: testName, fn: testFn }));
  suites.push({ name: suiteName, tests });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || "assertEqual failed"}: expected [${expected}], got [${actual}]`);
  }
}

function assertNear(actual, expected, tolerance = 1e-4, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message || "assertNear failed"}: expected [${expected}], got [${actual}] (diff: ${Math.abs(actual - expected)})`);
  }
}

// -----------------------------------------------------------------------------
// Test Suites
// -----------------------------------------------------------------------------

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
    // Simulate multi-character string chunks
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

    const testPoints = [
      { x: 0, y: 0 },
      { x: -10, y: -5 },
      { x: 10, y: 5 },
      { x: 3.42, y: -1.89 }
    ];

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
    vp.fitBounds(5, 5, 5, 5); // Single point
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

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

function runAll() {
  const container = document.getElementById("test-results-container");
  const summaryBox = document.getElementById("test-summary-box");
  if (!container || !summaryBox) return;

  container.replaceChildren();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const suite of suites) {
    const suiteEl = el("div", { className: "test-suite" },
      el("h3", { className: "section-title" }, suite.name)
    );

    for (const test of suite.tests) {
      totalTests++;
      let error = null;
      try {
        test.fn();
        passedTests++;
      } catch (err) {
        failedTests++;
        error = err;
      }

      const statusBadge = el("span", {
        className: error ? "badge badge-danger" : "badge badge-success"
      }, error ? "FAIL" : "PASS");

      const row = el("div", { className: "test-case" },
        el("div", {},
          el("span", { className: "test-name" }, test.name),
          error ? el("div", { className: "text-muted", textContent: error.message }) : null
        ),
        statusBadge
      );

      suiteEl.appendChild(row);
    }

    container.appendChild(suiteEl);
  }

  summaryBox.classList.remove("hidden", "alert-danger", "alert-success", "notice-warning");
  if (failedTests === 0) {
    summaryBox.className = "test-summary badge-success";
    summaryBox.textContent = `All Tests Passed: ${passedTests} / ${totalTests} passing`;
  } else {
    summaryBox.className = "test-summary alert-danger";
    summaryBox.textContent = `Test Failures: ${failedTests} failed, ${passedTests} passed (${totalTests} total)`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("run-again-btn");
  runBtn?.addEventListener("click", runAll);
  runAll();
});

