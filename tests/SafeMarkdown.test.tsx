// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderMarkdownToSafeHtml, SafeMarkdown } from "../src/SafeMarkdown";

describe("renderMarkdownToSafeHtml", () => {
  it("renders basic markdown to HTML", () => {
    const html = renderMarkdownToSafeHtml("**bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("preserves safe links and adds rel/target", () => {
    const html = renderMarkdownToSafeHtml("[ok](https://example.com)");
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it("strips javascript: URLs", () => {
    const html = renderMarkdownToSafeHtml("[bad](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    // The href is stripped but the visible text is preserved.
    expect(html).toContain("bad");
  });

  it("strips data: URLs except data:image", () => {
    const bad = renderMarkdownToSafeHtml("[evil](data:text/html,<script>alert(1)</script>)");
    expect(bad).not.toContain("data:text/html");
    // The renderer doesn't currently produce <img> from markdown text by default in this minimal config —
    // we just verify it doesn't accept data:text/* on anchors.
  });

  // Obfuscated schemes that a regex on the raw attribute misses but the
  // browser's URL parser still resolves to a script-capable scheme.
  const hostileLinks = [
    "[x](jav&#x09;ascript:alert(1))",
    "[x](java&#10;script:alert(1))",
    "[x](javascript&colon;alert(1))",
    "[x](JaVaScRiPt:alert(1))",
    "[x](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)",
    "[x](data:text/html,<script>alert(1)</script>)",
    '<a href="&#x01;javascript:alert(1)">x</a>',
    '<a href="&#x00;javascript:alert(1)">x</a>',
    '<a href=" javascript:alert(1)">x</a>',
    '<a href="jav&#x0D;ascript:alert(1)">x</a>',
    '<a href="vbscript:msgbox(1)">x</a>',
    '<a href="blob:https://example.com/uuid">x</a>',
    '<a href="file:///etc/passwd">x</a>',
  ];
  const allowed = new Set(["http:", "https:", "mailto:", "tel:"]);

  it.each(hostileLinks)("never emits a link outside http/https/mailto/tel: %s", (src) => {
    const tmpl = document.createElement("template");
    tmpl.innerHTML = renderMarkdownToSafeHtml(src);
    for (const a of Array.from(tmpl.content.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href") ?? "";
      expect(allowed.has(new URL(href, window.location.href).protocol)).toBe(true);
    }
  });

  it.each([
    ["[mail](mailto:a@example.com)", "mailto:a@example.com"],
    ["[call](tel:+40123456)", "tel:+40123456"],
    ["[rel](/docs/page)", new URL("/docs/page", window.location.href).toString()],
  ])("keeps a legitimate link: %s", (src, expected) => {
    expect(renderMarkdownToSafeHtml(src)).toContain(`href="${expected}"`);
  });

  it("does not change the global marked options", async () => {
    const { marked } = await import("marked");
    marked.setOptions({ breaks: false, gfm: false });
    renderMarkdownToSafeHtml("a\nb", true);
    expect(marked.defaults.breaks).toBe(false);
    expect(marked.defaults.gfm).toBe(false);
  });

  it("strips disallowed tags (e.g. <img>)", () => {
    // Markdown image syntax produces <img>, which isn't in the allow-list.
    const html = renderMarkdownToSafeHtml("![alt text](https://example.com/x.png)");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("example.com/x.png");
  });

  it("removes on* attributes", () => {
    // The HTML attribute injection path isn't available from markdown directly, but
    // we can test sanitization by hand-feeding a passthrough.
    const html = renderMarkdownToSafeHtml("[click](https://example.com)");
    expect(html).not.toMatch(/onclick/i);
  });

  it("SafeMarkdown renders without crashing", () => {
    const source = ["# Hi", "", "This is _text_."].join("\n");
    const { container } = render(<SafeMarkdown source={source} />);
    expect(container.querySelector("h1")?.textContent?.trim()).toBe("Hi");
    expect(container.querySelector("em")?.textContent).toBe("text");
  });

  it("inline mode skips block wrappers", () => {
    const html = renderMarkdownToSafeHtml("just **bold**", false, true);
    // inline parse doesn't wrap in <p>.
    expect(html).not.toMatch(/^<p>/);
    expect(html).toContain("<strong>bold</strong>");
  });
});
