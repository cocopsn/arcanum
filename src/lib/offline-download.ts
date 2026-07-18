import { classifySource } from "@/lib/source-kind";
import { saveOfflineSource, saveSpineIndex } from "@/lib/offline-store";

// "Download for offline" (Spotify model), at SPINE level. With the network ON, precache the curated
// Layer-A content of the spine so it's readable offline: fetch + store the EXTRACTED text of each page
// source. Video is NOT cached (can't legally cache the YouTube stream) — its metadata (title/URL) lives
// in code and shows "video con conexión" offline, honest. Diagrams + cell structure are already local
// (bundled). A partial download (some fetch failed) is honest — we store what we got + the real count.

export interface DownloadResult {
  goalId: string;
  sourceCount: number;
  cached: number;
  bytes: number;
}

/** urls = all sourceUrls (+videoUrls) across the spine's cells. Only PAGE sources are fetched/cached. */
export async function downloadSpine(
  goalId: string,
  title: string,
  urls: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<DownloadResult> {
  const pages = [...new Set(urls)].filter((u) => classifySource(u).kind === "page");
  let bytes = 0;
  const cachedUrls: string[] = []; // the urls ACTUALLY stored (a failed fetch is not cached — honest)
  for (let i = 0; i < pages.length; i++) {
    const url = pages[i]!;
    try {
      const data = await fetch(`/api/fetch-source?url=${encodeURIComponent(url)}`).then((r) => r.json());
      // only cache a real extraction/preview — never a fetch error (honest: it stays "requires connection")
      if (data && data.mode && data.mode !== "error") {
        bytes += await saveOfflineSource(url, data);
        cachedUrls.push(url);
      }
    } catch {
      /* skip — partial download is honest */
    }
    onProgress?.(i + 1, pages.length);
  }
  // store the exact cached urls → the inventory can account for bytes SHARED with another spine (and a delete
  // frees only the exclusive ones). Legacy rows lacked this; a re-download fills it.
  await saveSpineIndex({ goalId, title, sourceCount: pages.length, urls: cachedUrls, bytes, ts: Date.now() });
  return { goalId, sourceCount: pages.length, cached: cachedUrls.length, bytes };
}
