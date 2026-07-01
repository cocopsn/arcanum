// @vitest-environment node
import { describe, it, expect } from "vitest";
import { extractReadable } from "@/lib/extract";

describe("extractReadable — readable content from fetched HTML (renders inside, honest)", () => {
  it("pulls title/headings/paragraphs/code + absolute images, drops noise", () => {
    const html = `<html><head><title>AVL Trees</title></head><body>
      <script>evil()</script><nav>menu</nav>
      <main>
        <h1>Balance</h1>
        <p>Un árbol AVL mantiene el factor de balance en cada nodo para garantizar altura logarítmica y operaciones en O(log n).</p>
        <p>corto</p>
        <pre>rotate(x)</pre>
        <img src="/img/tree.png" alt="tree">
      </main>
      <footer>foot</footer></body></html>`;
    const ex = extractReadable(html, "https://ex.com/avl/");
    expect(ex.title).toBe("AVL Trees");
    expect(ex.blocks.some((b) => b.type === "h" && b.text === "Balance")).toBe(true);
    expect(ex.blocks.some((b) => b.type === "p" && b.text!.includes("factor de balance"))).toBe(true);
    expect(ex.blocks.some((b) => b.text === "corto")).toBe(false); // <40 chars dropped
    expect(ex.blocks.some((b) => b.type === "code" && b.text === "rotate(x)")).toBe(true);
    expect(ex.blocks.find((b) => b.type === "img")?.src).toBe("https://ex.com/img/tree.png"); // relative → absolute
    expect(ex.blocks.some((b) => ["evil()", "menu", "foot"].includes(b.text ?? ""))).toBe(false); // noise removed
    expect(ex.wordCount).toBeGreaterThan(10);
  });

  it("reports low wordCount for a JS-rendered shell → caller shows a preview, not a fake embed", () => {
    const ex = extractReadable('<html><head><title>App</title></head><body><div id="root"></div></body></html>', "https://x.com");
    expect(ex.wordCount).toBeLessThan(120);
  });
});
