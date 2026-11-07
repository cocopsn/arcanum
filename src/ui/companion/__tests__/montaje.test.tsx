// Protección (a) (design §3.4, §23.2; CA-01, CA-02, CA-03, CA-05, CA-06): la vista de abajo nunca se desmonta, nunca se
// re-renderiza, el store no recibe escrituras, el resume no cambia, <html>/<body> no se tocan y ningún Escape del
// compañero llega a los oyentes de window. La escena real (Hermanos) pasa; los red-checks viven en
// montaje.redcheck.test.tsx. Las pruebas que cargan el chunk perezoso del compañero llevan timeout de 30 s.
import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";
import {
  Hermanos,
  RESUME,
  contarCompaneros,
  correrEscena,
  esperar,
  esperarListo,
  montar,
  orbe,
  panel,
  DosMontajes,
} from "./escena";
import { CompanionMount } from "@/ui/companion/CompanionMount";

const T = 30_000;

describe("protección (a): la vista de abajo no se entera (design §3.4)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it(
    "20 ciclos de abrir, Escape, ocultar, pestillo y Ctrl+.: 1 montaje, 0 commits de más, 0 escrituras, resume intacto",
    async () => {
      const { pasos } = await correrEscena(Hermanos, 20);
      expect(pasos, "la escena no corrió los 20 ciclos completos").toBe(20 * 6);
    },
    T,
  );

  it(
    "CA-01: con dos montajes y un remontaje hay exactamente un #arcanum-companion y un [data-companion-chunk]",
    async () => {
      const m = montar(({ vista }) => (
        <>
          {vista}
          <DosMontajes M={CompanionMount} />
        </>
      ));
      try {
        await esperarListo();
        await esperar(300);
        expect(() => contarCompaneros()).not.toThrow();
        // remontaje: desmontar y volver a montar no deja un segundo compañero ni un contenedor huérfano
        m.r.unmount();
        await esperar(50);
        expect(document.querySelectorAll("#arcanum-companion").length, "quedó un contenedor huérfano").toBe(0);
      } finally {
        m.r.unmount();
      }
    },
    T,
  );

  it(
    "CA-03: el resume queda byte a byte igual tras abrir y cerrar el compañero",
    async () => {
      localStorage.setItem("arcanum_resume", RESUME);
      const m = montar(Hermanos);
      try {
        await esperarListo();
        await esperar(300);
        const antes = localStorage.getItem("arcanum_resume");
        act(() => {
          orbe()!.click();
        });
        await esperar(50);
        expect(panel(), "no abrió el panel").not.toBeNull();
        expect(localStorage.getItem("arcanum_resume"), "el compañero cambió el resume").toBe(antes);
        expect(localStorage.getItem("arcanum_resume")).toBe(RESUME);
      } finally {
        m.r.unmount();
      }
    },
    T,
  );
});
