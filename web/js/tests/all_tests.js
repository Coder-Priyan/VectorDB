/**
 * VectorDB Browser Unit Test Aggregator & DOM Runner
 *
 * Imports suites from modular test files and renders test results.
 */

import { suites } from "./framework.js";
import { registerCoreTests } from "./test_core.js";
import { registerExploreHnswTests } from "./test_explore_hnsw.js";
import { registerCompareTests } from "./test_compare.js";
import { el } from "../ui.js";

// Register modular test suites
registerCoreTests();
registerExploreHnswTests();
registerCompareTests();

export function runAll() {
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
