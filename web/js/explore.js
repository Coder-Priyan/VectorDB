/**
 * VectorDB 2D PCA Explore Controller
 */
import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { Viewport2D, setupCanvasDpr } from "./canvas.js";
import { el, formatSimilarity } from "./ui.js";
import { getDocColor, computeBounds, findHitPoint, drawStar } from "./explore_helpers.js";

export function initExploreTab() {
  const canvas = document.getElementById("explore-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const byId = (id) => document.getElementById(id);

  const collSelect = byId("explore-coll-select"), refreshBtn = byId("explore-refresh-btn");
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("coll") === "docs" && collSelect) {
    collSelect.value = "docs";
  }
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

    const isDocs = collSelect.value === "docs";
    byId("explore-docs-controls")?.classList.toggle("hidden", !isDocs);
    byId("explore-demo-controls")?.classList.toggle("hidden", isDocs);

    try {
      const data = isDocs ? await api.getDocsPca(5000) : await api.getPca(5000);
      currentPoints = data.points || [];
      explainedRatios = data.explained_ratio || [0, 0];
      currentDim = data.dim || 128;

      if (currentPoints.length === 0) {
        showEmptyState(isDocs);
      } else {
        const bounds = computeBounds(currentPoints);
        viewport.fitBounds(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
        updateVarianceNotice(currentPoints.length, explainedRatios);
        updateLegend(isDocs, currentPoints);
      }
      render();
    } catch (err) {
      showGlobalError(err.code, `Failed to load PCA data: ${err.message}`);
    }
  }

  function showEmptyState(isDocs) {
    if (!emptyStateBox) return;
    emptyStateBox.classList.remove("hidden");
    if (isDocs) {
      emptyStateBox.replaceChildren(el("p", { className: "text-muted" }, "No documents ingested yet. Go to Ask tab to ingest documents."));
    } else {
      const countInput = el("input", { type: "number", className: "input-text", value: "1000", min: "10", max: "20000" });
      const insertBtn = el("button", { type: "button", className: "btn btn-sm btn-primary" }, "Insert Demo Vectors");
      insertBtn.addEventListener("click", async () => {
        const count = parseInt(countInput.value, 10) || 1000;
        await withButtonBusy(insertBtn, async () => {
          try { await api.insertDemoRandom(count); await loadData(); } catch (err) { showGlobalError(err.code, err.message); }
        });
      });
      emptyStateBox.replaceChildren(el("p", { className: "text-muted" }, "Demo collection is empty."), el("div", { className: "form-row mt-3" }, countInput, insertBtn));
    }
  }

  function updateVarianceNotice(count, ratios) {
    if (!varianceNote) return;
    const r1 = ((ratios[0] || 0) * 100).toFixed(1), r2 = ((ratios[1] || 0) * 100).toFixed(1);
    const sum = (((ratios[0] || 0) + (ratios[1] || 0)) * 100).toFixed(1);
    let text = `Points: ${count} | PC1: ${r1}% | PC2: ${r2}% (Total 2D: ${sum}%)`;
    if (count < 10) text += " — Note: PCA projection is not statistically meaningful with fewer than 10 vectors.";
    varianceNote.textContent = text;
  }

  function updateLegend(isDocs, points) {
    if (!legendContainer) return;
    legendContainer.replaceChildren();
    if (!isDocs) return;
    const docMap = new Map();
    points.forEach(pt => { if (pt.doc_id !== undefined && !docMap.has(pt.doc_id)) docMap.set(pt.doc_id, pt.title || `Doc ${pt.doc_id}`); });
    const items = Array.from(docMap.entries()).map(([docId, title]) => {
      const swatch = el("span", { className: "legend-swatch" });
      swatch.style.setProperty("background-color", getDocColor(docId));
      return el("div", { className: "legend-item" }, swatch, el("span", {}, title));
    });
    legendContainer.replaceChildren(...items);
  }

  function render() {
    const { width, height } = setupCanvasDpr(canvas, ctx);
    viewport.width = width; viewport.height = height;
    ctx.clearRect(0, 0, width, height);

    // Axes
    const orig = viewport.toScreen(0, 0);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, orig.y); ctx.lineTo(width, orig.y);
    ctx.moveTo(orig.x, 0); ctx.lineTo(orig.x, height);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = "rgba(100, 116, 139, 0.7)";
    ctx.font = "11px sans-serif";
    ctx.fillText(`PC1 (${((explainedRatios[0] || 0) * 100).toFixed(1)}%)`, width - 85, Math.min(Math.max(20, orig.y - 6), height - 10));
    ctx.fillText(`PC2 (${((explainedRatios[1] || 0) * 100).toFixed(1)}%)`, Math.min(Math.max(10, orig.x + 6), width - 80), 20);

    const isDocs = collSelect.value === "docs";
    for (let i = 0; i < currentPoints.length; i++) {
      const pt = currentPoints[i];
      const scr = viewport.toScreen(pt.x, pt.y);
      if (scr.x < -10 || scr.x > width + 10 || scr.y < -10 || scr.y > height + 10) continue;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isDocs ? getDocColor(pt.doc_id) : "#2563eb";
      ctx.fill();
    }

    if (queryStar && topKResults.length > 0) {
      const qScr = viewport.toScreen(queryStar.x, queryStar.y);
      for (let i = 0; i < topKResults.length; i++) {
        const res = topKResults[i];
        const rScr = viewport.toScreen(res.x, res.y);
        ctx.strokeStyle = "rgba(220, 38, 38, 0.65)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(qScr.x, qScr.y); ctx.lineTo(rScr.x, rScr.y); ctx.stroke();
        ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(rScr.x, rScr.y, 6.5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = "#ef4444"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
      drawStar(ctx, qScr.x, qScr.y, 5, 10, 5);
      ctx.fill(); ctx.stroke();
    }

    if (hoveredPoint) {
      const hScr = viewport.toScreen(hoveredPoint.x, hoveredPoint.y);
      ctx.strokeStyle = "#000000"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hScr.x, hScr.y, 6.5, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function renderTable(results, isDocs) {
    if (!resultsTableBody) return;
    resultsTableBody.replaceChildren();
    if (!results || results.length === 0) return;
    const rows = results.map((r, idx) => {
      const label = isDocs ? `${r.title || "Doc " + r.doc_id} [chunk ${r.chunk_index}]` : `ID: ${r.id}`;
      return el("tr", {}, el("td", {}, `#${idx + 1}`), el("td", {}, label), el("td", {}, r.distance !== undefined ? r.distance.toFixed(4) : "-"), el("td", {}, formatSimilarity(r.similarity)));
    });
    resultsTableBody.replaceChildren(...rows);
  }

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    viewport.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 0.85);
    render();
  }, { passive: false });

  canvas.addEventListener("mousedown", (e) => { isDragging = true; dragStart = { x: e.clientX, y: e.clientY }; });
  window.addEventListener("mouseup", () => { isDragging = false; });
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    if (isDragging) {
      viewport.pan(e.clientX - dragStart.x, e.clientY - dragStart.y);
      dragStart = { x: e.clientX, y: e.clientY };
      render(); return;
    }
    const hit = findHitPoint(e.clientX - rect.left, e.clientY - rect.top, currentPoints, viewport, 8);
    if (hit !== hoveredPoint) { hoveredPoint = hit; render(); }
    if (hoveredPoint && tooltip) {
      const isDocs = collSelect.value === "docs";
      tooltip.textContent = isDocs ? `[Doc ${hoveredPoint.doc_id}] ${hoveredPoint.title || ""}\nChunk ${hoveredPoint.chunk_index}` : `Vector ID: ${hoveredPoint.id}`;
      tooltip.style.setProperty("left", `${e.clientX + 12}px`);
      tooltip.style.setProperty("top", `${e.clientY + 12}px`);
      tooltip.classList.remove("hidden");
    } else { tooltip?.classList.add("hidden"); }
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

  collSelect?.addEventListener("change", loadData);
  refreshBtn?.addEventListener("click", loadData);
  byId("tab-btn-explore")?.addEventListener("click", loadData);
  window.addEventListener("resize", render);
  loadData();
}
