/**
 * VectorDB Line Icon Registry
 *
 * Zero-dependency SVG icon generator using document.createElementNS.
 * Strict CSP & zero-innerHTML compliant.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const ICON_SPECS = {
  chat: [
    { tag: "path", attrs: { d: "M2.5 3.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-5.5L3.5 13.5v-3H3.5a1 1 0 0 1-1-1v-6z" } }
  ],
  plus: [
    { tag: "line", attrs: { x1: "8", y1: "3", x2: "8", y2: "13" } },
    { tag: "line", attrs: { x1: "3", y1: "8", x2: "13", y2: "8" } }
  ],
  explore: [
    { tag: "circle", attrs: { cx: "8", cy: "8", r: "6" } },
    { tag: "polygon", attrs: { points: "9.8 6.2 8.8 8.8 6.2 9.8 7.2 7.2" } }
  ],
  graph: [
    { tag: "circle", attrs: { cx: "4", cy: "12", r: "1.5" } },
    { tag: "circle", attrs: { cx: "8", cy: "4", r: "1.5" } },
    { tag: "circle", attrs: { cx: "12", cy: "10", r: "1.5" } },
    { tag: "line", attrs: { x1: "5.2", y1: "10.6", x2: "6.8", y2: "5.4" } },
    { tag: "line", attrs: { x1: "9.2", y1: "5.4", x2: "10.8", y2: "8.6" } }
  ],
  compare: [
    { tag: "polyline", attrs: { points: "3 5.5 5.5 3 8 5.5" } },
    { tag: "line", attrs: { x1: "5.5", y1: "3", x2: "5.5", y2: "13" } },
    { tag: "polyline", attrs: { points: "13 10.5 10.5 13 8 10.5" } },
    { tag: "line", attrs: { x1: "10.5", y1: "13", x2: "10.5", y2: "3" } }
  ],
  settings: [
    { tag: "circle", attrs: { cx: "8", cy: "8", r: "2.5" } },
    { tag: "path", attrs: { d: "M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" } }
  ],
  document: [
    { tag: "path", attrs: { d: "M3.5 2.5h6l3 3v8a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-11z" } },
    { tag: "polyline", attrs: { points: "9.5 2.5 9.5 5.5 12.5 5.5" } }
  ],
  trash: [
    { tag: "line", attrs: { x1: "3", y1: "4.5", x2: "13", y2: "4.5" } },
    { tag: "path", attrs: { d: "M6 4.5v-2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2" } },
    { tag: "path", attrs: { d: "M4.5 4.5l.7 9a1 1 0 0 0 1 .9h3.6a1 1 0 0 0 1-.9l.7-9" } }
  ],
  search: [
    { tag: "circle", attrs: { cx: "7", cy: "7", r: "4.5" } },
    { tag: "line", attrs: { x1: "10.2", y1: "10.2", x2: "13.5", y2: "13.5" } }
  ],
  chevron: [
    { tag: "polyline", attrs: { points: "6 4 10 8 6 12" } }
  ],
  chevronDown: [
    { tag: "polyline", attrs: { points: "4 6 8 10 12 6" } }
  ],
  copy: [
    { tag: "rect", attrs: { x: "5.5", y: "5.5", width: "8", height: "8", rx: "1" } },
    { tag: "path", attrs: { d: "M3.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1" } }
  ],
  stop: [
    { tag: "rect", attrs: { x: "4.5", y: "4.5", width: "7", height: "7", rx: "1" } }
  ],
  send: [
    { tag: "line", attrs: { x1: "14", y1: "2", x2: "7", y2: "9" } },
    { tag: "polygon", attrs: { points: "14 2 9.5 14 7 9 2 6.5 14 2" } }
  ],
  info: [
    { tag: "circle", attrs: { cx: "8", cy: "8", r: "6" } },
    { tag: "line", attrs: { x1: "8", y1: "7", x2: "8", y2: "11" } },
    { tag: "line", attrs: { x1: "8", y1: "4.5", x2: "8", y2: "5" } }
  ],
  clock: [
    { tag: "circle", attrs: { cx: "8", cy: "8", r: "6" } },
    { tag: "polyline", attrs: { points: "8 4.5 8 8 11 8" } }
  ],
  layers: [
    { tag: "polygon", attrs: { points: "8 2.5 13.5 5.5 8 8.5 2.5 5.5" } },
    { tag: "polyline", attrs: { points: "2.5 8.5 8 11.5 13.5 8.5" } },
    { tag: "polyline", attrs: { points: "2.5 11.5 8 14.5 13.5 11.5" } }
  ],
  stack: [
    { tag: "polygon", attrs: { points: "8 2.5 13.5 5.5 8 8.5 2.5 5.5" } },
    { tag: "polyline", attrs: { points: "2.5 8.5 8 11.5 13.5 8.5" } },
    { tag: "polyline", attrs: { points: "2.5 11.5 8 14.5 13.5 11.5" } }
  ],
  target: [
    { tag: "circle", attrs: { cx: "8", cy: "8", r: "6" } },
    { tag: "circle", attrs: { cx: "8", cy: "8", r: "3.5" } },
    { tag: "circle", attrs: { cx: "8", cy: "8", r: "1" } }
  ],
  database: [
    { tag: "ellipse", attrs: { cx: "8", cy: "4.5", rx: "6", ry: "2.5" } },
    { tag: "path", attrs: { d: "M2 4.5v7c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-7" } },
    { tag: "path", attrs: { d: "M2 8c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5" } }
  ],
  user: [
    { tag: "circle", attrs: { cx: "8", cy: "5", r: "3" } },
    { tag: "path", attrs: { d: "M2.5 14c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4" } }
  ],
  chevronUp: [
    { tag: "polyline", attrs: { points: "4 10 8 6 12 10" } }
  ],
  external: [
    { tag: "path", attrs: { d: "M10 2.5h3.5v3.5" } },
    { tag: "line", attrs: { x1: "7.5", y1: "8.5", x2: "13.5", y2: "2.5" } },
    { tag: "path", attrs: { d: "M11.5 8v4.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1H8" } }
  ],
  chart: [
    { tag: "line", attrs: { x1: "4", y1: "13.5", x2: "4", y2: "8.5" } },
    { tag: "line", attrs: { x1: "8", y1: "13.5", x2: "8", y2: "4.5" } },
    { tag: "line", attrs: { x1: "12", y1: "13.5", x2: "12", y2: "10.5" } }
  ]
};

/**
 * Creates an SVG icon element.
 *
 * @param {string} name - Name of the icon
 * @param {number} [size=16] - Size in pixels (width and height)
 * @param {string} [className=""] - Optional extra CSS class
 * @returns {SVGElement}
 */
export function createIcon(name, size = 16, className = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const classes = ["icon", `icon-${name}`];
  if (className) {
    classes.push(className);
  }
  svg.setAttribute("class", classes.join(" "));

  const spec = ICON_SPECS[name] || ICON_SPECS.info;
  for (const node of spec) {
    const el = document.createElementNS(SVG_NS, node.tag);
    for (const [k, v] of Object.entries(node.attrs)) {
      el.setAttribute(k, v);
    }
    svg.appendChild(el);
  }

  return svg;
}

if (typeof window !== "undefined") {
  window.Icons = { createIcon };
}

