// Render seguro del markdown del compañero (design §15, CA-28). Comprueba: ningún <img> ni <script>, ninguna URL
// peligrosa en un href, las citas #cita-Pn como botón sólo si Pn es válido, y las notas al pie en español sin ids
// repetidos entre dos mensajes. Red-checks de §15 (urlTransform identidad, rehype-raw, notasSinIds) en su propio
// archivo; aquí van las aserciones de comportamiento.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Markdown } from "../Markdown";
import { transformarUrl } from "../markdown-urls";

afterEach(cleanup);

describe("markdown-urls (§15)", () => {
  it("deja pasar https: y #cita-P[1-8]; vacía javascript:, JAVASCRIPT:, data:, vbscript: y relativos", () => {
    expect(transformarUrl("https://www.palantir.com/docs/x")).toBe("https://www.palantir.com/docs/x");
    expect(transformarUrl("#cita-P3")).toBe("#cita-P3");
    expect(transformarUrl("javascript:alert(1)")).toBe("");
    expect(transformarUrl("JAVASCRIPT:alert(1)")).toBe("");
    expect(transformarUrl("  javascript:alert(1)")).toBe("");
    expect(transformarUrl("data:text/html,<b>x</b>")).toBe("");
    expect(transformarUrl("vbscript:msgbox(1)")).toBe("");
    expect(transformarUrl("#cita-P9")).toBe("");
    expect(transformarUrl("/ruta/relativa")).toBe("");
    expect(transformarUrl("http://inseguro.test")).toBe("");
  });
});

describe("Markdown (CA-28)", () => {
  it("un enlace javascript: no deja ningún href peligroso ni botón con esa URL", () => {
    const { container } = render(<Markdown texto={"[x](javascript:alert(1)) [y](JAVASCRIPT:alert(1)) [z](data:text/html,x) [w](vbscript:x)"} />);
    for (const a of container.querySelectorAll("a")) {
      const href = a.getAttribute("href") ?? "";
      expect(href.toLowerCase()).not.toContain("javascript:");
      expect(href.toLowerCase()).not.toContain("data:");
      expect(href.toLowerCase()).not.toContain("vbscript:");
    }
  });

  it("no pinta <img> ni <script>: una imagen del modelo queda como texto y no sale ninguna petición", () => {
    const { container } = render(<Markdown texto={"![mapa](https://ejemplo.com/x.png)\n\n<script>alert(1)</script>"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("[imagen: mapa]");
  });

  it("una cita #cita-Pn es botón si Pn es válido; si no, queda como texto", () => {
    const abrir = vi.fn();
    render(<Markdown texto={"ver [la fuente](#cita-P1) y [otra](#cita-P7)"} citasValidas={new Set(["P1"])} alAbrirCita={abrir} />);
    const boton = screen.getByRole("button", { name: "la fuente" });
    boton.click();
    expect(abrir).toHaveBeenCalledWith("P1");
    // P7 no está en la tabla: no hay botón con ese nombre
    expect(screen.queryByRole("button", { name: "otra" })).toBeNull();
    expect(screen.getByText("otra")).toBeTruthy();
  });

  it("https: abre en pestaña nueva con rel seguro", () => {
    render(<Markdown texto={"[docs](https://www.palantir.com/docs/x)"} />);
    const a = screen.getByRole("link", { name: "docs" });
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("dos mensajes con notas al pie: etiqueta «Notas» en español, sin «Footnotes» ni ids repetidos", () => {
    const md = "Afirmo algo.[^1]\n\n[^1]: la nota.";
    const { container } = render(
      <div>
        <Markdown texto={md} />
        <Markdown texto={md} />
      </div>,
    );
    const html = container.innerHTML;
    expect(html).not.toContain("Footnotes");
    expect(html).not.toContain("Back to");
    // la section de notas lleva aria-label en español
    const secciones = container.querySelectorAll("section[data-footnotes]");
    expect(secciones.length).toBe(2);
    for (const s of secciones) expect(s.getAttribute("aria-label")).toBe("Notas");
    // sin ids repetidos en todo el subárbol
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // y ya no queda ningún id="footnote-label"
    expect(container.querySelector("#footnote-label")).toBeNull();
  });
});
