/**
 * VectorDB 2D PCA Explore Controller
 */
import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { Viewport2D, setupCanvasDpr } from "./canvas.js";
import { el, formatSimilarity, createDropdown } from "./ui.js";
import { createIcon } from "./icons.js";
import { getDocColor, computeBounds, findHitPoint, drawStar, getExploreCanvasSubtitle, isExploreActionDisabled, computeAxisTicks, clampTickEdge } from "./explore_helpers.js";
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
  const drawer = byId("explore-inspector-drawer");
  const drawerToggleBtn = byId("explore-drawer-toggle-btn");
  const drawerCloseBtn = byId("explore-drawer-close-btn");
  const exploreLayout = document.querySelector(".explore-layout");

  function toggleDrawer(open) {
    if (!drawer) return;
    const shouldOpen = open !== undefined ? open : drawer.classList.contains("collapsed");
    drawer.classList.toggle("collapsed", !shouldOpen);
    exploreLayout?.classList.toggle("drawer-collapsed", !shouldOpen);
    scheduleResize();
  }

  drawerToggleBtn?.addEventListener("click", () => toggleDrawer());
  drawerCloseBtn?.addEventListener("click", () => toggleDrawer(false));

  const viewport = new Viewport2D(canvas.width, canvas.height, 45);
  let currentPoints = [], explainedRatios = [0, 0], queryStar = null, topKResults = [];
  let hoveredPoint = null, isDragging = false, dragStart = { x: 0, y: 0 }, currentDim = 128;

  async function loadData() {
    clearGlobalError();
    emptyStateBox?.classList.add("hidden");
    hoveredPoint = null; queryStar = null; topKResults = [];
    const isDocs = collSelect ? collSelect.value === "docs" : false;
    renderTable([], isDocs);
    if (varianceNote) varianceNote.textContent = "";
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

    const orig = viewport.toScreen(0, 0);

    // 1. Precision CAD Coordinate Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = -1.0; gx <= 1.05; gx += 0.1) {
      const scrX = viewport.toScreen(gx, 0).x;
      if (scrX >= 0 && scrX <= width) {
        ctx.moveTo(scrX, 0);
        ctx.lineTo(scrX, height);
      }
    }
    for (let gy = -1.0; gy <= 1.05; gy += 0.1) {
      const scrY = viewport.toScreen(0, gy).y;
      if (scrY >= 0 && scrY <= height) {
        ctx.moveTo(0, scrY);
        ctx.lineTo(width, scrY);
      }
    }
    ctx.stroke();

    // 2. Primary Axes (Zero Planes)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, orig.y); ctx.lineTo(width, orig.y);
    ctx.moveTo(orig.x, 0); ctx.lineTo(orig.x, height);
    ctx.stroke();

    // 3. Axis Ticks & Tick Numerals (positioned at perimeter with quiet backing pills to prevent collision with data points)
    ctx.fillStyle = THEME.textMuted;
    ctx.font = "10.5px 'IBM Plex Mono', monospace";

    const xTicks = computeAxisTicks(-0.8, 0.85, 0.2);
    for (let i = 0; i < xTicks.length; i++) {
      const { val: xVal, label: lbl } = xTicks[i];
      const scr = viewport.toScreen(xVal, 0);
      if (scr.x >= 35 && scr.x <= width - 35) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(scr.x, orig.y - 3);
        ctx.lineTo(scr.x, orig.y + 3);
        ctx.stroke();

        // Quiet pill backing at bottom edge to avoid point collisions
        const tw = ctx.measureText(lbl).width;
        const tickY = height - 24;
        ctx.fillStyle = "rgba(9, 9, 11, 0.85)";
        ctx.fillRect(scr.x - tw / 2 - 3, tickY - 2, tw + 6, 13);
        ctx.fillStyle = THEME.textMuted;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(lbl, scr.x, tickY);
      }
    }

    const yTicks = computeAxisTicks(-0.8, 0.85, 0.2);
    for (let i = 0; i < yTicks.length; i++) {
      const { val: yVal, label: lbl } = yTicks[i];
      if (Math.abs(yVal) < 0.001) continue;
      const scr = viewport.toScreen(0, yVal);
      if (scr.y >= 20 && scr.y <= height - 20) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(orig.x - 3, scr.y);
        ctx.lineTo(orig.x + 3, scr.y);
        ctx.stroke();

        // Quiet pill backing at left edge to avoid point collisions
        const tw = ctx.measureText(lbl).width;
        const tickX = 28;
        ctx.fillStyle = "rgba(9, 9, 11, 0.85)";
        ctx.fillRect(tickX - tw - 3, scr.y - 6, tw + 6, 13);
        ctx.fillStyle = THEME.textMuted;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(lbl, tickX, scr.y);
      }
    }

    // 4. Subtle Axis Identifiers
    ctx.fillStyle = THEME.textSecondary;
    ctx.font = "11px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("PC1 (Axis 1)", width / 2, height - 6);

    ctx.save();
    ctx.translate(14, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("PC2 (Axis 2)", 0, 0);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // 5. High-Dimensional Vector Points (Constellation)
    const isDocs = collSelect ? collSelect.value === "docs" : false;
    for (let i = 0; i < currentPoints.length; i++) {
      const pt = currentPoints[i];
      const scr = viewport.toScreen(pt.x, pt.y);
      if (scr.x < -10 || scr.x > width + 10 || scr.y < -10 || scr.y > height + 10) continue;

      ctx.beginPath();
      ctx.arc(scr.x, scr.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isDocs ? getDocColor(pt.doc_id) : "rgba(217, 164, 65, 0.75)";
      ctx.fill();
      ctx.strokeStyle = "rgba(9, 9, 11, 0.95)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // 6. Nearest Neighbor Geodesics & Highlighting
    if (queryStar && typeof queryStar.x === "number" && typeof queryStar.y === "number") {
      const qScr = viewport.toScreen(queryStar.x, queryStar.y);

      // Draw connecting geodesics
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "rgba(217, 164, 65, 0.35)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < topKResults.length; i++) {
        const res = topKResults[i];
        const rScr = viewport.toScreen(res.x, res.y);
        ctx.beginPath();
        ctx.moveTo(qScr.x, qScr.y);
        ctx.lineTo(rScr.x, rScr.y);
        ctx.stroke();
      }
      ctx.restore();

      // Draw match rings and rank badges
      for (let i = 0; i < topKResults.length; i++) {
        const res = topKResults[i];
        const rScr = viewport.toScreen(res.x, res.y);

        // Outer gold halo
        ctx.strokeStyle = THEME.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rScr.x, rScr.y, 7.5, 0, Math.PI * 2);
        ctx.stroke();

        // White core dot
        ctx.fillStyle = THEME.white;
        ctx.beginPath();
        ctx.arc(rScr.x, rScr.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Rank pill badge (e.g. #1, #2)
        const rankText = `#${i + 1}`;
        ctx.font = "bold 10px 'IBM Plex Mono', monospace";
        const rw = ctx.measureText(rankText).width + 8;
        const rx = rScr.x + 10;
        const ry = rScr.y - 7;

        ctx.fillStyle = "rgba(18, 20, 26, 0.9)";
        ctx.strokeStyle = "rgba(217, 164, 65, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(rx, ry, rw, 15, 3);
        else ctx.rect(rx, ry, rw, 15);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = THEME.accent;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(rankText, rx + rw / 2, ry + 7.5);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // Draw Precision Radar Target Reticle at query position
      // Crosshairs ticks
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(qScr.x - 14, qScr.y); ctx.lineTo(qScr.x - 6, qScr.y);
      ctx.moveTo(qScr.x + 6, qScr.y); ctx.lineTo(qScr.x + 14, qScr.y);
      ctx.moveTo(qScr.x, qScr.y - 14); ctx.lineTo(qScr.x, qScr.y - 6);
      ctx.moveTo(qScr.x, qScr.y + 6); ctx.lineTo(qScr.x, qScr.y + 14);
      ctx.stroke();

      // Outer dashed reticle ring
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(qScr.x, qScr.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Inner solid reticle ring
      ctx.strokeStyle = THEME.white;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(qScr.x, qScr.y, 5, 0, Math.PI * 2);
      ctx.stroke();

      // Center gold dot
      ctx.fillStyle = THEME.accent;
      ctx.beginPath();
      ctx.arc(qScr.x, qScr.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Target Label Pill
      const targetLbl = "QUERY TARGET";
      ctx.font = "bold 9.5px 'IBM Plex Mono', monospace";
      const tw = ctx.measureText(targetLbl).width + 10;
      const tx = qScr.x - tw / 2;
      const ty = qScr.y + 16;

      ctx.fillStyle = "rgba(18, 20, 26, 0.92)";
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(tx, ty, tw, 16, 3);
      else ctx.rect(tx, ty, tw, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = THEME.textPrimary;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(targetLbl, tx + tw / 2, ty + 8);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // 7. Hover Reticle & Coordinate Inspection
    if (hoveredPoint) {
      const hScr = viewport.toScreen(hoveredPoint.x, hoveredPoint.y);
      ctx.strokeStyle = THEME.white;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hScr.x, hScr.y, 7, 0, Math.PI * 2);
      ctx.stroke();

      const isDocsPoint = collSelect ? collSelect.value === "docs" : false;
      const tipText = isDocsPoint
        ? `Doc ${hoveredPoint.doc_id} · Ch ${hoveredPoint.chunk_index} (${hoveredPoint.x.toFixed(2)}, ${hoveredPoint.y.toFixed(2)})`
        : `Vector #${hoveredPoint.id} (${hoveredPoint.x.toFixed(2)}, ${hoveredPoint.y.toFixed(2)})`;
      ctx.font = "10.5px 'IBM Plex Mono', monospace";
      const tipW = ctx.measureText(tipText).width + 12;
      const tipX = Math.min(width - tipW - 8, Math.max(8, hScr.x - tipW / 2));
      const tipY = hScr.y - 24 > 10 ? hScr.y - 24 : hScr.y + 12;

      ctx.fillStyle = "rgba(18, 20, 26, 0.95)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(tipX, tipY, tipW, 18, 4);
      else ctx.rect(tipX, tipY, tipW, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = THEME.textPrimary;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tipText, tipX + tipW / 2, tipY + 9);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
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
      const emptyGraphic = el("div", { className: "empty-feed-graphic" },
        el("div", { className: "empty-feed-icon" }, "\u25C9"),
        el("div", { className: "empty-feed-title" }, "No Active Query"),
        el("div", { className: "empty-feed-desc" }, "Click \"Project Random Query\" or click any point on the canvas to inspect nearest neighbors.")
      );
      resultsTableBody.appendChild(emptyGraphic);
      return;
    }

    const cards = results.map((r, i) => {
      const docTitle = isDocs ? (r.title || `Doc ${r.doc_id}`) : `Vector #${r.id}`;
      const chunkSub = isDocs ? `Chunk #${r.chunk_index}` : `128D Dense`;
      const distStr = r.distance !== undefined ? r.distance.toFixed(4) : "-";
      const simStr = formatSimilarity(r.similarity);
      const simNum = (r.similarity !== null && r.similarity !== undefined) ? Math.min(100, Math.max(0, r.similarity * 100)) : 0;

      const rankBadge = el("span", { className: `neighbor-rank-badge ${i === 0 ? "rank-top" : ""}` }, `#${i + 1}`);

      const simVal = el("span", { className: "sim-val-text font-mono" }, simStr);
      const simFill = el("div", { className: "sim-meter-fill" });
      simFill.style.setProperty("width", `${simNum.toFixed(1)}%`);
      const simTrack = el("div", { className: "sim-meter-track" }, simFill);
      const simCellContent = el("div", { className: "sim-cell-wrap" }, simVal, simTrack);

      const card = el("div", { className: `explore-neighbor-card ${i === 0 ? "is-top-match" : ""}` },
        rankBadge,
        el("div", { className: "neighbor-target-meta" },
          createIcon(isDocs ? "document" : "database", 14, "neighbor-icon-svg"),
          el("div", { className: "neighbor-info" },
            el("span", { className: "neighbor-title" }, docTitle),
            el("span", { className: "neighbor-sub" }, chunkSub)
          )
        ),
        el("span", { className: "neighbor-dist-val font-mono" }, distStr),
        simCellContent
      );

      card.addEventListener("click", () => {
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

      return card;
    });
    resultsTableBody.replaceChildren(...cards);

    if (results && results.length > 0) {
      toggleDrawer(true);
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
        queryStar = res.query_projected || null;
        topKResults = (res.results || []).map(r => {
          if (typeof r.x !== "number" || typeof r.y !== "number") {
            const pt = currentPoints.find(p => p.doc_id === r.doc_id && p.chunk_index === r.chunk_index);
            if (pt) { r.x = pt.x; r.y = pt.y; }
          }
          return r;
        });
        renderTable(topKResults, true); render();
      } catch (err) { showGlobalError(err.code, err.message); }
    });
  });

  queryDemoRandomBtn?.addEventListener("click", async () => {
    const vec = Array.from({ length: currentDim }, () => (Math.random() - 0.5) * 2);
    await withButtonBusy(queryDemoRandomBtn, async () => {
      try {
        const res = await api.queryPca({ vector: vec, k: parseInt(queryDemoK.value, 10) || 5 });
        queryStar = res.query_projected || null;
        topKResults = (res.results || []).map(r => {
          if (typeof r.x !== "number" || typeof r.y !== "number") {
            const pt = currentPoints.find(p => p.id === r.id);
            if (pt) { r.x = pt.x; r.y = pt.y; }
          }
          return r;
        });
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
        queryStar = res.query_projected || null;
        topKResults = (res.results || []).map(r => {
          if (typeof r.x !== "number" || typeof r.y !== "number") {
            const pt = currentPoints.find(p => p.id === r.id);
            if (pt) { r.x = pt.x; r.y = pt.y; }
          }
          return r;
        });
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
