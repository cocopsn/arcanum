import { describe, it, expect } from "vitest";
import {
  NEVER_FETCH_HOSTS,
  isAllowedImageUrl,
  isDocsHop,
  isDocsUrl,
  isFetchableSourceUrl,
  isInternalHost,
  outgoingLinkLabel,
} from "@/lib/fetch-policy";
import { SPINES } from "@/lib/spines";

const curated = () => [...new Set(SPINES.flatMap((s) => s.cells.flatMap((c) => [...(c.sourceUrls ?? []), ...(c.videoUrls ?? [])])))];

describe("fetch policy (§12, CA-51, review NIT 11)", () => {
  it("never-fetch hosts are refused: accounts, build and every video host", () => {
    for (const h of NEVER_FETCH_HOSTS) expect(isFetchableSourceUrl(`https://${h}/x`), h).toBe(false);
    expect(isFetchableSourceUrl("https://www.palantir.com/docs/foundry/ontology/overview")).toBe(true);
    expect(isFetchableSourceUrl("http://www.palantir.com/docs/foundry/ontology/overview")).toBe(false);
  });

  it("IP literals, localhost, single-label hosts and .local/.internal/.lan are refused", () => {
    for (const u of ["https://127.0.0.1/x", "https://169.254.169.254/latest", "https://[::1]/x", "https://localhost/x", "https://intranet/x", "https://nas.local/x", "https://db.internal/x", "https://router.lan/x"]) {
      expect(isFetchableSourceUrl(u), `el servidor pediría una IP o un host interno: ${u}`).toBe(false);
    }
    expect(isInternalHost("www.palantir.com")).toBe(false);
  });

  it("no curated URL of SPINES points to an IP or an internal host", () => {
    const bad = curated().filter((u) => {
      try {
        return isInternalHost(new URL(u).hostname);
      } catch {
        return true;
      }
    });
    expect(bad, "una URL curada apunta a una IP o a un host interno").toEqual([]);
  });

  it("docs policy: palantir.com under /docs/ only; images only from palantir.com and build.palantir.com", () => {
    expect(isDocsUrl("https://www.palantir.com/docs/foundry/x")).toBe(true);
    expect(isDocsUrl("https://www.palantir.com/careers/")).toBe(false);
    expect(isDocsHop("https://palantir.com/docs/x")).toBe(true);
    expect(isDocsHop("https://evil.com/docs/x")).toBe(false);
    expect(isAllowedImageUrl("https://www.palantir.com/docs/resources/x.png")).toBe(true);
    expect(isAllowedImageUrl("https://build.palantir.com/x.png")).toBe(true);
    expect(isAllowedImageUrl("https://cdn.example.com/x.png")).toBe(false);
  });

  it("outgoing labels of §5.5 for never-fetched URLs", () => {
    expect(outgoingLinkLabel("https://learn.palantir.com/")).toBe("Requiere cuenta · se abre en el sitio de Palantir");
    expect(outgoingLinkLabel("https://build.palantir.com/platform/x")).toBe("Se abre en build.palantir.com");
    expect(outgoingLinkLabel("https://www.youtube.com/playlist?list=PL1")).toBe("Lista de reproducción · se abre en YouTube");
    expect(outgoingLinkLabel("https://www.palantir.com/docs/foundry/x")).toBeNull();
  });
});
