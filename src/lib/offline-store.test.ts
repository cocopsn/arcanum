import { describe, it, expect } from "vitest";
import { saveOfflineSource, getOfflineSource, saveSpineIndex, listDownloadedSpines, deleteSpineDownload } from "@/lib/offline-store";

describe("offline-store — the download cache round-trips (Spotify-style offline)", () => {
  it("saves and reads back an extracted source (offline-first read hits this)", async () => {
    const url = "https://ex.com/offline-store-test/lec1";
    const data = { mode: "extracted", title: "Lec 1", blocks: [{ type: "p", text: "hola" }] };
    const bytes = await saveOfflineSource(url, data);
    expect(bytes).toBeGreaterThan(0);
    expect(await getOfflineSource(url)).toEqual(data);
  });

  it("tracks a downloaded spine and deleting it purges its sources", async () => {
    const url = "https://ex.com/offline-store-test/lec1";
    await saveSpineIndex({ goalId: "g-test", title: "FrED", sourceCount: 3, bytes: 1000, ts: 0 });
    expect((await listDownloadedSpines()).some((s) => s.goalId === "g-test")).toBe(true);
    await deleteSpineDownload("g-test", [url]);
    expect((await listDownloadedSpines()).some((s) => s.goalId === "g-test")).toBe(false);
    expect(await getOfflineSource(url)).toBeNull();
  });

  it("getOfflineSource returns null for an uncached url (→ the viewer shows 'requires connection')", async () => {
    expect(await getOfflineSource("https://ex.com/never-cached")).toBeNull();
  });
});
