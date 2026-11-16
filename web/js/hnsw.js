/**
 * VectorDB HNSW Graph Topology & Search Path Controller
 */
import { api, showGlobalError, clearGlobalError, withButtonBusy } from "./api.js";
import { Viewport2D, setupCanvasDpr } from "./canvas.js";
import { el, formatSimilarity, createDropdown } from "./ui.js";
import { computeBounds, drawStar } from "./explore_helpers.js";
import { getLayerColor, formatEdgeSummary, formatHnswTopologySummary, mapTraceToCoordinates, PlaybackController, isCanvasDrawable, getEdgeStrokeStyle } from "./hnsw_helpers.js";
import { THEME } from "./colors.js";

export function initHnswTab() {
  const canvas = document.getElementById("hnsw-canvas");
  if (!canvas) return;
  const canvasFrame = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const byId = (id) => document.getElementById(id);

  const urlParams = new URLSearchParams(window.location.search);
  const initialColl = urlParams.get("coll") === "docs" ? "docs" : "demo";

  const collWrap = byId("hnsw-coll-dropdown-wrap");
  let collDropdown = null;
  if (collWrap) {
    collDropdown = createDropdown(
      [
        { value: "demo", label: "Demo Vectors" },
        { value: "docs", label: "Document Chunks" }
      ],
      initialColl,
      () => { edgesDirty = true; loadGraphData(); loadHnswInfo(); },
      { id: "hnsw-coll-select", ariaLabel: "Select collection" }
    );
    collWrap.replaceChildren(collDropdown.element);
  }

  const maxEdgesWrap = byId("hnsw-max-edges-dropdown-wrap");
  let maxEdgesDropdown = null;
  if (maxEdgesWrap) {
    maxEdgesDropdown = createDropdown(
      [
        { value: "2000", label: "2,000" },
        { value: "10000", label: "10,000" },
        { value: "20000", label: "20,000" },
        { value: "60000", label: "60,000" }
      ],
      "20000",
      () => { edgesDirty = true; loadGraphData(); },
      { id: "hnsw-max-edges-select", ariaLabel: "Max edges" }
    );
    maxEdgesWrap.replaceChildren(maxEdgesDropdown.element);
  }

  const speedWrap = byId("hnsw-trace-speed-dropdown-wrap");
  let speedDropdown = null;
  if (speedWrap) {
    speedDropdown = createDropdown(
      [
        { value: "0.5", label: "0.5x" },
        { value: "1", label: "1x" },
        { value: "2", label: "2x" },
        { value: "5", label: "5x" }
      ],
      "1",
      () => { if (playback.getState().isPlaying) startPlayback(); },
      { id: "hnsw-trace-speed", ariaLabel: "Playback speed" }
    );
    speedWrap.replaceChildren(speedDropdown.element);
  }

  const collSelect = byId("hnsw-coll-select");
  if (collSelect && !collDropdown) collSelect.value = initialColl;
  const maxEdgesSelect = byId("hnsw-max-edges-select");
  const traceSpeedSelect = byId("hnsw-trace-speed");
  const refreshBtn = byId("hnsw-refresh-btn");
  const layerSlider = byId("hnsw-layer-slider"), layerLabel = byId("hnsw-layer-label");
  const edgeSummaryEl = byId("hnsw-edge-summary");
  const edgeWarnBadge = byId("hnsw-edge-warn-badge"), infoTableBox = byId("hnsw-info-box");

  const traceSection = byId("hnsw-trace-section"), traceNotice = byId("hnsw-trace-notice");
  const traceRandomBtn = byId("hnsw-trace-random-btn"), traceIdInput = byId("hnsw-trace-id-input");
  const traceIdBtn = byId("hnsw-trace-id-btn"), traceKInput = byId("hnsw-trace-k"), traceEfInput = byId("hnsw-trace-ef");
  const tracePlayBtn = byId("hnsw-trace-play-btn"), traceStepBackBtn = byId("hnsw-trace-prev-btn");
  const traceStepFwdBtn = byId("hnsw-trace-next-btn"), traceResetBtn = byId("hnsw-trace-reset-btn");
  const traceSlider = byId("hnsw-trace-slider");
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
      layerLabel.textContent = `Layer L${layer}`;

      const titleEl = byId("hnsw-graph-title");
      if (titleEl) titleEl.textContent = `HNSW Graph — Layer L${layer}`;
      const subtitleEl = byId("hnsw-graph-subtitle");
      if (subtitleEl) {
        subtitleEl.textContent = layer > 0
          ? "A higher layer with sparser connections for faster navigation."
          : "Base layer containing all indexed vector nodes and full connectivity.";
      }

      nodeMap.clear();
      (data.nodes || []).forEach(n => nodeMap.set(n.id, n));

      const edgeInfo = formatEdgeSummary(data.edges_count, data.total_edges, data.truncated);
      if (edgeSummaryEl) edgeSummaryEl.textContent = edgeInfo.label;
      if (edgeWarnBadge) edgeWarnBadge.classList.toggle("hidden", !edgeInfo.isTruncated);

      if (data.nodes && data.nodes.length > 0) {
        const bounds = computeBounds(data.nodes);
        viewport.fitBounds(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
      }

      const nodeCount = (data.nodes || []).length;
      if (traceRandomBtn) traceRandomBtn.disabled = isDocs || nodeCount === 0;
      if (traceIdBtn) traceIdBtn.disabled = isDocs || nodeCount === 0;

      edgesDirty = true;
      render();
    } catch (err) { showGlobalError(err.code, err.message); }
  }

  async function loadHnswInfo() {
    const isDocs = collSelect?.value === "docs";
    try {
      const info = isDocs ? await api.getDocsHnswInfo() : await api.getHnswInfo();
      const numNodes = info.numNodes || info.num_nodes || 0;
      const maxLvl = info.maxLevel !== undefined ? info.maxLevel : (info.max_level !== undefined ? info.max_level : 0);
      const entryId = info.entryPointId !== undefined ? info.entryPointId : (info.entry_point !== undefined ? info.entry_point : "-");

      const nodesEl = byId("hnsw-topo-nodes");
      if (nodesEl) nodesEl.textContent = numNodes ? numNodes.toLocaleString() : "-";
      const maxLvlEl = byId("hnsw-topo-max-level");
      if (maxLvlEl) maxLvlEl.textContent = `L${maxLvl}`;
      const entryEl = byId("hnsw-topo-entry");
      if (entryEl) entryEl.textContent = entryId !== "-" ? `#${entryId}` : "-";
    } catch (_) {
      const nodesEl = byId("hnsw-topo-nodes");
      if (nodesEl) nodesEl.textContent = "-";
      const maxLvlEl = byId("hnsw-topo-max-level");
      if (maxLvlEl) maxLvlEl.textContent = "-";
      const entryEl = byId("hnsw-topo-entry");
      if (entryEl) entryEl.textContent = "-";
    }
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
    offCtx.strokeStyle = getEdgeStrokeStyle(currentGraph.layer, false);
    offCtx.lineWidth = 0.65;
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
      ctx.arc(scr.x, scr.y, isEntry ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isEntry ? THEME.accent : "rgba(161, 161, 170, 0.6)";
      ctx.fill();

      if (isEntry) {
        // Beacon Diamond Outer Ring
        ctx.strokeStyle = THEME.accent;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, 11, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Entry point badge pill
        const badgeText = `ENTRY NODE (L${currentGraph.layer || 0})`;
        ctx.font = "bold 9.5px 'IBM Plex Mono', monospace";
        const badgeW = ctx.measureText(badgeText).width + 12;
        const badgeH = 18;
        const badgeX = scr.x - badgeW / 2;
        const badgeY = scr.y - 28;

        ctx.fillStyle = "rgba(18, 20, 26, 0.95)";
        ctx.strokeStyle = THEME.accent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = THEME.accent;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(badgeText, scr.x, badgeY + badgeH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    }

    // Render Search Path Progression
    const state = playback.getState();
    if (state.currentIndex >= 0 && mappedTraceSteps.length > 0) {
      let prevScr = null;
      for (let i = 0; i <= state.currentIndex; i++) {
        const step = mappedTraceSteps[i];
        if (!step.onMap) continue;
        const curScr = viewport.toScreen(step.x, step.y);
        if (prevScr) {
          ctx.strokeStyle = THEME.accent;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(prevScr.x, prevScr.y);
          ctx.lineTo(curScr.x, curScr.y);
          ctx.stroke();
        }
        const isCurrent = i === state.currentIndex;
        ctx.fillStyle = THEME.accent;
        ctx.beginPath();
        ctx.arc(curScr.x, curScr.y, isCurrent ? 7.5 : 5, 0, Math.PI * 2);
        ctx.fill();

        if (isCurrent) {
          ctx.strokeStyle = THEME.white;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw Step Indicator Pill
        const stepLbl = `#${i + 1}`;
        ctx.font = "bold 9px 'IBM Plex Mono', monospace";
        const sw = ctx.measureText(stepLbl).width + 6;
        const sx = curScr.x + 8;
        const sy = curScr.y - 12;

        ctx.fillStyle = "rgba(18, 20, 26, 0.9)";
        ctx.strokeStyle = isCurrent ? THEME.white : "rgba(217, 164, 65, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, 14, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isCurrent ? THEME.white : THEME.accent;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(stepLbl, sx + sw / 2, sy + 7);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        prevScr = curScr;
      }

      if (traceQueryStar) {
        const qScr = viewport.toScreen(traceQueryStar.x, traceQueryStar.y);

        // Target Crosshair
        ctx.strokeStyle = THEME.accent;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(qScr.x - 12, qScr.y); ctx.lineTo(qScr.x - 5, qScr.y);
        ctx.moveTo(qScr.x + 5, qScr.y); ctx.lineTo(qScr.x + 12, qScr.y);
        ctx.moveTo(qScr.x, qScr.y - 12); ctx.lineTo(qScr.x, qScr.y - 5);
        ctx.moveTo(qScr.x, qScr.y + 5); ctx.lineTo(qScr.x, qScr.y + 12);
        ctx.stroke();

        ctx.fillStyle = THEME.accent;
        ctx.strokeStyle = THEME.white;
        ctx.lineWidth = 1.5;
        drawStar(ctx, qScr.x, qScr.y, 5, 8, 4);
        ctx.fill();
        ctx.stroke();

        // Target badge
        const qText = "TARGET";
        ctx.font = "bold 9.5px 'IBM Plex Mono', monospace";
        const qW = ctx.measureText(qText).width + 10;
        const qH = 16;
        const qX = qScr.x + 12;
        const qY = qScr.y - 8;

        ctx.fillStyle = "rgba(18, 20, 26, 0.92)";
        ctx.strokeStyle = THEME.accent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(qX, qY, qW, qH, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = THEME.textPrimary;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(qText, qX + qW / 2, qY + qH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
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

    const counterEl = byId("hnsw-step-counter");
    if (counterEl) {
      counterEl.textContent = st.totalSteps > 0
        ? `Step ${Math.max(0, st.currentIndex + 1)} / ${st.totalSteps}`
        : "Step 0 / 0";
    }

    const currNodeEl = byId("hnsw-curr-node");
    const currDistEl = byId("hnsw-curr-dist");
    const currLayerEl = byId("hnsw-curr-layer");

    if (st.currentStep) {
      if (currNodeEl) currNodeEl.textContent = `#${st.currentStep.id}`;
      if (currDistEl) currDistEl.textContent = st.currentStep.distance !== undefined ? st.currentStep.distance.toFixed(4) : "-";
      if (currLayerEl) currLayerEl.textContent = `L${st.currentStep.layer}`;
    } else {
      if (currNodeEl) currNodeEl.textContent = "-";
      if (currDistEl) currDistEl.textContent = "-";
      if (currLayerEl) currLayerEl.textContent = "-";
    }

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
    const distEl = byId("hnsw-stat-dist-comps");
    const visitedEl = byId("hnsw-stat-nodes-visited");
    const layersEl = byId("hnsw-stat-visited-layers");

    if (distEl) distEl.textContent = stats?.distanceComputations !== undefined ? String(stats.distanceComputations) : "-";
    if (visitedEl) visitedEl.textContent = stats?.nodesVisited !== undefined ? String(stats.nodesVisited) : "-";

    if (layersEl) {
      const vLayers = stats?.visitedPerLayer || [];
      if (vLayers.length > 0) {
        layersEl.textContent = vLayers.map((c, l) => `L${l}: ${c}`).join("  |  ");
      } else {
        layersEl.textContent = "-";
      }
    }
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

  let resizeRaf = null;
  function scheduleResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      edgesDirty = true;
      render();
    });
  }

  const ro = new ResizeObserver(scheduleResize);
  if (canvasFrame) ro.observe(canvasFrame);

  byId("tab-btn-hnsw")?.addEventListener("click", onTabVisible);
  window.addEventListener("resize", scheduleResize);
  loadGraphData(); loadHnswInfo();
}
