/**
 * VectorDB HNSW Graph Topology & Search Path Controller
 */
import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { Viewport2D, setupCanvasDpr } from "./canvas.js";
import { el, formatSimilarity } from "./ui.js";
import { computeBounds, drawStar } from "./explore_helpers.js";
import { getLayerColor, formatEdgeSummary, formatHnswTopologySummary, mapTraceToCoordinates, PlaybackController, isCanvasDrawable } from "./hnsw_helpers.js";

export function initHnswTab() {
  const canvas = document.getElementById("hnsw-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const byId = (id) => document.getElementById(id);

  const collSelect = byId("hnsw-coll-select"), refreshBtn = byId("hnsw-refresh-btn");
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("coll") === "docs" && collSelect) collSelect.value = "docs";
  const layerSlider = byId("hnsw-layer-slider"), layerLabel = byId("hnsw-layer-label");
  const maxEdgesSelect = byId("hnsw-max-edges-select"), edgeSummaryEl = byId("hnsw-edge-summary");
  const edgeWarnBadge = byId("hnsw-edge-warn-badge"), infoTableBox = byId("hnsw-info-box");

  const traceSection = byId("hnsw-trace-section"), traceNotice = byId("hnsw-trace-notice");
  const traceRandomBtn = byId("hnsw-trace-random-btn"), traceIdInput = byId("hnsw-trace-id-input");
  const traceIdBtn = byId("hnsw-trace-id-btn"), traceKInput = byId("hnsw-trace-k"), traceEfInput = byId("hnsw-trace-ef");
  const tracePlayBtn = byId("hnsw-trace-play-btn"), traceStepBackBtn = byId("hnsw-trace-prev-btn");
  const traceStepFwdBtn = byId("hnsw-trace-next-btn"), traceResetBtn = byId("hnsw-trace-reset-btn");
  const traceSpeedSelect = byId("hnsw-trace-speed"), traceSlider = byId("hnsw-trace-slider");
  const traceStepAnnounce = byId("hnsw-trace-announcement"), traceMissingNotice = byId("hnsw-trace-missing");
  const traceStatsBox = byId("hnsw-trace-stats-box");

  const viewport = new Viewport2D(canvas.width, canvas.height, 45);
  const offscreenCanvas = document.createElement("canvas");
  const offCtx = offscreenCanvas.getContext("2d");

  let currentGraph = { nodes: [], edges: [], max_level: 0, entry_point: 0 };
  let nodeMap = new Map();
  let isDragging = false, dragStart = { x: 0, y: 0 };
  let currentDim = 128;
  let edgesDirty = true;

  // Search trace state
  const playback = new PlaybackController();
  let traceQueryStar = null, mappedTraceSteps = [];
  let playInterval = null;

  async function loadGraphData() {
    clearGlobalError();
    const isDocs = collSelect.value === "docs";
    traceSection?.classList.toggle("hidden", isDocs);
    traceNotice?.classList.toggle("hidden", !isDocs);

    const layer = parseInt(layerSlider.value, 10) || 0;
    const maxEdges = parseInt(maxEdgesSelect.value, 10) || 20000;

    try {
      const data = isDocs ? await api.getDocsHnswGraph(layer, maxEdges) : await api.getHnswGraph(layer, maxEdges);
      currentGraph = data;
      layerSlider.max = String(data.max_level || 0);
      layerLabel.textContent = `Layer ${layer} (Max: ${data.max_level || 0})`;

      nodeMap.clear();
      (data.nodes || []).forEach(n => nodeMap.set(n.id, n));

      const edgeInfo = formatEdgeSummary(data.edges_count, data.total_edges, data.truncated);
      if (edgeSummaryEl) edgeSummaryEl.textContent = edgeInfo.label;
      if (edgeWarnBadge) edgeWarnBadge.classList.toggle("hidden", !edgeInfo.isTruncated);

      if (data.nodes && data.nodes.length > 0) {
        const bounds = computeBounds(data.nodes);
        viewport.fitBounds(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
      }

      edgesDirty = true;
      render();
    } catch (err) { showGlobalError(err.code, err.message); }
  }

  async function loadHnswInfo() {
    if (!infoTableBox) return;
    const isDocs = collSelect?.value === "docs";
    try {
      const info = isDocs ? await api.getDocsHnswInfo() : await api.getHnswInfo();
      const s = formatHnswTopologySummary(info);
      infoTableBox.replaceChildren(
        el("table", { className: "info-table" },
          el("tbody", {},
            el("tr", {}, el("td", {}, "Nodes / Max Lvl"), el("td", {}, s.nodesMaxLvl)),
            el("tr", {}, el("td", {}, "Entry Point ID"), el("td", {}, s.entryPointId)),
            el("tr", {}, el("td", {}, "Nodes / Layer"), el("td", {}, s.nodesPerLayer)),
            el("tr", {}, el("td", {}, "Avg Degree / Layer"), el("td", {}, s.avgDegreePerLayer))
          )
        )
      );
    } catch (_) { infoTableBox.replaceChildren(el("p", { className: "text-muted" }, "Info unavailable")); }
  }

  function rebuildOffscreenEdges(w, h) {
    if (!isCanvasDrawable(w, h)) return;
    offscreenCanvas.width = w; offscreenCanvas.height = h;
    offCtx.clearRect(0, 0, w, h);
    const edges = currentGraph.edges || [];
    if (edges.length === 0) return;

    offCtx.beginPath();
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
      if (s && t) {
        const sScr = viewport.toScreen(s.x, s.y);
        const tScr = viewport.toScreen(t.x, t.y);
        offCtx.moveTo(sScr.x, sScr.y); offCtx.lineTo(tScr.x, tScr.y);
      }
    }
    offCtx.strokeStyle = "rgba(100, 116, 139, 0.35)";
    offCtx.lineWidth = 1;
    offCtx.stroke();
    edgesDirty = false;
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    if (!isCanvasDrawable(rect.width, rect.height)) return;

    const { width, height } = setupCanvasDpr(canvas, ctx);
    if (!isCanvasDrawable(width, height)) return;

    viewport.width = width; viewport.height = height;
    ctx.clearRect(0, 0, width, height);

    if (edgesDirty && isCanvasDrawable(width, height)) rebuildOffscreenEdges(width, height);
    if (!isDragging && isCanvasDrawable(offscreenCanvas.width, offscreenCanvas.height) && isCanvasDrawable(width, height)) {
      ctx.drawImage(offscreenCanvas, 0, 0, width, height);
    }

    const nodes = currentGraph.nodes || [];
    const entryId = currentGraph.entry_point;

    // Nodes
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const scr = viewport.toScreen(n.x, n.y);
      if (scr.x < -10 || scr.x > width + 10 || scr.y < -10 || scr.y > height + 10) continue;
      const isEntry = n.id === entryId;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, isEntry ? 6.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isEntry ? "#eab308" : getLayerColor(currentGraph.layer);
      ctx.fill();
      if (isEntry) { ctx.strokeStyle = "#000000"; ctx.lineWidth = 1.5; ctx.stroke(); }
    }

    // Render Search Path
    const state = playback.getState();
    if (state.currentIndex >= 0 && mappedTraceSteps.length > 0) {
      let prevScr = null;
      for (let i = 0; i <= state.currentIndex; i++) {
        const step = mappedTraceSteps[i];
        if (!step.onMap) continue;
        const curScr = viewport.toScreen(step.x, step.y);
        if (prevScr) {
          ctx.strokeStyle = getLayerColor(step.layer);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(prevScr.x, prevScr.y); ctx.lineTo(curScr.x, curScr.y); ctx.stroke();
        }
        ctx.fillStyle = getLayerColor(step.layer);
        ctx.beginPath(); ctx.arc(curScr.x, curScr.y, 5.5, 0, Math.PI * 2); ctx.fill();
        prevScr = curScr;
      }
      if (traceQueryStar) {
        const qScr = viewport.toScreen(traceQueryStar.x, traceQueryStar.y);
        ctx.fillStyle = "#ef4444"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
        drawStar(ctx, qScr.x, qScr.y, 5, 10, 5); ctx.fill(); ctx.stroke();
      }
    }
  }

  // Animation Loop
  function startPlayback() {
    stopPlayback();
    playback.play();
    updatePlaybackUi();
    const delay = 500 / (parseFloat(traceSpeedSelect.value) || 1);
    playInterval = setInterval(() => {
      const st = playback.tick();
      updatePlaybackUi();
      render();
      if (st.isDone) stopPlayback();
    }, delay);
  }

  function stopPlayback() {
    if (playInterval) { clearInterval(playInterval); playInterval = null; }
    playback.pause();
    updatePlaybackUi();
  }

  function updatePlaybackUi() {
    const st = playback.getState();
    if (tracePlayBtn) tracePlayBtn.textContent = st.isPlaying ? "Pause" : "Play";
    if (traceSlider) { traceSlider.value = String(st.currentIndex); }
    if (traceStepAnnounce) {
      traceStepAnnounce.textContent = st.currentStep
        ? `Step ${st.currentIndex + 1} / ${st.totalSteps}: Node ${st.currentStep.id} on Layer ${st.currentStep.layer} (dist: ${st.currentStep.distance?.toFixed(4)})`
        : "Search path not started";
    }
  }

  async function runTrace(vec) {
    const k = parseInt(traceKInput.value, 10) || 5;
    const ef = parseInt(traceEfInput.value, 10) || 16;
    try {
      const pcaData = await api.getPca(5000);
      const pcaMap = new Map((pcaData.points || []).map(p => [p.id, p]));
      currentDim = pcaData.dim || 128;

      const res = await api.traceHnsw({ vector: vec, k, ef });
      const mapped = mapTraceToCoordinates(res.trace || [], pcaMap);
      mappedTraceSteps = mapped.mappedSteps;

      if (traceMissingNotice) {
        traceMissingNotice.textContent = mapped.missingCount > 0 ? `${mapped.missingCount} visited nodes not on 2D map` : "";
        traceMissingNotice.classList.toggle("hidden", mapped.missingCount === 0);
      }

      playback.setSteps(mappedTraceSteps);
      if (traceSlider) { traceSlider.min = "-1"; traceSlider.max = String(mappedTraceSteps.length - 1); traceSlider.value = "-1"; }

      const qRes = await api.queryPca({ vector: vec, k: 1 });
      traceQueryStar = qRes.query_projected || null;
      renderStats(res.stats, res.results);
      updatePlaybackUi();
      render();
    } catch (err) { showGlobalError(err.code, err.message); }
  }

  function renderStats(stats, results) {
    if (!traceStatsBox) return;
    const lCounts = (stats.visitedPerLayer || []).map((c, l) => `L${l}: ${c}`).join(", ");
    traceStatsBox.replaceChildren(
      el("table", { className: "info-table" },
        el("tbody", {},
          el("tr", {}, el("td", {}, "Distance Computations"), el("td", {}, stats.distanceComputations)),
          el("tr", {}, el("td", {}, "Total Visited Nodes"), el("td", {}, stats.nodesVisited)),
          el("tr", {}, el("td", {}, "Visited Per Layer"), el("td", {}, lCounts || "-")),
          el("tr", {}, el("td", {}, "Top Result ID"), el("td", {}, results?.[0]?.id || "-"))
        )
      )
    );
  }

  // Mouse Listeners
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    viewport.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 0.85);
    edgesDirty = true; render();
  }, { passive: false });

  canvas.addEventListener("mousedown", (e) => { isDragging = true; dragStart = { x: e.clientX, y: e.clientY }; });
  window.addEventListener("mouseup", () => { if (isDragging) { isDragging = false; edgesDirty = true; render(); } });
  canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
      viewport.pan(e.clientX - dragStart.x, e.clientY - dragStart.y);
      dragStart = { x: e.clientX, y: e.clientY };
      render();
    }
  });

  canvas.addEventListener("dblclick", () => {
    if (currentGraph.nodes?.length > 0) {
      const b = computeBounds(currentGraph.nodes);
      viewport.fitBounds(b.minX, b.maxX, b.minY, b.maxY);
      edgesDirty = true; render();
    }
  });

  // Controls
  layerSlider?.addEventListener("input", () => { edgesDirty = true; loadGraphData(); });
  maxEdgesSelect?.addEventListener("change", () => { edgesDirty = true; loadGraphData(); });
  collSelect?.addEventListener("change", () => { edgesDirty = true; loadGraphData(); loadHnswInfo(); });
  refreshBtn?.addEventListener("click", () => { edgesDirty = true; loadGraphData(); loadHnswInfo(); });

  traceRandomBtn?.addEventListener("click", async () => {
    const vec = Array.from({ length: currentDim }, () => (Math.random() - 0.5) * 2);
    await withButtonBusy(traceRandomBtn, () => runTrace(vec));
  });

  traceIdBtn?.addEventListener("click", async () => {
    const id = parseInt(traceIdInput.value, 10);
    if (isNaN(id) || id <= 0) return showGlobalError("validation_error", "Valid ID required");
    await withButtonBusy(traceIdBtn, async () => {
      const stored = await api.getVector(id);
      await runTrace(stored.vector);
    });
  });

  tracePlayBtn?.addEventListener("click", () => { playback.getState().isPlaying ? stopPlayback() : startPlayback(); });
  traceStepBackBtn?.addEventListener("click", () => { stopPlayback(); playback.stepBack(); updatePlaybackUi(); render(); });
  traceStepFwdBtn?.addEventListener("click", () => { stopPlayback(); playback.stepForward(); updatePlaybackUi(); render(); });
  traceResetBtn?.addEventListener("click", () => { stopPlayback(); playback.reset(); updatePlaybackUi(); render(); });
  traceSlider?.addEventListener("input", (e) => { stopPlayback(); playback.seek(parseInt(e.target.value, 10)); updatePlaybackUi(); render(); });
  traceSpeedSelect?.addEventListener("change", () => { if (playback.getState().isPlaying) startPlayback(); });

  function onTabVisible() {
    requestAnimationFrame(() => {
      edgesDirty = true;
      if (currentGraph?.nodes?.length > 0) render();
      loadGraphData();
      loadHnswInfo();
    });
  }

  byId("tab-btn-hnsw")?.addEventListener("click", onTabVisible);
  window.addEventListener("resize", () => {
    requestAnimationFrame(() => {
      edgesDirty = true;
      render();
    });
  });
  loadGraphData(); loadHnswInfo();
}
