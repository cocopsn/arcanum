import { NextResponse, type NextRequest } from "next/server";
import { isAllowedSource, isAllowedSourceHost } from "@/lib/spines";
import { extractReadable } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bring a REAL source page INTO Arcanum honestly. Many sites block iframing (X-Frame-Options /
// CSP frame-ancestors) — we NEVER force an iframe that renders blank. Instead the server fetches the
// page and extracts readable content to render themed inside the app. Modes returned:
//   extracted → good text pulled → render inside
//   thin      → little text (JS-rendered SPA shell) → the client shows a preview + "abrir fuente"
//   error     → couldn't fetch → the client shows "abrir fuente"
// `framable` says whether the ORIGIN even permits an iframe (honest — the client only iframes when true).
// HARD guard: only the curated, verified spine URLs may be fetched (allowlist) → no SSRF from a client URL.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  if (!/^https:\/\//i.test(url) || !isAllowedSource(url)) {
    return NextResponse.json({ mode: "error", reason: "url-not-allowed", sourceUrl: url }, { status: 400 });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    // MANUAL redirects, each hop re-validated against the trusted host set → a redirect can't escape
    // the closed allowlist to an arbitrary/internal target (defense-in-depth SSRF, no attacker path).
    let current = url;
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      if (!isAllowedSourceHost(current)) {
        clearTimeout(timer);
        return NextResponse.json({ mode: "error", reason: "redirect-blocked", sourceUrl: url }, { status: 400 });
      }
      res = await fetch(current, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" }, signal: ctrl.signal, redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        current = new URL(loc, current).toString();
        continue;
      }
      break;
    }
    clearTimeout(timer);
    if (!res) return NextResponse.json({ mode: "error", reason: "too-many-redirects", sourceUrl: url });
    if (!res.ok) return NextResponse.json({ mode: "error", reason: `http-${res.status}`, sourceUrl: url });
    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.includes("html")) return NextResponse.json({ mode: "error", reason: "not-html", sourceUrl: url });
    const xfo = (res.headers.get("x-frame-options") ?? "").toLowerCase();
    const csp = (res.headers.get("content-security-policy") ?? "").toLowerCase();
    const framable = !xfo.includes("deny") && !xfo.includes("sameorigin") && !csp.includes("frame-ancestors");
    const html = await res.text();
    const ex = extractReadable(html, url);
    const mode = ex.wordCount >= 120 ? "extracted" : "thin";
    return NextResponse.json({ mode, framable, sourceUrl: url, title: ex.title, blocks: ex.blocks, wordCount: ex.wordCount });
  } catch (e) {
    clearTimeout(timer);
    const reason = e instanceof Error && e.name === "AbortError" ? "timeout" : "fetch-failed";
    return NextResponse.json({ mode: "error", reason, sourceUrl: url });
  }
}
