// Renders a page's head tags as React elements (title, meta, links, structured data, inline scripts and styles).
import React from "react";

const NAMES = { class: "className", crossorigin: "crossOrigin", hreflang: "hrefLang", "http-equiv": "httpEquiv", charset: "charSet",
  imagesrcset: "imageSrcSet", imagesizes: "imageSizes", fetchpriority: "fetchPriority", referrerpolicy: "referrerPolicy", nomodule: "noModule" };
const BOOL = new Set(["async", "defer", "nomodule", "crossorigin"]);

export function propsFor(attrs) {
  const p = {};
  for (const [k, v] of Object.entries(attrs)) {
    const name = NAMES[k] || k;
    p[name] = BOOL.has(k) && (v === "" || v === k) ? (k === "crossorigin" ? "" : true) : v;
  }
  return p;
}

export default function PageHead({ nodes }) {
  return nodes.map((n, i) => {
    const props = { key: i, ...propsFor(n.attrs) };
    if (n.tag === "title") return <title key={i}>{n.text}</title>;
    if ((n.tag === "script" || n.tag === "style") && n.text) return React.createElement(n.tag, { ...props, dangerouslySetInnerHTML: { __html: n.text } });
    return React.createElement(n.tag, props);
  });
}
