/**
 * VectorDB HTTP API Client Module
 *
 * Implements a robust fetch wrapper for the VectorDB REST API endpoints.
 * Enforces strict Content-Type headers, handles error conversions, timeouts,
 * and maintains UI button busy states.
 */

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ApiError";
    this.code = code || "unknown_error";
    this.status = status || 500;
  }
}

/**
 * Global Error Banner Controller
 */
const bannerEl = typeof document !== "undefined" ? document.getElementById("global-error-banner") : null;
const bannerTextEl = typeof document !== "undefined" ? document.getElementById("global-error-text") : null;
const bannerDismissBtn = typeof document !== "undefined" ? document.getElementById("global-error-dismiss") : null;

if (bannerDismissBtn && bannerEl) {
  bannerDismissBtn.addEventListener("click", () => {
    bannerEl.classList.add("hidden");
  });
}

export function showGlobalError(code, message) {
  if (!bannerEl || !bannerTextEl) return;
  const prefix = code ? `[${code}] ` : "";
  bannerTextEl.textContent = `${prefix}${message}`;
  bannerEl.classList.remove("hidden");
}

export function clearGlobalError() {
  if (bannerEl) {
    bannerEl.classList.add("hidden");
  }
}

/**
 * Executes an async task while marking a button as disabled and busy.
 * Restores original state upon completion or failure.
 */
export async function withButtonBusy(button, fn) {
  if (!button) return await fn();
  const originalDisabled = button.disabled;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    return await fn();
  } finally {
    button.disabled = originalDisabled;
    button.removeAttribute("aria-busy");
  }
}

/**
 * Builds fetch request options ensuring strict Content-Type and valid JSON body
 * for POST/PUT/PATCH methods (deliberate CSRF defense requirement).
 */
export function buildRequestInit(options = {}) {
  const {
    method = "GET",
    body = null,
    headers = {}
  } = options;

  const reqHeaders = { ...headers };
  const isPayloadMethod = (method === "POST" || method === "PUT" || method === "PATCH");

  let reqBody = null;
  if (isPayloadMethod) {
    reqHeaders["Content-Type"] = "application/json";
    if (body === null || body === undefined) {
      reqBody = "{}";
    } else {
      reqBody = typeof body === "string" ? body : JSON.stringify(body);
    }
  } else if (body !== null && body !== undefined) {
    reqBody = typeof body === "string" ? body : JSON.stringify(body);
  }

  return {
    method,
    headers: reqHeaders,
    body: reqBody
  };
}

/**
 * Universal JSON Fetch Wrapper with per-call timeout and abort support.
 */
export async function apiRequest(endpoint, options = {}) {
  const {
    timeoutMs = 30000,
    signal = null,
    ...initOptions
  } = options;

  const init = buildRequestInit(initOptions);

  // Compose per-call timeout with caller signal
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(() => timeoutCtrl.abort(), timeoutMs);

  let combinedSignal = timeoutCtrl.signal;
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException("Request aborted", "AbortError");
    }
    signal.addEventListener("abort", () => timeoutCtrl.abort(), { once: true });
  }

  init.signal = combinedSignal;

  try {
    const res = await fetch(endpoint, init);

    // Parse JSON safely
    let data = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json().catch(() => null);
    }

    if (!res.ok) {
      let code = "http_error";
      let msg = `Request failed with status ${res.status}`;
      if (data && data.error) {
        code = data.error.code || code;
        msg = data.error.message || msg;
      }
      throw new ApiError(code, msg, res.status);
    }

    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ApiError("request_aborted", "The request timed out or was aborted by the user", 408);
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError("network_error", err.message || "Failed to communicate with VectorDB server", 0);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds the payload for /api/demo/random, ensuring the server contract ('n') is always satisfied.
 * Accepts either a numeric count or an object.
 */
export function buildDemoRandomPayload(countOrPayload) {
  if (typeof countOrPayload === "object" && countOrPayload !== null) {
    if ("count" in countOrPayload && !("n" in countOrPayload)) {
      return { n: Number(countOrPayload.count) };
    }
    return countOrPayload;
  }
  return { n: Number(countOrPayload) };
}

/**
 * Typed API Endpoint Methods
 */
export const api = {
  // System & Health
  getHealth: () => apiRequest("/api/health"),
  getConfig: () => apiRequest("/api/config"),
  getStats: () => apiRequest("/api/stats"),
  getOllamaStatus: () => apiRequest("/api/ollama/status"),

  // Document RAG
  getDocs: () => apiRequest("/api/docs"),
  getDoc: (id) => apiRequest(`/api/docs/${encodeURIComponent(id)}`),
  ingestDoc: (payload, signal) => apiRequest("/api/docs", { method: "POST", body: payload, timeoutMs: 60000, signal }),
  resetDocs: () => apiRequest("/api/docs/reset", { method: "POST" }),

  // Demo Collection Management
  resetDemo: (payload) => apiRequest("/api/reset", { method: "POST", body: payload }),
  insertDemoRandom: (n) => apiRequest("/api/demo/random", { method: "POST", body: buildDemoRandomPayload(n) }),
  getVector: (id) => apiRequest(`/api/vectors/${encodeURIComponent(id)}`),

  // 2D PCA Projections
  getPca: (limit = 5000) => apiRequest(`/api/pca?limit=${encodeURIComponent(limit)}`),
  getDocsPca: (limit = 5000) => apiRequest(`/api/docs/pca?limit=${encodeURIComponent(limit)}`),
  queryPca: (payload) => apiRequest("/api/pca/query", { method: "POST", body: payload }),
  queryDocsPca: (payload) => apiRequest("/api/docs/pca/query", { method: "POST", body: payload, timeoutMs: 30000 }),

  // HNSW Topology & Search Path Trace
  getHnswInfo: () => apiRequest("/api/hnsw/info"),
  getDocsHnswInfo: () => apiRequest("/api/docs/hnsw/info"),
  getHnswGraph: (layer = 0, maxEdges = 20000) => apiRequest(`/api/hnsw/graph?layer=${encodeURIComponent(layer)}&max_edges=${encodeURIComponent(maxEdges)}`),
  getDocsHnswGraph: (layer = 0, maxEdges = 20000) => apiRequest(`/api/docs/hnsw/graph?layer=${encodeURIComponent(layer)}&max_edges=${encodeURIComponent(maxEdges)}`),
  traceHnsw: (payload) => apiRequest("/api/hnsw/trace", { method: "POST", body: payload }),

  // Multi-Algorithm Benchmarks
  benchmark: (payload) => apiRequest("/api/benchmark", { method: "POST", body: payload }),
  benchmarkDocs: (payload) => apiRequest("/api/docs/benchmark", { method: "POST", body: payload, timeoutMs: 30000 })
};

