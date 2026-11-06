import { describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VideoEmbed, youtubeIdFromHref, isCataloguedVideo } from "@/ui/media/VideoEmbed";
import videos from "@/forge/data/videos.json";

// Design §13.1/§13.3: only the two exact YouTube forms yield an id; only a catalogued id gets a player; before the
// click there is no iframe (no request to Google); after it, the privacy-enhanced host inside the 16:9 box.
const KNOWN = (videos as { youtube: { id: string }[] }).youtube[0]!.id;

describe("VideoEmbed", () => {
  it("takes the id only from the two exact forms", () => {
    expect(youtubeIdFromHref(`https://www.youtube.com/watch?v=${KNOWN}`)).toBe(KNOWN);
    expect(youtubeIdFromHref(`https://youtu.be/${KNOWN}`)).toBe(KNOWN);
    expect(youtubeIdFromHref(`https://www.youtube.com/watch?v=${KNOWN}&t=30`)).toBeNull();
    expect(youtubeIdFromHref(`https://evil.example/watch?v=${KNOWN}`)).toBeNull();
    expect(youtubeIdFromHref("https://youtu.be/short")).toBeNull();
    expect(isCataloguedVideo("AAAAAAAAAAA")).toBe(false);
  });

  it("a catalogued id shows the facade, and the nocookie player only after the click", () => {
    const view = render(<VideoEmbed id={KNOWN} label="Video de prueba" href={`https://youtu.be/${KNOWN}`} />);
    expect(view.container.querySelector("iframe"), "el video pidió a YouTube antes del clic").toBeNull();
    expect(screen.getByText("Video no revisado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir aquí" }));
    const src = view.container.querySelector("iframe")?.getAttribute("src") ?? "";
    expect(src, "el video no usa el reproductor sin cookies").toBe(`https://www.youtube-nocookie.com/embed/${KNOWN}?rel=0&autoplay=1`);
    cleanup();
  });

  it("an id outside the catalogue is a plain link marked «video externo», never an iframe", () => {
    const view = render(<VideoEmbed id="AAAAAAAAAAA" label="Otro" href="https://youtu.be/AAAAAAAAAAA" />);
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(view.container.textContent).toContain("video externo");
    cleanup();
  });
});
