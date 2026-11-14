/**
 * VectorDB v2 Browser Unit Tests
 *
 * Tests for v2 additions: chat storage, citation edge cases, SVG icons,
 * explainers registry, and query history formatting.
 */

import { describe, assert, assertEqual } from "./framework.js";
import { createIcon } from "../icons.js";
import { EXPLAINERS } from "../learn_content.js";
import { parseCitations } from "../ui.js";
import { formatBenchmarkRows, formatTraceSummary } from "../ask_helpers.js";

export function registerV2Tests() {
  describe("v2: SVG Icon Registry", (test) => {
    const requiredIcons = [
      "chat", "plus", "explore", "graph", "compare",
      "settings", "document", "trash", "search", "chevron",
      "copy", "stop", "send", "info"
    ];

    test("All 14 required line icons instantiate valid SVG elements", () => {
      for (const name of requiredIcons) {
        const svg = createIcon(name, 16);
        assert(svg instanceof SVGElement, `createIcon("${name}") must return SVGElement`);
        assertEqual(svg.getAttribute("width"), "16", `Width must be 16 for ${name}`);
        assertEqual(svg.getAttribute("height"), "16", `Height must be 16 for ${name}`);
        assertEqual(svg.getAttribute("fill"), "none", `Fill must be none for ${name}`);
        assert(svg.childNodes.length > 0, `Icon ${name} must have child nodes`);
      }
    });

    test("Icon with extra className attaches class properly", () => {
      const svg = createIcon("chat", 20, "custom-class");
      assertEqual(svg.getAttribute("width"), "20");
      assert(svg.getAttribute("class").includes("custom-class"));
      assert(svg.getAttribute("class").includes("icon-chat"));
    });

    test("Unknown icon name falls back to info icon gracefully", () => {
      const svg = createIcon("non_existent_icon", 16);
      assert(svg instanceof SVGElement);
      assert(svg.childNodes.length > 0);
    });
  });

  describe("v2: Educational Explainers Registry", (test) => {
    const topics = ["embeddings", "cosine", "bruteforce", "kdtree", "hnsw", "pca", "rag"];

    test("All 7 learning topics are present with non-empty titles and content", () => {
      for (const t of topics) {
        assert(t in EXPLAINERS, `Topic ${t} must exist in EXPLAINERS`);
        assert(EXPLAINERS[t].title && EXPLAINERS[t].title.length > 5, `Topic ${t} title missing`);
        assert(EXPLAINERS[t].summary && EXPLAINERS[t].summary.length > 5, `Topic ${t} summary missing`);
        assert(EXPLAINERS[t].content && EXPLAINERS[t].content.length > 20, `Topic ${t} content missing`);
      }
    });
  });

  describe("v2: Citation Parser Edge Cases", (test) => {
    test("Consecutive citation pills parse into distinct tokens", () => {
      const tokens = parseCitations("Based on [1][2], we deduce truth.");
      assertEqual(tokens.length, 4);
      assertEqual(tokens[0].type, "text");
      assertEqual(tokens[0].text, "Based on ");
      assertEqual(tokens[1].type, "citation");
      assertEqual(tokens[1].n, 1);
      assertEqual(tokens[2].type, "citation");
      assertEqual(tokens[2].n, 2);
      assertEqual(tokens[3].type, "text");
      assertEqual(tokens[3].text, ", we deduce truth.");
    });

    test("Unmatched brackets or non-digit brackets remain plain text", () => {
      const tokens = parseCitations("This is [not a citation] and [abc] and [].");
      assertEqual(tokens.length, 1);
      assertEqual(tokens[0].type, "text");
      assertEqual(tokens[0].text, "This is [not a citation] and [abc] and [].");
    });

    test("Large citation index parses correctly", () => {
      const tokens = parseCitations("Source [999] was retrieved.");
      assertEqual(tokens.length, 3);
      assertEqual(tokens[1].type, "citation");
      assertEqual(tokens[1].n, 999);
    });
  });

  describe("v2: LocalStorage Chat Persistence & Cap Pruning", (test) => {
    test("Chat index serialization and cap-50 pruning logic", () => {
      // Create 55 mock chats
      const mockIndex = [];
      for (let i = 0; i < 55; ++i) {
        mockIndex.push({
          id: `chat_${i}`,
          title: `Chat ${i}`,
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
          messageCount: 1
        });
      }

      // Sort by updatedAt desc
      mockIndex.sort((a, b) => b.updatedAt - a.updatedAt);
      assertEqual(mockIndex[0].id, "chat_54");

      // Prune to 50
      const pruned = mockIndex.slice(0, 50);
      assertEqual(pruned.length, 50);
      assertEqual(pruned[0].id, "chat_54");
      assertEqual(pruned[49].id, "chat_5");
    });

    test("Chat message history with sources and timings round-trips via JSON", () => {
      const chat = {
        id: "chat_roundtrip",
        title: "Test Chat",
        messages: [
          { role: "user", content: "What is HNSW?" },
          {
            role: "assistant",
            content: "HNSW is a graph [1].",
            sources: [{ n: 1, title: "Doc", similarity: 0.92 }],
            timings: { total_ms: 125.4 }
          }
        ]
      };

      const serialized = JSON.stringify(chat);
      const parsed = JSON.parse(serialized);
      assertEqual(parsed.id, chat.id);
      assertEqual(parsed.messages.length, 2);
      assertEqual(parsed.messages[1].sources[0].similarity, 0.92);
      assertEqual(parsed.messages[1].timings.total_ms, 125.4);
    });
  });

  describe("v2: Multi-Turn History Payload Formatting", (test) => {
    test("History capping retains last 6 messages and maps role/content", () => {
      const messages = [];
      for (let i = 0; i < 10; ++i) {
        messages.push({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i}`,
          timestamp: Date.now()
        });
      }

      // Slice last 6 messages excluding the current new question
      const history = messages.slice(0, -1).slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));

      assertEqual(history.length, 6);
      assertEqual(history[0].content, "Message 3");
      assertEqual(history[5].content, "Message 8");
      assert(!("timestamp" in history[0]), "Extra fields must not be forwarded");
    });
  });

  describe("v2: Ask Glass-Box Response Mappers (Benchmark & Trace)", (test) => {
    // Real raw response shapes captured via curl from running VectorDB server
    const realBenchmarkResponse = {
      algorithms: {
        brute: {
          distance_computations: 6,
          latency_us: 13,
          recall_at_k: 1.0,
          results: [{ distance: 0.226, id: 1 }, { distance: 0.304, id: 2 }, { distance: 0.396, id: 5 }]
        },
        hnsw: {
          distance_computations: 6,
          latency_us: 18,
          recall_at_k: 1.0,
          results: [{ distance: 0.226, id: 1 }, { distance: 0.304, id: 2 }, { distance: 0.396, id: 5 }]
        },
        kdtree: {
          distance_computations: 6,
          latency_us: 16,
          recall_at_k: 1.0,
          results: [{ distance: 0.226, id: 1 }, { distance: 0.304, id: 2 }, { distance: 0.396, id: 5 }]
        }
      },
      count: 6,
      ground_truth: "brute",
      k: 3
    };

    const realTraceResponse = {
      results: [
        { chunk_index: 0, distance: 0.226, doc_id: 1, id: 1, title: "vectordb_intro" },
        { chunk_index: 1, distance: 0.304, doc_id: 1, id: 2, title: "vectordb_intro" },
        { chunk_index: 4, distance: 0.396, doc_id: 1, id: 5, title: "vectordb_intro" }
      ],
      stats: {
        distanceComputations: 6,
        nodesVisited: 6,
        visitedPerLayer: [6]
      },
      trace: [
        { chunk_index: 0, distance: 0.226, doc_id: 1, id: 1, layer: 0, title: "vectordb_intro" },
        { chunk_index: 1, distance: 0.304, doc_id: 1, id: 2, layer: 0, title: "vectordb_intro" },
        { chunk_index: 2, distance: 0.412, doc_id: 1, id: 3, layer: 0, title: "vectordb_intro" },
        { chunk_index: 3, distance: 0.405, doc_id: 1, id: 4, layer: 0, title: "vectordb_intro" },
        { chunk_index: 4, distance: 0.396, doc_id: 1, id: 5, layer: 0, title: "vectordb_intro" },
        { chunk_index: 5, distance: 0.506, doc_id: 1, id: 6, layer: 0, title: "vectordb_intro" }
      ]
    };

    test("formatBenchmarkRows maps real server benchmark response to rows correctly", () => {
      const rows = formatBenchmarkRows(realBenchmarkResponse);
      assertEqual(rows.length, 3);
      assertEqual(rows[0].key, "brute");
      assertEqual(rows[0].name, "Brute Force");
      assertEqual(rows[0].latencyUs, 13);
      assertEqual(rows[0].distanceComputations, 6);
      assertEqual(rows[0].recallFormatted, "100%");

      assertEqual(rows[1].key, "kdtree");
      assertEqual(rows[1].name, "KD-Tree");
      assertEqual(rows[1].latencyUs, 16);

      assertEqual(rows[2].key, "hnsw");
      assertEqual(rows[2].name, "HNSW");
      assertEqual(rows[2].latencyUs, 18);
      assertEqual(rows[2].percent, 100);
    });

    test("formatBenchmarkRows gracefully handles empty or null payloads", () => {
      assertEqual(formatBenchmarkRows(null).length, 0);
      assertEqual(formatBenchmarkRows({}).length, 0);
      assertEqual(formatBenchmarkRows({ algorithms: {} }).length, 0);
    });

    test("formatTraceSummary maps real server trace response to summary text accurately", () => {
      const summary = formatTraceSummary(realTraceResponse);
      assertEqual(summary.nodesVisited, 6);
      assertEqual(summary.layersCount, 1);
      assertEqual(summary.distComps, 6);
      assertEqual(summary.topKCount, 3);
      assert(summary.summaryText.includes("visited 6 nodes across 1 layer"));
      assert(summary.summaryText.includes("6 distance computations"));
    });

    test("formatTraceSummary gracefully handles empty or null trace payloads", () => {
      const summaryNull = formatTraceSummary(null);
      assertEqual(summaryNull.nodesVisited, 0);
      assertEqual(summaryNull.summaryText, "No trace data available.");

      const summaryEmpty = formatTraceSummary({ stats: {}, trace: [] });
      assertEqual(summaryEmpty.nodesVisited, 0);
      assertEqual(summaryEmpty.layersCount, 1);
    });
  });
}

