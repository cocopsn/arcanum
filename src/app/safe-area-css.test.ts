import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Diseño poblar §7.1 y §7.6, anexo r2 [2]. happy-dom no tiene diseño: la protección estática es que globals.css declara
// las cuatro variables desde env() y que ninguna superficie de la rama bordes usa env(safe-area-inset…) directo. Así la
// matriz de Playwright puede simular la Dynamic Island escribiendo --safe-* en <html>. La integración extiende la lista
// a toda la tabla de §7.2 cuando mergea las ramas de cada tanda.
const ROOT = process.cwd();
export const SAFE_AREA_FILES = [
  "src/forge/ui/ForgeWorld.tsx",
  "src/forge/ui/atlas/AtlasPanel.tsx",
  "src/ui/subject/TopicDetailSheet.tsx",
  "src/ui/subject/SubjectMap.tsx",
  "src/ui/subject/LessonMode.tsx",
  "src/ui/subject/TutorSheet.tsx",
  "src/ui/exercises/ExerciseMode.tsx",
  "src/ui/books/BookReader.tsx",
  "src/ui/books/BooksLibrary.tsx",
  "src/ui/OfflineStatus.tsx",
  "src/ui/AudioConfig.tsx",
  "src/ui/notes/NotesModule.tsx",
  "src/ui/notes/InkCanvas.tsx",
  "src/ui/roadmap/RoadmapCanvas.tsx",
  "src/ui/roadmap/NodeDetailSheet.tsx",
  "src/ui/AgendaSheet.tsx",
  "src/ui/CodiceSheet.tsx",
  "src/ui/VigiliaSheet.tsx",
  "src/ui/AuthSheet.tsx",
  "src/ui/InstallCoachMark.tsx",
] as const;

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("áreas seguras (diseño poblar §7.1)", () => {
  it("globals.css declares the four --safe-* variables from env()", () => {
    const css = read("src/app/globals.css");
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(css, `globals.css no declara --safe-${side} desde env(safe-area-inset-${side})`).toMatch(
        new RegExp(`--safe-${side}:\\s*env\\(safe-area-inset-${side}`),
      );
    }
    expect(css).toMatch(/--companion-reserve-right:\s*0px/);
    expect(css).toMatch(/\.tap\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
  });

  it.each(SAFE_AREA_FILES)("%s reads the safe areas through var(--safe-*), never env() directly", (rel) => {
    const name = path.basename(rel, ".tsx");
    expect(read(rel).includes("env(safe-area-inset"), `${name} usa env() directo y la prueba no puede simular la Dynamic Island`).toBe(false);
  });
});
