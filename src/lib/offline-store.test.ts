import { describe, it, expect } from "vitest";
import { saveOfflineSource, getOfflineSource, saveSpineIndex, listDownloadedSpines, deleteSpineDownloadSafe } from "@/lib/offline-store";

describe("offline-store — the download cache round-trips (Spotify-style offline)", () => {
  it("saves and reads back an extracted source (offline-first read hits this)", async () => {
    const url = "https://ex.com/offline-store-test/lec1";
    const data = { mode: "extracted", title: "Lec 1", blocks: [{ type: "p", text: "hola" }] };
    const bytes = await saveOfflineSource(url, data);
    expect(bytes).toBeGreaterThan(0);
    expect(await getOfflineSource(url)).toEqual(data);
  });

  it("tracks a downloaded spine and the safe delete purges its (exclusive) sources", async () => {
    const url = "https://ex.com/offline-store-test/lec1";
    await saveOfflineSource(url, { mode: "extracted", title: "Lec 1" });
    await saveSpineIndex({ goalId: "g-test", title: "FrED", sourceCount: 1, urls: [url], bytes: 1000, ts: 0 });
    expect((await listDownloadedSpines()).some((s) => s.goalId === "g-test")).toBe(true);
    const res = await deleteSpineDownloadSafe("g-test"); // no sibling needs this url → freed
    expect(res.freedBytes).toBeGreaterThan(0);
    expect((await listDownloadedSpines()).some((s) => s.goalId === "g-test")).toBe(false);
    expect(await getOfflineSource(url)).toBeNull();
  });

  it("getOfflineSource returns null for an uncached url (→ the viewer shows 'requires connection')", async () => {
    expect(await getOfflineSource("https://ex.com/never-cached")).toBeNull();
  });
});
