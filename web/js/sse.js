/**
 * VectorDB Server-Sent Events (SSE) Parser & Stream Reader
 *
 * Implements a standards-compliant SSE event stream parser designed to handle:
 * 1. Events split arbitrarily across network chunk boundaries.
 * 2. UTF-8 multi-byte code units split across chunk buffers using TextDecoder stream mode.
 * 3. SSE comments (:), custom event types, and multiline data payloads.
 */

export class SseParser {
  constructor() {
    this.buffer = "";
  }

  /**
   * Feeds a string fragment into the parser buffer and extracts complete SSE messages.
   * Dispatches complete messages upon encountering empty lines (\n\n or \r\n\r\n).
   *
   * @param {string} chunk - Newly received string slice
   * @returns {Array<{event: string, data: string, id?: string}>} Array of parsed events
   */
  feed(chunk) {
    if (!chunk) return [];
    this.buffer += chunk;

    const events = [];
    // Normalize CRLF and CR to standard LF for uniform line parsing
    const lines = this.buffer.split(/\r\n|\r|\n/);

    // The last element is either empty (if buffer ended on newline) or an incomplete line
    this.buffer = lines.pop();

    let currentEvent = { event: "message", data: [] };
    let hasData = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Empty line marks end of an SSE message block
      if (line === "") {
        if (hasData) {
          events.push({
            event: currentEvent.event,
            data: currentEvent.data.join("\n"),
            ...(currentEvent.id ? { id: currentEvent.id } : {})
          });
        }
        currentEvent = { event: "message", data: [] };
        hasData = false;
        continue;
      }

      // Ignore comment lines (starting with colon)
      if (line.startsWith(":")) {
        continue;
      }

      // Parse field:value
      const colonIndex = line.indexOf(":");
      let field = line;
      let value = "";

      if (colonIndex !== -1) {
        field = line.slice(0, colonIndex);
        value = line.slice(colonIndex + 1);
        // Remove single leading space if present per SSE specification
        if (value.startsWith(" ")) {
          value = value.slice(1);
        }
      }

      if (field === "event") {
        currentEvent.event = value;
        hasData = true;
      } else if (field === "data") {
        currentEvent.data.push(value);
        hasData = true;
      } else if (field === "id") {
        currentEvent.id = value;
      }
    }

    return events;
  }

  /**
   * Resets parser state and clears unconsumed buffer.
   */
  reset() {
    this.buffer = "";
  }
}

/**
 * Reads an HTTP response body stream using TextDecoder with streaming UTF-8 preservation.
 *
 * @param {Response} response - Fetch response with ReadableStream body
 * @param {Object} callbacks
 * @param {Function} callbacks.onEvent - Called with parsed { event, data }
 * @param {Function} [callbacks.onError] - Called on network/parsing error
 * @param {Function} [callbacks.onDone] - Called when stream completes cleanly
 * @param {AbortSignal} [callbacks.signal] - Caller abort signal
 */
export async function readSseStream(response, { onEvent, onError, onDone, signal } = {}) {
  if (!response.body) {
    if (onError) onError(new Error("Response body is not readable"));
    return;
  }

  const reader = response.body.getReader();
  // stream: true preserves partial multi-byte UTF-8 sequences across chunks
  const decoder = new TextDecoder("utf-8", { stream: true });
  const parser = new SseParser();

  let aborted = false;
  if (signal) {
    if (signal.aborted) {
      try { await reader.cancel(); } catch (_) {}
      return;
    }
    signal.addEventListener("abort", async () => {
      aborted = true;
      try { await reader.cancel(); } catch (_) {}
    }, { once: true });
  }

  try {
    while (true) {
      if (aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      const textChunk = decoder.decode(value, { stream: true });
      const events = parser.feed(textChunk);

      for (const ev of events) {
        if (onEvent) {
          onEvent(ev);
        }
      }
    }

    // Flush any remaining characters in decoder buffer
    const remaining = decoder.decode();
    if (remaining) {
      const finalEvents = parser.feed(remaining);
      for (const ev of finalEvents) {
        if (onEvent) onEvent(ev);
      }
    }

    if (onDone) onDone();
  } catch (err) {
    if (signal && signal.aborted) {
      // Intentional abort is not an unexpected error
      if (onDone) onDone();
      return;
    }
    if (onError) onError(err);
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }
}

