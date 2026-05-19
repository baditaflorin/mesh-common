import { useMemo, type CSSProperties, type ReactElement } from "react";
import { marked } from "marked";
import { safeText } from "./security/safeText";

/**
 * Markdown renderer for chat / notes / decision logs. Backed by `marked`
 * (single file, zero deps) plus a manual allow-list sanitization step.
 *
 * The sanitization model is conservative on purpose. We don't pull DOMPurify —
 * for chat-shaped markdown, an allow-list of tags + attributes is enough:
 *
 *   allowed tags: p, br, strong, em, code, pre, blockquote, ul, ol, li, h1..h6, hr,
 *                 a (href only, scheme-validated), del, span (class only)
 *   stripped: script, style, iframe, object, embed, link, meta, on* attrs,
 *             javascript:/data: URLs (except data:image), srcset, etc.
 *
 * If you need raw HTML pass-through, use a different renderer. If you need
 * tables/footnotes/etc., enable the `gfm` flag (default off — keeps the
 * surface small).
 */

export type SafeMarkdownProps = {
  source: string;
  /** Enable GitHub-flavored markdown (tables, strikethrough, autolinks). Default false. */
  gfm?: boolean;
  className?: string;
  style?: CSSProperties;
  /** If true, render only inline-level markdown (no <p>/blockquote/etc.). */
  inline?: boolean;
};

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "em", "code", "pre", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "a", "del", "span",
]);

const ALLOWED_ATTRS: Record<string, ReadonlyArray<string>> = {
  a: ["href"],
  span: ["class"],
};

function sanitizeHtml(html: string): string {
  if (typeof document === "undefined") return ""; // SSR: just drop it
  const tmpl = document.createElement("template");
  tmpl.innerHTML = html;
  const walker = document.createTreeWalker(tmpl.content, NodeFilter.SHOW_ELEMENT);
  const toRemove: Element[] = [];
  let node = walker.nextNode() as Element | null;
  while (node) {
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      toRemove.push(node);
    } else {
      const allowed = ALLOWED_ATTRS[tag] ?? [];
      for (const attr of Array.from(node.attributes)) {
        if (!allowed.includes(attr.name)) {
          node.removeAttribute(attr.name);
          continue;
        }
        if (tag === "a" && attr.name === "href") {
          const safe = safeText(attr.value); // overkill but cheap
          void safe;
          const v = attr.value.trim();
          // Block dangerous schemes; allow http(s), mailto, tel, relative, hash.
          if (
            /^javascript:/i.test(v) ||
            (/^data:/i.test(v) && !/^data:image\//i.test(v)) ||
            /^vbscript:/i.test(v)
          ) {
            node.removeAttribute("href");
          } else {
            node.setAttribute("rel", "noopener noreferrer");
            node.setAttribute("target", "_blank");
          }
        }
      }
    }
    node = walker.nextNode() as Element | null;
  }
  // Replace disallowed elements with their text content, in document order.
  for (const el of toRemove) {
    const text = document.createTextNode(el.textContent ?? "");
    el.parentNode?.replaceChild(text, el);
  }
  return tmpl.innerHTML;
}

export function renderMarkdownToSafeHtml(source: string, gfm = false, inline = false): string {
  marked.setOptions({ gfm, breaks: true, async: false });
  const raw = inline ? marked.parseInline(source) : marked.parse(source);
  if (typeof raw !== "string") return "";
  return sanitizeHtml(raw);
}

export function SafeMarkdown({
  source,
  gfm = false,
  className,
  style,
  inline = false,
}: SafeMarkdownProps): ReactElement {
  const html = useMemo(() => renderMarkdownToSafeHtml(source, gfm, inline), [source, gfm, inline]);
  return (
    <div
      className={className}
      style={style}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
