/**
 * Pure Logic Helpers for Settings Tab Navigation
 */

/**
 * Computes next section index for roving tabindex keyboard navigation.
 *
 * @param {number} currentIndex
 * @param {number} totalCount
 * @param {string} key
 * @returns {number}
 */
export function getSettingsNextSectionIndex(currentIndex, totalCount, key) {
  if (totalCount <= 0) return 0;
  let next = currentIndex;

  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      next = (currentIndex + 1) % totalCount;
      break;
    case "ArrowUp":
    case "ArrowLeft":
      next = (currentIndex - 1 + totalCount) % totalCount;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = totalCount - 1;
      break;
    default:
      return currentIndex;
  }
  return next;
}

/**
 * Formats HNSW graph telemetry for Settings console display.
 *
 * @param {Object} info - Response from /api/hnsw/info
 * @returns {{
 *   available: boolean,
 *   maxLevel: number,
 *   entryPoint: string,
 *   layersText: string,
 *   degreeText: string
 * }}
 */
export function formatHnswSummary(info) {
  if (!info || typeof info !== "object" || info.maxLevel === undefined) {
    return {
      available: false,
      maxLevel: 0,
      entryPoint: "--",
      layersText: "None",
      degreeText: "--"
    };
  }
  const maxLevel = Number(info.maxLevel) || 0;
  const entryPoint = (info.entryPointId !== undefined && info.entryPointId !== null)
    ? `#${info.entryPointId}`
    : "--";
  const layers = Array.isArray(info.nodesPerLayer)
    ? info.nodesPerLayer.map((c, i) => `L${i}: ${c}`).join(" · ")
    : "--";
  const degrees = Array.isArray(info.avgDegreePerLayer)
    ? info.avgDegreePerLayer.map((d, i) => `L${i}: ${Number(d).toFixed(1)}`).join(" · ")
    : "--";

  return {
    available: true,
    maxLevel,
    entryPoint,
    layersText: layers,
    degreeText: degrees
  };
}

/**
 * Formats ingested documents array for the middle telemetry column.
 *
 * @param {Array<Object>} docs - Array of document objects from /api/docs
 * @param {number} [maxItems=4]
 * @returns {Array<{ id: number|string, title: string, chunksText: string, sizeText: string }>}
 */
export function formatDocumentListSummary(docs, maxItems = 4) {
  if (!Array.isArray(docs) || docs.length === 0) return [];
  const limit = Math.min(docs.length, Math.max(1, maxItems));
  const res = [];

  for (let i = 0; i < limit; i++) {
    const d = docs[i] || {};
    const rawTitle = d.title || `Document #${d.id || i + 1}`;
    const title = rawTitle.length > 24 ? `${rawTitle.slice(0, 22)}…` : rawTitle;
    const chunkCount = Number(d.chunks) || 0;
    const chunksText = `${chunkCount} chunk${chunkCount === 1 ? "" : "s"}`;
    const bytes = Number(d.bytes) || 0;
    let sizeText = `${bytes} B`;
    if (bytes >= 1024 * 1024) {
      sizeText = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else if (bytes >= 1024) {
      sizeText = `${(bytes / 1024).toFixed(1)} KB`;
    }

    res.push({
      id: d.id ?? i + 1,
      title,
      chunksText,
      sizeText
    });
  }

  return res;
}

/**
 * Counts chat threads stored in localStorage.
 *
 * @param {string[]} keysArray
 * @returns {number}
 */
export function countLocalChatThreads(keysArray) {
  if (!Array.isArray(keysArray)) return 0;
  return keysArray.filter(k => typeof k === "string" && k.startsWith("vectordb:chats:")).length;
}
