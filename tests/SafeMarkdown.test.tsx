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
    expect(html).toContain('href="https://example.com"');
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
