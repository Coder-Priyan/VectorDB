/**
 * VectorDB Multi-Algorithm Benchmark Comparison Controller
 */

import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { el, createDropdown } from "./ui.js";
import { createIcon } from "./icons.js";
import {
  getCompareEmptyStateConfig,
  mapReportToCards,
  buildCompareHeadline,
  formatSpeedComparison,
  formatPrunedText,
  METRIC_SWITCHER_TABS,
  computeSharedMetricBars,
  handleSegmentedKeyNav
} from "./compare_helpers.js";

export function initCompareTab() {
  const byId = (id) => document.getElementById(id);
  const collWrap = byId("compare-coll-dropdown-wrap");
  const repeatWrap = byId("compare-repeat-dropdown-wrap");
  if (!collWrap || !repeatWrap) return;

  const urlParams = new URLSearchParams(window.location.search);
  const initialColl = urlParams.get("coll") === "docs" ? "docs" : "demo";

  const collDropdown = createDropdown(
    [
      { value: "demo", label: "Demo Vectors" },
      { value: "docs", label: "Document Chunks" }
    ],
    initialColl,
    () => {
      resetCompareView();
      updateCollectionVisibility();
      checkCollectionStats();
    },
    { id: "compare-coll-select", ariaLabel: "Collection" }
  );
  collWrap.replaceChildren(collDropdown.element);

  const repeatDropdown = createDropdown(
    [
      { value: "1", label: "1 run" },
      { value: "3", label: "3 runs" },
      { value: "5", label: "5 runs" },
      { value: "10", label: "10 runs" },
      { value: "20", label: "20 runs" }
    ],
    "5",
    null,
    { id: "compare-repeat-select", ariaLabel: "Repetitions" }
  );
  repeatWrap.replaceChildren(repeatDropdown.element);

  const collSelect = byId("compare-coll-select");
  const repeatSelect = byId("compare-repeat-select");

  const docsQueryWrap = byId("compare-docs-query-wrap");
  const docsQueryInput = byId("compare-docs-query-input");
  const demoRandomBtn = byId("compare-demo-random-btn");
  const docsRunBtn = byId("compare-docs-run-btn");

  const optionsBtn = byId("compare-options-btn");
  const optionsPopover = byId("compare-options-popover");
  const demoOptions = byId("compare-demo-options");
  const docsOptions = byId("compare-docs-options");

  const demoIdInput = byId("compare-demo-id-input");
  const demoIdBtn = byId("compare-demo-id-btn");
  const demoKInput = byId("compare-k-input");
  const demoEfInput = byId("compare-ef-input");

  const docsKInput = byId("compare-docs-k-input");
  const docsEfInput = byId("compare-docs-ef-input");

  const statusNotice = byId("compare-progress-status");
  const progressBar = byId("compare-progress-fill");
  const emptyStateBox = byId("compare-empty-state");
  const resultsView = byId("compare-results-view");
  const cardsContainer = byId("compare-cards-container");
  const rankTooltipEl = byId("compare-rank-tooltip");
  const footnoteIconSlot = byId("compare-footnote-icon");

  const heroHeadline = byId("compare-hero-headline");
  const heroSubtitle = byId("compare-hero-subtitle");
  const chipWinner = byId("compare-chip-winner");
  const chipSpeedup = byId("compare-chip-speedup");
  const chipRecall = byId("compare-chip-recall");

  if (footnoteIconSlot && !footnoteIconSlot.hasChildNodes()) {
    footnoteIconSlot.appendChild(createIcon("info", 14));
  }

  function showTooltip(cell, cellData) {
    if (!rankTooltipEl || !resultsView) return;
    const expectedText = cellData.expectedId !== null ? `#${cellData.expectedId}` : "-";
    const gotText = cellData.gotId !== null ? `#${cellData.gotId}` : "-";

    if (cellData.isMatch) {
      rankTooltipEl.replaceChildren(
        document.createTextNode(`Rank ${cellData.rank}: matched vector `),
        el("span", { className: "font-mono" }, expectedText)
      );
    } else {
      rankTooltipEl.replaceChildren(
        document.createTextNode(`Rank ${cellData.rank}: expected `),
        el("span", { className: "font-mono" }, expectedText),
        document.createTextNode(", got "),
        el("span", { className: "font-mono" }, gotText)
      );
    }

    const cellRect = cell.getBoundingClientRect();
    const containerRect = resultsView.getBoundingClientRect();
    let x = cellRect.left - containerRect.left + (cellRect.width / 2);
    let y = cellRect.top - containerRect.top - 28;

    if (y < 4) {
      y = cellRect.bottom - containerRect.top + 6;
    }

    const minX = 70;
    const maxX = Math.max(minX, containerRect.width - 70);
    x = Math.max(minX, Math.min(maxX, x));

    rankTooltipEl.style.left = `${Math.round(x)}px`;
    rankTooltipEl.style.top = `${Math.round(y)}px`;
    rankTooltipEl.style.transform = "translateX(-50%)";
    rankTooltipEl.classList.remove("hidden");
  }

  function hideTooltip() {
    if (!rankTooltipEl) return;
    rankTooltipEl.classList.add("hidden");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideTooltip();
    }
  });

  // Populate Options button icons
  const optionsIconSlot = optionsBtn?.querySelector(".compare-options-icon-slot");
  const optionsChevronSlot = optionsBtn?.querySelector(".compare-options-chevron-slot");
  if (optionsIconSlot && !optionsIconSlot.hasChildNodes()) {
    optionsIconSlot.appendChild(createIcon("sliders", 14));
  }
  if (optionsChevronSlot && !optionsChevronSlot.hasChildNodes()) {
    optionsChevronSlot.appendChild(createIcon("chevronDown", 12));
  }

  function toggleOptions(open) {
    if (!optionsPopover || !optionsBtn) return;
    const shouldOpen = open !== undefined ? open : optionsPopover.classList.contains("hidden");
    if (shouldOpen) {
      optionsPopover.classList.remove("hidden");
      optionsBtn.setAttribute("aria-expanded", "true");
      const isDocs = collDropdown.getValue() === "docs";
      const firstInput = isDocs ? docsKInput : demoKInput;
      firstInput?.focus();
    } else {
      optionsPopover.classList.add("hidden");
      optionsBtn.setAttribute("aria-expanded", "false");
    }
  }

  optionsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleOptions();
  });

  document.addEventListener("click", (e) => {
    if (!optionsPopover || optionsPopover.classList.contains("hidden")) return;
    if (!optionsPopover.contains(e.target) && !optionsBtn?.contains(e.target)) {
      toggleOptions(false);
    }
  });

  optionsPopover?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      toggleOptions(false);
      optionsBtn?.focus();
    }
  });

  const emptyIconSlot = byId("compare-empty-icon");
  if (emptyIconSlot && !emptyIconSlot.hasChildNodes()) {
    emptyIconSlot.appendChild(createIcon("activity", 32));
  }

  const emptyTitle = byId("compare-empty-title");
  const emptyDesc = byId("compare-empty-desc");
  const initialRunBtn = byId("compare-initial-run-btn");

  let currentDim = 128;
  let lastReportData = null;
  let currentMetricKey = "latency";

  function showResultsView() {
    emptyStateBox?.classList.add("hidden");
    resultsView?.classList.remove("hidden");
  }

  function showEmptyView() {
    emptyStateBox?.classList.remove("hidden");
    resultsView?.classList.add("hidden");
  }

  function updateCollectionVisibility() {
    const isDocs = collDropdown.getValue() === "docs";
    demoRandomBtn?.classList.toggle("hidden", isDocs);
    docsRunBtn?.classList.toggle("hidden", !isDocs);
    docsQueryWrap?.classList.toggle("hidden", !isDocs);
    demoOptions?.classList.toggle("hidden", isDocs);
    docsOptions?.classList.toggle("hidden", !isDocs);
    if (initialRunBtn) {
      initialRunBtn.textContent = isDocs ? "Benchmark Document Chunks" : "Benchmark Demo Vectors";
    }
  }

  function resetCompareView() {
    lastReportData = null;
    currentMetricKey = "latency";
    hideTooltip();
    cardsContainer?.replaceChildren();
    if (statusNotice) statusNotice.textContent = "Ready to benchmark.";
    if (progressBar) {
      progressBar.classList.remove("running");
      progressBar.style.setProperty("width", "0%");
    }
  }

  function showDefaultEmptyState(title, desc) {
    if (!emptyStateBox) return;
    const isDocs = collDropdown.getValue() === "docs";
    if (emptyTitle) emptyTitle.textContent = title || "No benchmark yet";
    if (emptyDesc) emptyDesc.textContent = desc || "Run a benchmark to see latency, distance computations, recall and the top-k diff.";
    if (initialRunBtn) {
      initialRunBtn.textContent = isDocs ? "Benchmark Document Chunks" : "Benchmark Demo Vectors";
      initialRunBtn.classList.remove("hidden");
    }
    demoRandomBtn?.removeAttribute("disabled");
    demoIdBtn?.removeAttribute("disabled");
    docsRunBtn?.removeAttribute("disabled");
    showEmptyView();
  }

  async function checkCollectionStats() {
    clearGlobalError();
    const coll = collDropdown.getValue() || "demo";
    const isDocs = coll === "docs";
    try {
      let count = 0;
      if (isDocs) {
        const docsRes = await api.getDocs();
        count = docsRes.documents?.length || 0;
      } else {
        const stats = await api.getStats();
        currentDim = stats.dimension || 128;
        count = stats.count || 0;
      }

      const emptyCfg = getCompareEmptyStateConfig(coll, count, Boolean(lastReportData));

      if (count === 0) {
        resetCompareView();
        showEmptyNotice(emptyCfg.title, emptyCfg.description);
        return false;
      }

      if (!lastReportData) {
        showDefaultEmptyState(emptyCfg.title, emptyCfg.description);
      } else {
        showResultsView();
      }
      return true;
    } catch (err) {
      showGlobalError(err.code, err.message);
      return false;
    }
  }

  function showEmptyNotice(title, msg) {
    if (emptyTitle) emptyTitle.textContent = title || "Collection is empty";
    if (emptyDesc) emptyDesc.textContent = msg;
    if (initialRunBtn) initialRunBtn.classList.add("hidden");
    demoRandomBtn?.setAttribute("disabled", "true");
    demoIdBtn?.setAttribute("disabled", "true");
    docsRunBtn?.setAttribute("disabled", "true");
    if (statusNotice) statusNotice.textContent = "Ready to benchmark.";
    if (progressBar) {
      progressBar.classList.remove("running");
      progressBar.style.setProperty("width", "0%");
    }
    showEmptyView();
  }

  function generateRandomVector() {
    return Array.from({ length: currentDim }, () => (Math.random() - 0.5) * 2);
  }

  async function runBenchmarkSuite(getPayloadFn, isDocs) {
    clearGlobalError();
    resultsView?.classList.add("hidden");
    if (progressBar) {
      progressBar.classList.add("running");
      progressBar.style.setProperty("width", "0%");
    }
    const ready = await checkCollectionStats();
    if (!ready) {
      progressBar?.classList.remove("running");
      return;
    }

    const repeatCount = parseInt(repeatDropdown.getValue() || "5", 10);
    const latencies = { brute: [], kdtree: [], hnsw: [] };
    let lastReport = null;

    try {
      // 1. Warm-up pass if repeatCount > 1 (discards KD-tree lazy build overhead)
      if (repeatCount > 1) {
        if (statusNotice) statusNotice.textContent = "Running warm-up pass (KD-Tree lazy construction)...";
        if (progressBar) progressBar.style.setProperty("width", "5%");
        const warmupPayload = await getPayloadFn();
        if (isDocs) {
          await api.benchmarkDocs(warmupPayload);
        } else {
          await api.benchmark(warmupPayload);
        }
      }

      // 2. Sequential timed repetitions
      for (let i = 1; i <= repeatCount; i++) {
        if (statusNotice) {
          statusNotice.textContent = `Running iteration ${i} of ${repeatCount}...`;
        }
        if (progressBar) {
          progressBar.style.setProperty("width", `${Math.round((i / repeatCount) * 100)}%`);
        }
        const payload = await getPayloadFn();
        const report = isDocs
          ? await api.benchmarkDocs(payload)
          : await api.benchmark(payload);

        lastReport = report;
        const algs = report.algorithms || {};
        if (algs.brute) latencies.brute.push(algs.brute.latency_us);
        if (algs.kdtree) latencies.kdtree.push(algs.kdtree.latency_us);
        if (algs.hnsw) latencies.hnsw.push(algs.hnsw.latency_us);
      }

      if (statusNotice) {
        statusNotice.textContent = `Completed ${repeatCount} benchmark run${repeatCount > 1 ? "s" : ""}.`;
      }
      if (progressBar) progressBar.style.setProperty("width", "100%");

      // Return progress line to muted when finished (no permanent amber)
      setTimeout(() => {
        if (progressBar) {
          progressBar.classList.remove("running");
          progressBar.style.setProperty("width", "0%");
        }
      }, 350);

      renderReport(lastReport, latencies);
    } catch (err) {
      if (statusNotice) statusNotice.textContent = "Benchmark failed.";
      if (progressBar) {
        progressBar.classList.remove("running");
        progressBar.style.setProperty("width", "0%");
      }
      showGlobalError(err.code, err.message);
    }
  }

  function renderReport(report, latencies) {
    if (!report || !report.algorithms) return;
    lastReportData = { report, latencies };
    showResultsView();

    // 1. Update Hero Callout Banner
    const repeatCount = parseInt(repeatDropdown?.getValue() || "5", 10);
    const headlineData = buildCompareHeadline(report, latencies, { repetitions: repeatCount });

    if (heroHeadline) {
      if (headlineData.isBruteFastest) {
        heroHeadline.textContent = `Brute Force was fastest on this collection (${headlineData.vectorCount.toLocaleString()} vectors)`;
      } else {
        heroHeadline.textContent = `${headlineData.fastestLabel} delivered ${headlineData.ratioText} speedup over Brute Force`;
      }
    }
    if (heroSubtitle) {
      heroSubtitle.textContent = `k = ${headlineData.k} · ${headlineData.vectorCount.toLocaleString()} vectors · ${repeatCount} run${repeatCount > 1 ? "s" : ""} median`;
    }
    if (chipWinner) chipWinner.textContent = `Fastest: ${headlineData.fastestLabel}`;
    if (chipSpeedup) chipSpeedup.textContent = `${headlineData.ratioText} Speedup`;
    if (chipRecall) chipRecall.textContent = `${headlineData.recallPercent} Recall`;

    renderMetricSwitcher(report, latencies, headlineData);
  }

  function renderMetricSwitcher(report, latencies, headlineData) {
    if (!cardsContainer) return;
    cardsContainer.replaceChildren();

    const cardModels = mapReportToCards(report, latencies);
    if (!cardModels || cardModels.length === 0) return;

    const bruteCard = cardModels.find(c => c.alg === "brute") || cardModels[0];
    const bruteMed = bruteCard ? Math.max(1, bruteCard.medianUs) : 1;
    const bruteDist = bruteCard ? Math.max(1, bruteCard.distanceComputations) : 1;

    // Outer frame for the metric switcher
    const frameEl = el("div", { className: "compare-metric-switcher-frame" });

    // 1. Accessible Segmented Control Bar (tablist)
    const tablistEl = el("div", {
      className: "compare-segmented-bar",
      role: "tablist",
      "aria-label": "Benchmark metric selection"
    });

    METRIC_SWITCHER_TABS.forEach((tab, idx) => {
      const isActive = tab.key === currentMetricKey;
      const tabBtn = el("button", {
        type: "button",
        role: "tab",
        id: `compare-tab-${tab.key}`,
        className: `compare-segmented-btn${isActive ? " active" : ""}`,
        "aria-selected": String(isActive),
        "aria-controls": "compare-rows-panel",
        tabIndex: isActive ? 0 : -1
      }, tab.label);

      tabBtn.addEventListener("click", () => {
        if (currentMetricKey === tab.key) return;
        currentMetricKey = tab.key;
        renderMetricSwitcher(report, latencies, headlineData);
        const newTab = document.getElementById(`compare-tab-${tab.key}`);
        newTab?.focus();
      });

      tabBtn.addEventListener("keydown", (e) => {
        const nextIdx = handleSegmentedKeyNav(e, idx, METRIC_SWITCHER_TABS.length);
        if (nextIdx !== null) {
          e.preventDefault();
          const targetTab = METRIC_SWITCHER_TABS[nextIdx];
          currentMetricKey = targetTab.key;
          renderMetricSwitcher(report, latencies, headlineData);
          const newTab = document.getElementById(`compare-tab-${targetTab.key}`);
          newTab?.focus();
        }
      });

      tablistEl.appendChild(tabBtn);
    });

    frameEl.appendChild(tablistEl);

    // 2. Horizontal Rows Container (tabpanel)
    const rowsContainer = el("div", {
      id: "compare-rows-panel",
      className: "compare-rows-container",
      role: "tabpanel",
      "aria-labelledby": `compare-tab-${currentMetricKey}`
    });

    // Compute cards enriched with shared scale bar widths
    const enrichedCards = computeSharedMetricBars(currentMetricKey, cardModels);

    for (const card of enrichedCards) {
      const alg = card.alg;
      const isWinner = (alg === headlineData.fastestKey);

      // Left Column: Dot + Name + Subtitle
      let subText = "Exact Baseline";
      if (alg === "kdtree") subText = "Spatial Partition";
      if (alg === "hnsw") subText = "Hierarchical Graph";

      const dotEl = el("span", { className: `compare-alg-dot dot-${alg}` });
      const nameEl = el("span", { className: "switcher-alg-name" }, card.label);
      const subEl = el("span", { className: "switcher-alg-sub text-muted" }, subText);
      const leftCol = el("div", { className: "switcher-alg-col" },
        el("div", { className: "switcher-alg-header" }, dotEl, nameEl),
        subEl
      );

      // Center Column: Thick bar on shared linear scale + optional rank cells for Accuracy
      const fillEl = el("div", {
        className: `switcher-bar-fill fill-${alg}`,
        style: `width: ${card.barWidthPct}%;`
      });
      const trackEl = el("div", { className: "switcher-bar-track" }, fillEl);
      const centerCol = el("div", { className: "switcher-bar-col" }, trackEl);

      if (currentMetricKey === "accuracy") {
        let rankContent;
        if (card.isBrute) {
          rankContent = el("div", { className: "switcher-rank-strip-wrap" },
            el("span", { className: "switcher-rank-ref text-muted text-xs" }, "Reference for the other algorithms")
          );
        } else {
          const stripEl = el("div", {
            className: "compare-rank-strip-flex",
            role: "group",
            "aria-label": `${card.total} rank match indicators`
          });

          for (const cellData of (card.rankStrip || [])) {
            const expectedText = cellData.expectedId !== null ? `#${cellData.expectedId}` : "-";
            const gotText = cellData.gotId !== null ? `#${cellData.gotId}` : "-";
            const ariaLabel = cellData.isMatch
              ? `Rank ${cellData.rank}: matched vector ${expectedText}`
              : `Rank ${cellData.rank}: expected ${expectedText}, got ${gotText}`;

            const cellEl = el("span", {
              className: `compare-rank-cell ${cellData.isMatch ? `filled fill-${alg}` : "empty"}`,
              tabIndex: 0,
              "aria-label": ariaLabel
            });

            cellEl.addEventListener("mouseenter", () => showTooltip(cellEl, cellData));
            cellEl.addEventListener("mouseleave", hideTooltip);
            cellEl.addEventListener("focus", () => showTooltip(cellEl, cellData));
            cellEl.addEventListener("blur", hideTooltip);
            cellEl.addEventListener("keydown", (e) => {
              if (e.key === "Escape") {
                hideTooltip();
                cellEl.blur();
              }
            });

            stripEl.appendChild(cellEl);
          }

          rankContent = el("div", { className: "switcher-rank-strip-wrap" }, stripEl);
        }
        centerCol.appendChild(rankContent);
      }

      // Right Column: Large tabular number, sublabel, and speed/prune tag
      let rightCol;
      if (currentMetricKey === "latency") {
        const speedText = card.isBrute ? "1.0x (Baseline)" : formatSpeedComparison(card.medianUs, bruteMed);
        rightCol = el("div", { className: "switcher-metric-end" },
          el("span", { className: `switcher-val font-mono${isWinner ? " text-accent" : ""}` }, `${card.medianUs} µs`),
          el("span", { className: "switcher-range text-muted font-mono" }, `Range ${card.rangeText}`),
          el("span", { className: `switcher-tag${isWinner ? " tag-winner" : ""}` }, speedText)
        );
      } else if (currentMetricKey === "work") {
        const pruneText = formatPrunedText(card.isBrute, card.distanceComputations, bruteDist);
        rightCol = el("div", { className: "switcher-metric-end" },
          el("span", { className: "switcher-val font-mono" }, card.distanceComputations.toLocaleString()),
          el("span", { className: "switcher-num-sub text-muted" }, "computations"),
          el("span", { className: "switcher-tag" }, pruneText)
        );
      } else {
        // Accuracy
        rightCol = el("div", { className: "switcher-metric-end" },
          el("span", { className: "switcher-val font-mono" }, card.recallPercent),
          el("span", { className: "switcher-num-sub text-muted" }, "Recall @ k"),
          el("span", { className: "switcher-tag font-mono text-muted text-xs" },
            card.isBrute ? `k = ${card.total}` : `${card.sameCount} / ${card.total} matched`
          )
        );
      }

      const rowEl = el("div", {
        className: `compare-metric-row row-${alg}`,
        role: "region",
        "aria-label": `${card.label} ${currentMetricKey}`
      }, leftCol, centerCol, rightCol);

      rowsContainer.appendChild(rowEl);
    }

    frameEl.appendChild(rowsContainer);
    cardsContainer.appendChild(frameEl);
  }

  // Event Handlers
  demoRandomBtn?.addEventListener("click", () => {
    withButtonBusy(demoRandomBtn, async () => {
      const k = parseInt(demoKInput?.value || "10", 10);
      const ef = parseInt(demoEfInput?.value || "50", 10);
      await runBenchmarkSuite(async () => ({ vector: generateRandomVector(), k, ef }), false);
    });
  });

  demoIdBtn?.addEventListener("click", () => {
    const id = parseInt(demoIdInput?.value || "0", 10);
    if (!id || id <= 0) return showGlobalError("validation_error", "Valid Vector ID required");

    withButtonBusy(demoIdBtn, async () => {
      const vecRes = await api.getVector(id);
      const k = parseInt(demoKInput?.value || "10", 10);
      const ef = parseInt(demoEfInput?.value || "50", 10);
      await runBenchmarkSuite(async () => ({ vector: vecRes.vector, k, ef }), false);
    });
  });

  docsRunBtn?.addEventListener("click", () => {
    const query = docsQueryInput?.value?.trim();
    if (!query) return showGlobalError("validation_error", "Query must not be empty");

    withButtonBusy(docsRunBtn, async () => {
      const k = parseInt(docsKInput?.value || "5", 10);
      const ef = parseInt(docsEfInput?.value || "50", 10);
      await runBenchmarkSuite(async () => ({ query, k, ef }), true);
    });
  });

  function onTabActivated() {
    checkCollectionStats();
    if (lastReportData) {
      renderReport(lastReportData.report, lastReportData.latencies);
    }
  }

  byId("tab-btn-compare")?.addEventListener("click", onTabActivated);

  const panelCompare = byId("panel-compare");
  if (panelCompare && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          if (!panelCompare.classList.contains("hidden")) {
            onTabActivated();
          }
        }
      }
    });
    observer.observe(panelCompare, { attributes: true, attributeFilter: ["class"] });
  }

  window.addEventListener("focus", () => {
    if (panelCompare && !panelCompare.classList.contains("hidden")) {
      onTabActivated();
    }
  });

  initialRunBtn?.addEventListener("click", () => {
    const isDocs = collDropdown.getValue() === "docs";
    if (isDocs) {
      docsRunBtn?.click();
    } else {
      demoRandomBtn?.click();
    }
  });

  updateCollectionVisibility();
  checkCollectionStats();
}
