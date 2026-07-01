import { describe, it, expect } from "vitest";
import { classifySource } from "@/lib/source-kind";

describe("classifySource — decides how a source enters Arcanum", () => {
  it("YouTube (all forms) → nocookie embed", () => {
    for (const u of [
      "https://www.youtube.com/watch?v=8mAITcNt710",
      "https://youtu.be/8mAITcNt710",
      "https://www.youtube.com/embed/8mAITcNt710",
      "https://www.youtube.com/watch?list=x&v=8mAITcNt710",
    ]) {
      const c = classifySource(u);
      expect(c.kind).toBe("youtube");
      expect(c.videoId).toBe("8mAITcNt710");
      expect(c.embedUrl).toBe("https://www.youtube-nocookie.com/embed/8mAITcNt710");
    }
  });

  it("Vimeo → player embed", () => {
    const c = classifySource("https://vimeo.com/123456789");
    expect(c.kind).toBe("vimeo");
    expect(c.embedUrl).toBe("https://player.vimeo.com/video/123456789");
  });

  it("image URLs → image", () => {
    expect(classifySource("https://x.com/a/avl.svg").kind).toBe("image");
    expect(classifySource("https://x.com/a/tree.png?v=2").kind).toBe("image");
  });

  it("everything else → page (server-fetch, never a forced iframe)", () => {
    expect(classifySource("https://ocw.mit.edu/courses/6-006/resources/lec1/").kind).toBe("page");
    expect(classifySource("https://cs61b-2.gitbook.io/cs61b/x").kind).toBe("page");
  });

  it("builds a readable label (host + path hint)", () => {
    expect(classifySource("https://cs50.harvard.edu/x/weeks/1/").label).toContain("cs50.harvard.edu");
  });
});
