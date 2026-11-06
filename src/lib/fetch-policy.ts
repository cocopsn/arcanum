// FETCH POLICY (Engineering Forge, design §12). PURE. Which URLs the server-side viewer and the batch download may
// ever request. Shared by every world: SourceViewer reads its two outgoing-link labels from here, SOURCE_ALLOWLIST
// (lib/spines.ts) and offline-download filter with isFetchableSourceUrl, and /api/fetch-source applies it on the
// entry URL and on every redirect hop (CA-51).

/** Hosts that are NEVER requested by the server: accounts (learn, certification, Skilljar), build.palantir.com
 *  (no robots.txt; linked out only) and every video host (players are embedded client-side, never scraped). */
export const NEVER_FETCH_HOSTS: ReadonlySet<string> = new Set([
  "learn.palantir.com",
  "certification.palantir.com",
  "accounts.skilljar.com",
  "build.palantir.com",
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
  "vimeo.com",
  "player.vimeo.com",
]);

/** Outgoing-link labels of SourceViewer for hosts that are never fetched (texts of §5.5). */
export const SOURCE_LINK_LABELS = {
  build: "Se abre en build.palantir.com",
  playlist: "Lista de reproducción · se abre en YouTube",
  cuenta: "Requiere cuenta · se abre en el sitio de Palantir",
} as const;

/** Origins whose images may be painted (SafeImage, figures, Atlas). */
export const IMAGE_HOSTS: ReadonlySet<string> = new Set(["www.palantir.com", "build.palantir.com"]);

const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const INTERNAL_SUFFIX_RE = /\.(?:local|internal|lan|localhost)$/;

/** A host that must never be reached from the server even if a curated list carried it (review NIT 11):
 *  IPv4 or IPv6 literals, localhost, single-label hosts and the .local / .internal / .lan suffixes. */
export function isInternalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h.startsWith("[") || h.includes(":")) return true; // IPv6 literal
  if (IPV4_RE.test(h)) return true;
  if (h === "localhost" || INTERNAL_SUFFIX_RE.test(h)) return true;
  if (!h.includes(".")) return true; // single label
  return false;
}

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** May the server ever request this URL? https only, not a never-fetch host, not an internal host. */
export function isFetchableSourceUrl(url: string): boolean {
  const u = parse(url);
  if (!u || u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (NEVER_FETCH_HOSTS.has(host)) return false;
  if (isInternalHost(host)) return false;
  return true;
}

const DOCS_HOSTS = new Set(["www.palantir.com", "palantir.com"]);

/** A page of palantir.com/docs (the Atlas policy, §12.3 step 4). */
export function isDocsUrl(url: string): boolean {
  const u = parse(url);
  return !!u && u.protocol === "https:" && DOCS_HOSTS.has(u.hostname.toLowerCase()) && u.pathname.startsWith("/docs/");
}

/** A redirect hop allowed under the docs policy: https, palantir.com, still under /docs/. */
export function isDocsHop(url: string): boolean {
  return isDocsUrl(url);
}

/** Images: https and one of IMAGE_HOSTS (anything else is painted as alt text plus a link). */
export function isAllowedImageUrl(url: string): boolean {
  const u = parse(url);
  return !!u && u.protocol === "https:" && IMAGE_HOSTS.has(u.hostname.toLowerCase());
}

/** The label for an outgoing link of a never-fetched URL, or null when the URL is fetchable. */
export function outgoingLinkLabel(url: string): string | null {
  if (isFetchableSourceUrl(url)) return null;
  const u = parse(url);
  const host = u?.hostname.toLowerCase() ?? "";
  if (host === "build.palantir.com") return SOURCE_LINK_LABELS.build;
  if (host === "learn.palantir.com" || host === "certification.palantir.com" || host === "accounts.skilljar.com") return SOURCE_LINK_LABELS.cuenta;
  if ((host === "www.youtube.com" || host === "youtube.com") && u?.pathname === "/playlist") return SOURCE_LINK_LABELS.playlist;
  return null;
}
