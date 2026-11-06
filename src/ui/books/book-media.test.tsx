import { describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MD } from "@/ui/books/BookReader";

// Design §13.1/§13.3: a paragraph with only an image titled "figura <docs page>" becomes an attributed figure when
// the src is a CSP-allowed origin and the page is a docs page; otherwise alt + link, NEVER an <img> to another
// origin. A paragraph with only a link titled "video" and an id outside the two exact forms stays a link.
const md = (s: string) => render(<ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{s}</ReactMarkdown>);

describe("book media paragraphs", () => {
  it("an allowed docs figure is an attributed <img>", () => {
    const v = md('![Diagrama](https://www.palantir.com/docs/resources/foundry/x.svg "figura https://www.palantir.com/docs/foundry/x/overview")');
    const img = v.container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://www.palantir.com/docs/resources/foundry/x.svg");
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(v.container.textContent).toContain("Imagen: Palantir Technologies Inc.");
    expect(v.container.querySelector("p figure")).toBeNull();
    cleanup();
  });

  it("a figure from another origin never becomes an <img>", () => {
    const v = md('![Diagrama](https://evil.example/x.png "figura https://www.palantir.com/docs/foundry/x/overview")');
    expect(v.container.querySelector("img"), "el lector pintó una imagen de un origen no permitido").toBeNull();
    expect(v.container.textContent).toContain("Diagrama");
    cleanup();
  });

  it("a video link with extra parameters stays a link marked «video externo», never an iframe", () => {
    const v = md('[Charla](https://www.youtube.com/watch?v=1F7apO2hFXk&t=30 "video")');
    expect(v.container.querySelector("iframe")).toBeNull();
    expect(v.container.querySelector("a")?.getAttribute("href")).toBe("https://www.youtube.com/watch?v=1F7apO2hFXk&t=30");
    expect(v.container.textContent).toContain("video externo");
    cleanup();
  });

  it("an ordinary paragraph is unchanged", () => {
    const v = md("Un párrafo con [un enlace](https://example.org).");
    expect(v.container.querySelector("p")?.textContent).toBe("Un párrafo con un enlace.");
    cleanup();
  });
});
