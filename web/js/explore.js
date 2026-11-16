/**
 * VectorDB 2D PCA Explore Controller
 */
import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { Viewport2D, setupCanvasDpr } from "./canvas.js";
import { el, formatSimilarity, createDropdown } from "./ui.js";
import { createIcon } from "./icons.js";
import { getDocColor, computeBounds, findHitPoint, drawStar, getExploreCanvasSubtitle, isExploreActionDisabled } from "./explore_helpers.js";
import { isCanvasDrawable } from "./hnsw_helpers.js";
import { THEME } from "./colors.js";

export function initExploreTab() {
  const canvas = document.getElementById("explore-canvas");
  if (!canvas) return;
  const canvasFrame = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const byId = (id) => document.getElementById(id);

  const collDropdownWrap = byId("explore-coll-dropdown-wrap");
  let collDropdown = null;
  const urlParams = new URLSearchParams(window.location.search);
  const initialColl = urlParams.get("coll") === "docs" ? "docs" : "demo";

  if (collDropdownWrap) {
    collDropdown = createDropdown(
      [
        { value: "demo", label: "Demo Vectors" },
        { value: "docs", label: "Document Chunks" }
      ],
      initialColl,
      () => { loadData(); },
      { id: "explore-coll-select", ariaLabel: "Select collection" }
    );
    collDropdownWrap.replaceChildren(collDropdown.element);
  }

  const collSelect = byId("explore-coll-select");
  if (collSelect && !collDropdown) {
    collSelect.value = initialColl;
  }
  const refreshBtn = byId("explore-refresh-btn");
  const queryDocsForm = byId("explore-query-docs-form"), queryDocsInput = byId("explore-query-docs-input");
  const queryDocsK = byId("explore-query-docs-k"), queryDocsBtn = byId("explore-query-docs-btn");
  const queryDemoRandomBtn = byId("explore-demo-random-btn"), queryDemoIdInput = byId("explore-demo-id-input");
  const queryDemoIdBtn = byId("explore-demo-id-btn"), queryDemoK = byId("explore-demo-k");

  const resultsTableBody = byId("explore-results-tbody"), varianceNote = byId("explore-variance-note");
  const legendContainer = byId("explore-legend-container"), emptyStateBox = byId("explore-empty-state");
  const tooltip = byId("explore-tooltip");

  const viewport = new Viewport2D(canvas.width, canvas.height, 45);
  let currentPoints = [], explainedRatios = [0, 0], queryStar = null, topKResults = [];
  let hoveredPoint = null, isDragging = false, dragStart = { x: 0, y: 0 }, currentDim = 128;

  async function loadData() {
    clearGlobalError();
    emptyStateBox?.classList.add("hidden");
    hoveredPoint = null; queryStar = null; topKResults = [];
    resultsTableBody?.replaceChildren();
    if (varianceNote) varianceNote.textContent = "";

    const isDocs = collSelect ? collSelect.value === "docs" : false;
    byId("explore-docs-controls")?.classList.toggle("hidden", !isDocs);
    byId("explore-demo-controls")?.classList.toggle("hidden", isDocs);

    const subtitleEl = document.getElementById("explore-canvas-subtitle") || document.querySelector("#panel-explore .canvas-panel-subtitle");
    if (subtitleEl) {
      subtitleEl.textContent = getExploreCanvasSubtitle(collSelect ? collSelect.value : "demo");
    }

    try {
      const data = isDocs ? await api.getDocsPca(5000) : await api.getPca(5000);
      currentPoints = data.points || [];
      explainedRatios = data.explained_ratio || [0, 0];
      currentDim = data.dim || 128;

      const count = currentPoints.length;
      const actionsDisabled = isExploreActionDisabled(count);
      if (queryDemoRandomBtn) queryDemoRandomBtn.disabled = actionsDisabled;
      if (queryDemoIdBtn) queryDemoIdBtn.disabled = actionsDisabled;
      if (queryDocsBtn) queryDocsBtn.disabled = isDocs && actionsDisabled;

      if (count === 0) {
        showEmptyState(isDocs);
      } else {
        const bounds = computeBounds(currentPoints);
        viewport.fitBounds(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
        updateVarianceNotice(count, explainedRatios);
        updateLegend(isDocs, currentPoints);
      }
      render();
    } catch (err) {
      showGlobalError(err.code, `Failed to load PCA data: ${err.message}`);
    }
  }

  function showEmptyState(isDocs) {
    if (varianceNote) varianceNote.textContent = "";
    if (legendContainer) legendContainer.replaceChildren();
    if (!emptyStateBox) return;
    emptyStateBox.classList.remove("hidden");
    if (isDocs) {
      emptyStateBox.replaceChildren(
        el("div", { className: "empty-state" },
          el("h3", { className: "empty-state-title" }, "No documents yet"),
          el("p", { className: "empty-state-description" }, "No documents ingested yet. Go to Ask tab to ingest documents.")
        )
      );
    } else {
      const countInput = el("input", { type: "number", className: "input-text", value: "1000", min: "10", max: "20000" });
      const insertBtn = el("button", { type: "button", className: "btn btn-secondary" }, "Insert 1,000 vectors");
      insertBtn.addEventListener("click", async () => {
        const count = parseInt(countInput.value, 10) || 1000;
        await withButtonBusy(insertBtn, async () => {
          try { await api.insertDemoRandom(count); await loadData(); } catch (err) { showGlobalError(err.code, err.message); }
        });
      });
      emptyStateBox.replaceChildren(
        el("div", { className: "empty-state" },
          el("h3", { className: "empty-state-title" }, "Demo collection is empty"),
          el("p", { className: "empty-state-description" }, "Insert synthetic demo vectors to explore 2D PCA space."),
          el("div", { className: "form-row mt-3 justify-center" }, countInput, insertBtn)
        )
      );
    }
  }

  function updateVarianceNotice(count, ratios) {
    if (!varianceNote) return;
    const r1 = ((ratios[0] || 0) * 100).toFixed(1), r2 = ((ratios[1] || 0) * 100).toFixed(1);
    const sum = (((ratios[0] || 0) + (ratios[1] || 0)) * 100).toFixed(1);
    let text = `Explained variance (PCA, 2D): ${sum}% (PC1: ${r1}%, PC2: ${r2}%)`;
    if (count < 10) text += " — Note: PCA projection is not statistically meaningful with fewer than 10 vectors.";
    varianceNote.textContent = text;

    const totalEl = byId("explore-total-variance-val");
    if (totalEl) totalEl.textContent = `${sum}%`;
    const pc1El = byId("explore-pc1-variance-val");
    if (pc1El) pc1El.textContent = `${r1}%`;
    const pc2El = byId("explore-pc2-variance-val");
    if (pc2El) pc2El.textContent = `${r2}%`;
    const pc1Bar = byId("explore-pc1-bar");
    if (pc1Bar) pc1Bar.style.setProperty("width", `${Math.min(100, Math.max(0, (ratios[0] || 0) * 100))}%`);
    const pc2Bar = byId("explore-pc2-bar");
    if (pc2Bar) pc2Bar.style.setProperty("width", `${Math.min(100, Math.max(0, (ratios[1] || 0) * 100))}%`);
    const countBadge = byId("explore-points-count-badge");
    const isDocs = collSelect ? collSelect.value === "docs" : false;
    if (countBadge) countBadge.textContent = isDocs ? `${count} Chunks` : `${count} Vectors`;
  }

  function updateLegend(isDocs, points) {
    if (!legendContainer) return;
    legendContainer.replaceChildren();
    if (!isDocs) {
      const swatch = el("span", { className: "legend-swatch" });
      swatch.style.setProperty("background-color", THEME.accent);
      legendContainer.replaceChildren(
        el("div", { className: "legend-item" }, swatch, el("span", {}, `Vectors (${points.length})`))
      );
      return;
    }
    const docMap = new Map();
    points.forEach(pt => {
      const key = pt.doc_id !== undefined ? pt.doc_id : "unknown";
      if (!docMap.has(key)) {
        docMap.set(key, { title: pt.title || `Doc ${pt.doc_id}`, count: 0, docId: pt.doc_id });
      }
      docMap.get(key).count++;
    });
    const items = Array.from(docMap.values()).map(doc => {
      const swatch = el("span", { className: "legend-swatch" });
      swatch.style.setProperty("background-color", getDocColor(doc.docId));
      return el("div", { className: "legend-item" }, swatch, el("span", {}, `${doc.title} (${doc.count})`));
    });
    legendContainer.replaceChildren(...items);
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    if (!isCanvasDrawable(rect.width, rect.height)) return;

    const { width, height } = setupCanvasDpr(canvas, ctx);
    if (!isCanvasDrawable(width, height)) return;

    viewport.width = width; viewport.height = height;
    ctx.clearRect(0, 0, width, height);

    // Axes
    const orig = viewport.toScreen(0, 0);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, orig.y); ctx.lineTo(width, orig.y);
    ctx.moveTo(orig.x, 0); ctx.lineTo(orig.x, height);
    ctx.stroke();

    // Axis Ticks & Tick Labels
    ctx.fillStyle = THEME.textMuted;
    ctx.font = "11px 'IBM Plex Sans', -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Ticks along X-axis
    for (let xVal = -0.6; xVal <= 0.65; xVal += 0.2) {
      const scr = viewport.toScreen(xVal, 0);
      if (scr.x >= 30 && scr.x <= width - 30) {
        ctx.beginPath();
        ctx.moveTo(scr.x, orig.y);
        ctx.lineTo(scr.x, orig.y + 4);
        ctx.stroke();
        const lbl = Math.abs(xVal) < 0.001 ? "0.0" : xVal.toFixed(1);
        ctx.fillText(lbl, scr.x, Math.min(Math.max(orig.y + 7, 15), height - 18));
      }
    }

    // Ticks along Y-axis
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let yVal = -0.6; yVal <= 0.65; yVal += 0.2) {
      if (Math.abs(yVal) < 0.001) continue; // 0.0 handled
      const scr = viewport.toScreen(0, yVal);
      if (scr.y >= 20 && scr.y <= height - 20) {
        ctx.beginPath();
        ctx.moveTo(orig.x - 4, scr.y);
        ctx.lineTo(orig.x, scr.y);
        ctx.stroke();
        ctx.fillText(yVal.toFixed(1), Math.max(orig.x - 7, 24), scr.y);
      }
    }

    // Axis Titles (PC1 & PC2)
    ctx.fillStyle = THEME.textSecondary;
    ctx.font = "12px 'IBM Plex Sans', -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("PC1", width / 2, height - 6);

    ctx.save();
    ctx.translate(14, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("PC2", 0, 0);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const isDocs = collSelect ? collSelect.value === "docs" : false;
    for (let i = 0; i < currentPoints.length; i++) {
      const pt = currentPoints[i];
      const scr = viewport.toScreen(pt.x, pt.y);
      if (scr.x < -10 || scr.x > width + 10 || scr.y < -10 || scr.y > height + 10) continue;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isDocs ? getDocColor(pt.doc_id) : THEME.accent;
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (queryStar && topKResults.length > 0) {
      const qScr = viewport.toScreen(queryStar.x, queryStar.y);
      for (let i = 0; i < topKResults.length; i++) {
        const res = topKResults[i];
        const rScr = viewport.toScreen(res.x, res.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(qScr.x, qScr.y); ctx.lineTo(rScr.x, rScr.y); ctx.stroke();
        ctx.strokeStyle = THEME.accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(rScr.x, rScr.y, 6.5, 0, Math.PI * 2); ctx.stroke();

        // Node ID label next to ring as in mockup (e.g. 102, 087, 215)
        const idLabel = `#${res.id ?? (res.chunk_index !== undefined ? res.chunk_index : i + 1)}`;
        ctx.fillStyle = THEME.textPrimary;
        ctx.font = "11px 'IBM Plex Sans', -apple-system, sans-serif";
        ctx.fillText(idLabel, rScr.x + 9, rScr.y + 4);
      }
      ctx.fillStyle = THEME.accent; ctx.strokeStyle = THEME.bgCanvas; ctx.lineWidth = 1.5;
      drawStar(ctx, qScr.x, qScr.y, 5, 9, 4.5);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = THEME.textPrimary;
      ctx.font = "11px 'IBM Plex Sans', -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Query", qScr.x, qScr.y + 16);
      ctx.textAlign = "left";
    }

    if (hoveredPoint) {
      const hScr = viewport.toScreen(hoveredPoint.x, hoveredPoint.y);
      ctx.strokeStyle = THEME.textPrimary; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hScr.x, hScr.y, 6.5, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function renderTable(results, isDocs) {
    if (!resultsTableBody) return;
    resultsTableBody.replaceChildren();
    const heading = byId("explore-results-heading");
    const kVal = isDocs ? (queryDocsK ? queryDocsK.value : 3) : (queryDemoK ? queryDemoK.value : 3);
    if (heading) heading.textContent = `Nearest neighbours (k = ${kVal})`;

    const badge = byId("explore-results-badge");
    if (badge) {
      if (queryStar) {
        badge.textContent = isDocs ? "Doc Query" : (queryDemoIdInput && queryDemoIdInput.value ? `Vector #${queryDemoIdInput.value}` : "Random Vector");
      } else {
        badge.textContent = "Live Query";
      }
    }

    if (!results || results.length === 0) {
      const emptyRow = el("tr", {},
        el("td", { colSpan: 4, className: "text-muted empty-state" },
          el("div", { className: "empty-feed-graphic" },
            el("div", { className: "empty-feed-icon" }, "\u25C9"),
            el("div", { className: "empty-feed-title" }, "No Active Query"),
            el("div", { className: "empty-feed-desc" }, "Click \"Project Random Query\" or click any dot on the 2D canvas to inspect top nearest neighbors.")
          )
        )
      );
      resultsTableBody.appendChild(emptyRow);
      return;
    }

    const rows = results.map((r, i) => {
      const docTitle = isDocs ? (r.title || `Doc ${r.doc_id}`) : `Vector #${r.id}`;
      const chunkSub = isDocs ? `Chunk #${r.chunk_index}` : `ID: ${r.id}`;
      const distStr = r.distance !== undefined ? r.distance.toFixed(4) : "-";
      const simStr = formatSimilarity(r.similarity);
      const simNum = (r.similarity !== null && r.similarity !== undefined) ? Math.min(100, Math.max(0, r.similarity * 100)) : 0;

      const rankBadge = el("span", { className: `neighbor-rank-badge ${i === 0 ? "rank-top" : ""}` }, `#${i + 1}`);

      const simVal = el("span", { className: "sim-val-text font-mono" }, simStr);
      const simFill = el("div", { className: "sim-meter-fill" });
      simFill.style.setProperty("width", `${simNum.toFixed(1)}%`);
      const simTrack = el("div", { className: "sim-meter-track" }, simFill);
      const simCellContent = el("div", { className: "sim-cell-wrap" }, simVal, simTrack);

      const row = el("tr", { className: "explore-neighbor-row" },
        el("td", { className: "neighbor-rank-cell" }, rankBadge),
        el("td", { className: "neighbor-target-cell" },
          el("div", { className: "neighbor-target-meta" },
            createIcon(isDocs ? "document" : "database", 14, "neighbor-icon-svg"),
            el("div", { className: "neighbor-info" },
              el("span", { className: "neighbor-title" }, docTitle),
              el("span", { className: "neighbor-sub" }, chunkSub)
            )
          )
        ),
        el("td", { className: "neighbor-dist-cell font-mono" }, distStr),
        el("td", { className: "neighbor-sim-cell" }, simCellContent)
      );

      row.addEventListener("click", () => {
        hoveredPoint = currentPoints.find(p => isDocs ? (p.doc_id === r.doc_id && p.chunk_index === r.chunk_index) : (p.id === r.id)) || r;
        const targetIdEl = byId("explore-inspector-target-id");
        if (targetIdEl) targetIdEl.textContent = isDocs ? `Doc ${r.doc_id || r.id}` : `Vector #${r.id}`;
        const pc1El = byId("inspector-stat-pc1");
        if (pc1El && r.x !== undefined) pc1El.textContent = r.x.toFixed(3);
        const pc2El = byId("inspector-stat-pc2");
        if (pc2El && r.y !== undefined) pc2El.textContent = r.y.toFixed(3);
        const distEl = byId("inspector-stat-dist");
        if (distEl && r.distance !== undefined) distEl.textContent = r.distance.toFixed(4);
        const simEl = byId("inspector-stat-sim");
        if (simEl) simEl.textContent = formatSimilarity(r.similarity);
        render();
      });

      return row;
    });
    resultsTableBody.replaceChildren(...rows);

    if (results && results.length > 0) {
      const top = results[0];
      const targetIdEl = byId("explore-inspector-target-id");
      if (targetIdEl) targetIdEl.textContent = isDocs ? `Doc ${top.doc_id || top.id}` : `Vector #${top.id}`;
      const pc1El = byId("inspector-stat-pc1");
      if (pc1El) pc1El.textContent = top.x !== undefined ? top.x.toFixed(3) : "-";
      const pc2El = byId("inspector-stat-pc2");
      if (pc2El) pc2El.textContent = top.y !== undefined ? top.y.toFixed(3) : "-";
      const distEl = byId("inspector-stat-dist");
      if (distEl) distEl.textContent = top.distance !== undefined ? top.distance.toFixed(4) : "-";
      const simEl = byId("inspector-stat-sim");
      if (simEl) simEl.textContent = formatSimilarity(top.similarity);
    }
  }

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    viewport.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 0.85);
    render();
  }, { passive: false });

  let mouseDownPos = { x: 0, y: 0 };
  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    mouseDownPos = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("mouseup", (e) => {
    if (isDragging) {
      const dx = Math.abs(e.clientX - mouseDownPos.x);
      const dy = Math.abs(e.clientY - mouseDownPos.y);
      if (dx < 5 && dy < 5 && hoveredPoint) {
        const isDocs = collSelect ? collSelect.value === "docs" : false;
        if (!isDocs && hoveredPoint.id) {
          if (queryDemoIdInput) queryDemoIdInput.value = hoveredPoint.id;
          if (queryDemoIdBtn) queryDemoIdBtn.click();
        }
      }
    }
    isDragging = false;
  });
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    if (isDragging) {
      viewport.pan(e.clientX - dragStart.x, e.clientY - dragStart.y);
      dragStart = { x: e.clientX, y: e.clientY };
      render(); return;
    }
    const hit = findHitPoint(e.clientX - rect.left, e.clientY - rect.top, currentPoints, viewport, 8);
    if (hit !== hoveredPoint) {
      hoveredPoint = hit;
      if (hoveredPoint) {
        const isDocs = collSelect ? collSelect.value === "docs" : false;
        const targetIdEl = byId("explore-inspector-target-id");
        if (targetIdEl) targetIdEl.textContent = isDocs ? `Doc ${hoveredPoint.doc_id}` : `Vector #${hoveredPoint.id}`;
        const pc1El = byId("inspector-stat-pc1");
        if (pc1El && hoveredPoint.x !== undefined) pc1El.textContent = hoveredPoint.x.toFixed(3);
        const pc2El = byId("inspector-stat-pc2");
        if (pc2El && hoveredPoint.y !== undefined) pc2El.textContent = hoveredPoint.y.toFixed(3);
      }
      render();
    }
    if (hoveredPoint && tooltip) {
      const isDocs = collSelect.value === "docs";
      tooltip.textContent = isDocs ? `[Doc ${hoveredPoint.doc_id}] ${hoveredPoint.title || ""}\nChunk ${hoveredPoint.chunk_index}` : `Vector ID: ${hoveredPoint.id}`;
      tooltip.style.setProperty("left", `${e.clientX + 12}px`);
      tooltip.style.setProperty("top", `${e.clientY + 12}px`);
      tooltip.classList.remove("hidden");
    } else { tooltip?.classList.add("hidden"); }
  });

  const resetViewBtn = byId("explore-reset-view-btn");
  resetViewBtn?.addEventListener("click", () => {
    const b = computeBounds(currentPoints);
    viewport.fitBounds(b.minX, b.maxX, b.minY, b.maxY);
    render();
  });

  canvas.addEventListener("dblclick", () => {
    const b = computeBounds(currentPoints);
    viewport.fitBounds(b.minX, b.maxX, b.minY, b.maxY);
    render();
  });

  queryDocsForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = queryDocsInput.value.trim();
    if (!query) return;
    await withButtonBusy(queryDocsBtn, async () => {
      try {
        const res = await api.queryDocsPca({ query, k: parseInt(queryDocsK.value, 10) || 5 });
        queryStar = res.query_projected || null; topKResults = res.results || [];
        renderTable(topKResults, true); render();
      } catch (err) { showGlobalError(err.code, err.message); }
    });
  });

  queryDemoRandomBtn?.addEventListener("click", async () => {
    const vec = Array.from({ length: currentDim }, () => (Math.random() - 0.5) * 2);
    await withButtonBusy(queryDemoRandomBtn, async () => {
      try {
        const res = await api.queryPca({ vector: vec, k: parseInt(queryDemoK.value, 10) || 5 });
        queryStar = res.query_projected || null; topKResults = res.results || [];
        renderTable(topKResults, false); render();
      } catch (err) { showGlobalError(err.code, err.message); }
    });
  });

  queryDemoIdBtn?.addEventListener("click", async () => {
    const id = parseInt(queryDemoIdInput.value, 10);
    if (isNaN(id) || id <= 0) return showGlobalError("validation_error", "Valid ID required");
    await withButtonBusy(queryDemoIdBtn, async () => {
      try {
        const stored = await api.getVector(id);
        const res = await api.queryPca({ vector: stored.vector, k: parseInt(queryDemoK.value, 10) || 5 });
        queryStar = res.query_projected || null; topKResults = res.results || [];
        renderTable(topKResults, false); render();
      } catch (err) { showGlobalError(err.code, err.message); }
    });
  });

  let resizeRaf = null;
  function scheduleResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      render();
    });
  }

  const ro = new ResizeObserver(scheduleResize);
  if (canvasFrame) ro.observe(canvasFrame);

  collSelect?.addEventListener("change", loadData);
  refreshBtn?.addEventListener("click", loadData);
  byId("tab-btn-explore")?.addEventListener("click", () => {
    requestAnimationFrame(() => {
      render();
      loadData();
    });
  });
  const presetBtns = document.querySelectorAll(".btn-k-preset");
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const k = btn.dataset.preset;
      if (queryDemoK) queryDemoK.value = k;
      if (queryDocsK) queryDocsK.value = k;
      if (queryStar) {
        if (collSelect && collSelect.value === "demo") {
          if (queryDemoIdInput && queryDemoIdInput.value) {
            queryDemoIdBtn?.click();
          } else {
            queryDemoRandomBtn?.click();
          }
        }
      }
    });
  });

  window.addEventListener("resize", scheduleResize);
  loadData();
}
