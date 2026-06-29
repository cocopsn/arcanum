import { describe, it, expect } from "vitest";
import { parseWikilinks } from "@/core/wikilink";

describe("parseWikilinks", () => {
  it("extracts plain targets", () => {
    expect(parseWikilinks("ver [[Foo]] y [[Bar Baz]] aquí")).toEqual(["Foo", "Bar Baz"]);
  });

  it("strips alias and heading suffixes", () => {
    expect(parseWikilinks("[[Foo|otra cosa]] y [[Bar#sección]]")).toEqual(["Foo", "Bar"]);
  });

  it("dedupes repeats", () => {
    expect(parseWikilinks("[[A]] luego [[A]] otra vez")).toEqual(["A"]);
  });

  it("returns [] when there are no links", () => {
    expect(parseWikilinks("texto sin enlaces")).toEqual([]);
  });
});
