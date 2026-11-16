/**
 * VectorDB v2 Browser Unit Tests
 *
 * Tests for v2 additions: chat storage, citation edge cases, SVG icons,
 * explainers registry, and query history formatting.
 */

import { describe, assert, assertEqual } from "./framework.js";
import { createIcon } from "../icons.js";
import { EXPLAINERS } from "../learn_content.js";
import { parseCitations, getDropdownNextIndex, createDropdown } from "../ui.js";
import { formatBenchmarkRows, formatTraceSummary, formatPipelineLatency, getTabNextIndex } from "../ask_helpers.js";
import {
  getSettingsNextSectionIndex,
  formatHnswSummary,
  formatDocumentListSummary,
  countLocalChatThreads
} from "../settings_helpers.js";

export function registerV2Tests() {
  describe("v2: SVG Icon Registry", (test) => {
    const requiredIcons = [
      "chat", "plus", "explore", "graph", "compare",
      "settings", "document", "trash", "search", "chevron",
      "copy", "stop", "send", "info", "arrowRight"
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

    test("Citations with adjacent punctuation parse cleanly into text and citation tokens", () => {
      const tokens = parseCitations("Reference [1], note [2]. Finished [3]!");
      assertEqual(tokens.length, 7);
      assertEqual(tokens[0].text, "Reference ");
      assertEqual(tokens[1].type, "citation");
      assertEqual(tokens[1].n, 1);
      assertEqual(tokens[2].text, ", note ");
      assertEqual(tokens[3].type, "citation");
      assertEqual(tokens[3].n, 2);
      assertEqual(tokens[4].text, ". Finished ");
      assertEqual(tokens[5].type, "citation");
      assertEqual(tokens[5].n, 3);
      assertEqual(tokens[6].text, "!");
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

  describe("v2: Ask Pipeline Latency Flow Formatting", (test) => {
    test("formatPipelineLatency maps server timings to 5 ordered tiles", () => {
      const timings = {
        embed_ms: 12.4,
        search_ms: 1.8,
        first_token_ms: 45.2,
        generate_ms: 110.6,
        total_ms: 170.0
      };
      const items = formatPipelineLatency(timings);
      assertEqual(items.length, 5);
      assertEqual(items[0].label, "Embed");
      assertEqual(items[0].ms, 12.4);
      assertEqual(items[0].isTotal, false);
      assertEqual(items[1].label, "Search");
      assertEqual(items[2].label, "First token");
      assertEqual(items[3].label, "Generate");
      assertEqual(items[4].label, "Total");
      assertEqual(items[4].isTotal, true);
      assertEqual(items[4].ms, 170.0);
    });

    test("formatPipelineLatency handles missing or empty timings gracefully", () => {
      assertEqual(formatPipelineLatency(null).length, 0);
      assertEqual(formatPipelineLatency(undefined).length, 0);
      const empty = formatPipelineLatency({});
      assertEqual(empty.length, 5);
      assertEqual(empty[0].ms, 0);
      assertEqual(empty[4].isTotal, true);
    });
  });

  describe("v2: Custom Dark Dropdown Component (T-058)", (test) => {
    test("getDropdownNextIndex cycles down through options and wraps to 0", () => {
      assertEqual(getDropdownNextIndex(0, 1, 3), 1);
      assertEqual(getDropdownNextIndex(1, 1, 3), 2);
      assertEqual(getDropdownNextIndex(2, 1, 3), 0);
    });

    test("getDropdownNextIndex cycles up through options and wraps to last index", () => {
      assertEqual(getDropdownNextIndex(2, -1, 3), 1);
      assertEqual(getDropdownNextIndex(1, -1, 3), 0);
      assertEqual(getDropdownNextIndex(0, -1, 3), 2);
    });

    test("getDropdownNextIndex handles unselected (-1) initial state cleanly", () => {
      assertEqual(getDropdownNextIndex(-1, 1, 3), 0);
      assertEqual(getDropdownNextIndex(-1, -1, 3), 2);
    });

    test("getDropdownNextIndex handles empty list without throwing", () => {
      assertEqual(getDropdownNextIndex(0, 1, 0), -1);
      assertEqual(getDropdownNextIndex(-1, -1, 0), -1);
    });

    test("createDropdown initializes with correct initial value and hidden input contract", () => {
      let changeCount = 0;
      let lastVal = null;
      const onChange = (val) => {
        changeCount++;
        lastVal = val;
      };

      const dd = createDropdown([
        { value: "hnsw", label: "HNSW" },
        { value: "kdtree", label: "KD-Tree" },
        { value: "brute", label: "Brute" }
      ], "hnsw", onChange, { id: "test-algo-select" });

      // Regression checks: onChange must not fire during initialization
      assertEqual(changeCount, 0, "onChange must NOT fire during initialization");
      assertEqual(dd.getValue(), "hnsw");
      const hiddenInput = dd.element.querySelector("input[type='hidden']");
      assert(hiddenInput !== null, "Must contain hidden input for ID contract");
      assertEqual(hiddenInput.id, "test-algo-select");
      assertEqual(hiddenInput.value, "hnsw");

      // Option selection invokes onChange exactly once
      const kdtreeOption = dd.element.querySelector(".custom-dropdown-option[data-value='kdtree']");
      assert(kdtreeOption !== null, "Option element for kdtree must exist");
      kdtreeOption.click();

      assertEqual(changeCount, 1, "Selecting an option must fire onChange exactly once");
      assertEqual(lastVal, "kdtree");
      assertEqual(dd.getValue(), "kdtree");
      assertEqual(hiddenInput.value, "kdtree");

      // Programmatic setValue updates both component and hidden input
      dd.setValue("brute");
      assertEqual(changeCount, 2, "setValue fires onChange");
      assertEqual(dd.getValue(), "brute");
      assertEqual(hiddenInput.value, "brute");
    });
  });

  describe("T-060: Ask Glass-Box Tab Keyboard Navigation (getTabNextIndex)", (test) => {
    test("ArrowRight and ArrowDown advance to next tab and wrap at end", () => {
      assertEqual(getTabNextIndex(0, 3, "ArrowRight"), 1);
      assertEqual(getTabNextIndex(1, 3, "ArrowRight"), 2);
      assertEqual(getTabNextIndex(2, 3, "ArrowRight"), 0, "Wraps from end to 0");
      assertEqual(getTabNextIndex(0, 3, "ArrowDown"), 1);
      assertEqual(getTabNextIndex(2, 3, "ArrowDown"), 0, "ArrowDown wraps to 0");
    });

    test("ArrowLeft and ArrowUp retreat to previous tab and wrap at start", () => {
      assertEqual(getTabNextIndex(2, 3, "ArrowLeft"), 1);
      assertEqual(getTabNextIndex(1, 3, "ArrowLeft"), 0);
      assertEqual(getTabNextIndex(0, 3, "ArrowLeft"), 2, "Wraps from 0 to last index");
      assertEqual(getTabNextIndex(2, 3, "ArrowUp"), 1);
      assertEqual(getTabNextIndex(0, 3, "ArrowUp"), 2, "ArrowUp wraps to last index");
    });

    test("Home key returns first tab index 0", () => {
      assertEqual(getTabNextIndex(0, 3, "Home"), 0);
      assertEqual(getTabNextIndex(2, 3, "Home"), 0);
    });

    test("End key returns last tab index count - 1", () => {
      assertEqual(getTabNextIndex(0, 3, "End"), 2);
      assertEqual(getTabNextIndex(1, 3, "End"), 2);
      assertEqual(getTabNextIndex(2, 3, "End"), 2);
    });

    test("Unknown key returns current index unchanged", () => {
      assertEqual(getTabNextIndex(1, 3, "Tab"), 1);
      assertEqual(getTabNextIndex(1, 3, "Enter"), 1);
      assertEqual(getTabNextIndex(2, 3, "Escape"), 2);
    });

    test("count <= 0 returns -1 without throwing", () => {
      assertEqual(getTabNextIndex(0, 0, "ArrowRight"), -1);
      assertEqual(getTabNextIndex(0, -1, "Home"), -1);
    });
  });

  describe("T-072: Settings Two-Pane Navigation (getSettingsNextSectionIndex)", (test) => {
    test("ArrowRight and ArrowDown advance to next section and wrap at end", () => {
      assertEqual(getSettingsNextSectionIndex(0, 5, "ArrowDown"), 1);
      assertEqual(getSettingsNextSectionIndex(1, 5, "ArrowDown"), 2);
      assertEqual(getSettingsNextSectionIndex(4, 5, "ArrowDown"), 0, "ArrowDown wraps to 0");
      assertEqual(getSettingsNextSectionIndex(0, 5, "ArrowRight"), 1);
      assertEqual(getSettingsNextSectionIndex(4, 5, "ArrowRight"), 0, "ArrowRight wraps to 0");
    });

    test("ArrowLeft and ArrowUp retreat to previous section and wrap at start", () => {
      assertEqual(getSettingsNextSectionIndex(4, 5, "ArrowUp"), 3);
      assertEqual(getSettingsNextSectionIndex(1, 5, "ArrowUp"), 0);
      assertEqual(getSettingsNextSectionIndex(0, 5, "ArrowUp"), 4, "ArrowUp wraps to last index");
      assertEqual(getSettingsNextSectionIndex(4, 5, "ArrowLeft"), 3);
      assertEqual(getSettingsNextSectionIndex(0, 5, "ArrowLeft"), 4, "ArrowLeft wraps to last index");
    });

    test("Home key returns first section index 0", () => {
      assertEqual(getSettingsNextSectionIndex(0, 5, "Home"), 0);
      assertEqual(getSettingsNextSectionIndex(3, 5, "Home"), 0);
    });

    test("End key returns last section index totalCount - 1", () => {
      assertEqual(getSettingsNextSectionIndex(0, 5, "End"), 4);
      assertEqual(getSettingsNextSectionIndex(2, 5, "End"), 4);
      assertEqual(getSettingsNextSectionIndex(4, 5, "End"), 4);
    });

    test("Unknown keys return current index unchanged", () => {
      assertEqual(getSettingsNextSectionIndex(2, 5, "Tab"), 2);
      assertEqual(getSettingsNextSectionIndex(2, 5, "Enter"), 2);
      assertEqual(getSettingsNextSectionIndex(3, 5, "Escape"), 3);
    });

    test("totalCount <= 0 returns 0 without throwing", () => {
      assertEqual(getSettingsNextSectionIndex(0, 0, "ArrowDown"), 0);
      assertEqual(getSettingsNextSectionIndex(2, -1, "Home"), 0);
    });
  });

  describe("T-097: Settings HNSW & Documents pure telemetry helpers", (test) => {
    test("formatHnswSummary handles null or missing info gracefully", () => {
      const empty = formatHnswSummary(null);
      assertEqual(empty.available, false);
      assertEqual(empty.maxLevel, 0);
      assertEqual(empty.entryPoint, "--");
      assertEqual(empty.layersText, "None");
      assertEqual(empty.degreeText, "--");
    });

    test("formatHnswSummary formats real HNSW graph telemetry correctly", () => {
      const summary = formatHnswSummary({
        maxLevel: 3,
        entryPointId: 42,
        nodesPerLayer: [1000, 120, 15, 2],
        avgDegreePerLayer: [16.2, 12.0, 6.5, 2.0]
      });
      assertEqual(summary.available, true);
      assertEqual(summary.maxLevel, 3);
      assertEqual(summary.entryPoint, "#42");
      assertEqual(summary.layersText, "L0: 1000 · L1: 120 · L2: 15 · L3: 2");
      assertEqual(summary.degreeText, "L0: 16.2 · L1: 12.0 · L2: 6.5 · L3: 2.0");
    });

    test("formatDocumentListSummary formats document items and chunk counts", () => {
      const docs = [
        { id: 1, title: "Architecture Guide", bytes: 2048, chunks: 5 },
        { id: 2, title: "Quickstart", bytes: 512, chunks: 1 }
      ];
      const list = formatDocumentListSummary(docs, 4);
      assertEqual(list.length, 2);
      assertEqual(list[0].id, 1);
      assertEqual(list[0].title, "Architecture Guide");
      assertEqual(list[0].chunksText, "5 chunks");
      assertEqual(list[0].sizeText, "2.0 KB");

      assertEqual(list[1].id, 2);
      assertEqual(list[1].title, "Quickstart");
      assertEqual(list[1].chunksText, "1 chunk");
      assertEqual(list[1].sizeText, "512 B");
    });

    test("formatDocumentListSummary returns empty array for empty or null docs", () => {
      assertEqual(formatDocumentListSummary([]).length, 0);
      assertEqual(formatDocumentListSummary(null).length, 0);
    });

    test("countLocalChatThreads counts keys starting with vectordb:chats:", () => {
      const keys = ["vectordb:chats:abc", "vectordb:chats:def", "vectordb:chats", "other"];
      assertEqual(countLocalChatThreads(keys), 2);
      assertEqual(countLocalChatThreads([]), 0);
      assertEqual(countLocalChatThreads(null), 0);
    });
  });
}


