import { describe, it, expect } from "vitest";
import { computeSpineAccounting } from "@/lib/download-inventory";
import { saveOfflineSource, getOfflineSource, saveSpineIndex, deleteSpineDownloadSafe, listDownloadedSpines } from "@/lib/offline-store";

describe("download inventory — exact accounting, NO phantom dedup", () => {
  it("A and B that SHARE a source: total = unique(A) + unique(B) + shared ONCE (never the naïve A+B)", () => {
    // A owns uA1(100)+uA2(200), B owns uB1(300); both reference shared(500)
    const bytes = new Map<string, number>([
      ["uA1", 100],
      ["uA2", 200],
      ["shared", 500],
      ["uB1", 300],
    ]);
    const { accounts, distinctSourceBytes } = computeSpineAccounting(
      [
        { goalId: "A", title: "Spine A", urls: ["uA1", "uA2", "shared"] },
        { goalId: "B", title: "Spine B", urls: ["uB1", "shared"] },
      ],
      bytes,
    );
    const A = accounts.find((a) => a.goalId === "A")!;
    const B = accounts.find((a) => a.goalId === "B")!;

    expect(A.uniqueBytes).toBe(300); // 100 + 200 — only A
    expect(A.sharedBytes).toBe(500); // shared with B
    expect(A.sharedWith.map((s) => s.goalId)).toEqual(["B"]);
    expect(A.footprintBytes).toBe(800);

    expect(B.uniqueBytes).toBe(300);
    expect(B.sharedBytes).toBe(500);
    expect(B.sharedWith.map((s) => s.goalId)).toEqual(["A"]);

    // THE honest total: each source once. 300(A) + 300(B) + 500(shared) = 1100.
    expect(distinctSourceBytes).toBe(1100);
    // it must NOT be the inflated footprint sum (800 + 800 = 1600) — that would double-count `shared`.
    expect(distinctSourceBytes).not.toBe(A.footprintBytes + B.footprintBytes);
    expect(distinctSourceBytes).toBe(A.uniqueBytes + B.uniqueBytes + 500);
  });

  it("no sharing → footprint == unique for each, and total is the plain sum", () => {
    const bytes = new Map<string, number>([["x", 100], ["y", 250]]);
    const { accounts, distinctSourceBytes } = computeSpineAccounting(
      [
        { goalId: "A", title: "A", urls: ["x"] },
        { goalId: "B", title: "B", urls: ["y"] },
      ],
      bytes,
    );
    expect(accounts.every((a) => a.sharedBytes === 0 && a.sharedWith.length === 0)).toBe(true);
    expect(distinctSourceBytes).toBe(350);
  });

  it("deleting a spine frees ONLY its exclusive bytes and PRESERVES the shared ones a sibling still needs", async () => {
    const bA1 = await saveOfflineSource("t://a1", "a".repeat(120));
    const bA2 = await saveOfflineSource("t://a2", "b".repeat(80));
    const bShared = await saveOfflineSource("t://shared", "c".repeat(300));
    const bB1 = await saveOfflineSource("t://b1", "d".repeat(90));
    await saveSpineIndex({ goalId: "gA", title: "A", sourceCount: 3, urls: ["t://a1", "t://a2", "t://shared"], bytes: bA1 + bA2 + bShared, ts: 1 });
    await saveSpineIndex({ goalId: "gB", title: "B", sourceCount: 2, urls: ["t://b1", "t://shared"], bytes: bB1 + bShared, ts: 1 });

    const res = await deleteSpineDownloadSafe("gA");
    expect(res.freedBytes).toBe(bA1 + bA2); // A's exclusive sources freed
    expect(res.keptSharedBytes).toBe(bShared); // the shared one stays — B still needs it

    expect(await getOfflineSource("t://a1")).toBeNull(); // exclusive → gone
    expect(await getOfflineSource("t://a2")).toBeNull();
    expect(await getOfflineSource("t://shared")).not.toBeNull(); // shared → KEPT (B unbroken)
    expect(await getOfflineSource("t://b1")).not.toBeNull();

    const spines = await listDownloadedSpines();
    expect(spines.find((s) => s.goalId === "gA")).toBeUndefined(); // A's index removed
    expect(spines.find((s) => s.goalId === "gB")).toBeDefined(); // B intact

    // now deleting B frees BOTH its own AND the (now-exclusive) shared source
    const res2 = await deleteSpineDownloadSafe("gB");
    expect(res2.freedBytes).toBe(bB1 + bShared);
    expect(res2.keptSharedBytes).toBe(0);
    expect(await getOfflineSource("t://shared")).toBeNull(); // no one needs it now → freed
  });
});
