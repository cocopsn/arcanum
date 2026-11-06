import { describe, it, expect } from "vitest";
import { SUBJECT_THEMES, themeForGoal, worldVars } from "@/lib/subject-themes";
import { SPINES } from "@/lib/spines";
import photo from "@/forge/__tests__/fixtures/worldvars-0098936.json";

// CA-01 + §14.2: Forge resolves to its theme by title; every other world resolves to the SAME slug as on 0098936,
// and worldVars of the five themes and the default are identical to the photo captured before the theme changed.
describe("Engineering Forge theme (CA-01, §14.2)", () => {
  it("themeForGoal returns forge for «Engineering Forge» (the new first rule)", () => {
    expect(themeForGoal("Engineering Forge").slug, "themeForGoal no devuelve forge para Engineering Forge").toBe("forge");
    expect(SPINES[SPINES.length - 1]!.goalTitle).toBe("Engineering Forge");
  });

  it("every other title resolves to the slug it had on 0098936", () => {
    for (const [title, slug] of Object.entries(photo.slugByTitle)) {
      if (title === "Engineering Forge") continue;
      expect(themeForGoal(title).slug, title).toBe(slug);
    }
  });

  it("worldVars of the five themes and the default are identical to the 0098936 photo", () => {
    for (const slug of ["itc", "fred", "competitiva", "aleman", "oa"]) {
      expect(worldVars(SUBJECT_THEMES[slug]!), slug).toEqual((photo.worldVars as Record<string, unknown>)[slug]);
    }
    expect(worldVars(themeForGoal("zz sin mundo"))).toEqual(photo.worldVars.default);
  });

  it("the forge theme overrides the globals in its subtree and keeps six-digit hex for the concatenated fields", () => {
    const f = SUBJECT_THEMES.forge!;
    for (const v of [f.accent, f.accent2, f.bg, f.bg2, f.fog, f.light!.accent, f.light!.accent2, f.light!.bg, f.light!.bg2, f.light!.fog]) {
      expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
    const css = worldVars(f) as Record<string, string>;
    expect(css["--accent"]).toBe("#ffffff");
    expect(css["--text"]).toBe("var(--forge-text)");
    expect(css.fontFamily).toBe("var(--font-forge-sans), system-ui, sans-serif");
    expect(f.motif).toBe("ontology");
    expect(f.temper).toBe("La sala de operaciones");
  });
});
