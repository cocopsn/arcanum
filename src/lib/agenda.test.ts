import { describe, it, expect } from "vitest";
import { dueBucket, groupObligations, formatAge, BUCKET_ORDER } from "@/lib/agenda";
import type { ObligationRM } from "@/core/read-model";

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);
const HOUR = 3_600_000;
const DAY = 86_400_000;

const ob = (id: string, dueTs: number | null, over: Partial<ObligationRM> = {}): ObligationRM => ({
  id,
  course: "C",
  title: id,
  dueTs,
  status: "pending",
  source: "canvas",
  url: null,
  fetchedTs: 0,
  promotedModuleId: null,
  ...over,
});

describe("dueBucket", () => {
  it("buckets by distance from now", () => {
    expect(dueBucket(null, NOW)).toBe("none");
    expect(dueBucket(NOW - HOUR, NOW)).toBe("overdue");
    expect(dueBucket(NOW + HOUR, NOW)).toBe("today");
    expect(dueBucket(NOW + DAY + HOUR, NOW)).toBe("tomorrow");
    expect(dueBucket(NOW + 4 * DAY, NOW)).toBe("week");
    expect(dueBucket(NOW + 20 * DAY, NOW)).toBe("later");
  });
});

describe("groupObligations", () => {
  it("returns ordered, non-empty buckets each sorted by due date", () => {
    const groups = groupObligations(
      [
        ob("later", NOW + 20 * DAY),
        ob("overdue2", NOW - HOUR),
        ob("overdue1", NOW - 5 * DAY),
        ob("today", NOW + 2 * HOUR),
        ob("none", null),
      ],
      NOW,
    );
    expect(groups.map((g) => g.bucket)).toEqual(["overdue", "today", "later", "none"]);
    // overdue sorted soonest-due first (most negative delta first = earliest ts)
    expect(groups[0]!.items.map((o) => o.id)).toEqual(["overdue1", "overdue2"]);
    // ordering follows the canonical BUCKET_ORDER
    const idx = (b: string) => BUCKET_ORDER.indexOf(b as never);
    expect(groups.map((g) => idx(g.bucket))).toEqual([...groups.map((g) => idx(g.bucket))].sort((a, b) => a - b));
  });

  it("sorts null-due items last within a bucket, then by title", () => {
    const groups = groupObligations([ob("z", null), ob("a", null)], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((o) => o.id)).toEqual(["a", "z"]);
  });

  it("empty input → no groups", () => {
    expect(groupObligations([], NOW)).toEqual([]);
  });
});

describe("formatAge", () => {
  it("formats data age honestly", () => {
    expect(formatAge(null)).toBe("sin conectar");
    expect(formatAge(30_000)).toBe("hace un momento");
    expect(formatAge(5 * 60_000)).toBe("hace 5 min");
    expect(formatAge(3 * HOUR)).toBe("hace 3 h");
    expect(formatAge(2 * DAY)).toBe("hace 2 d");
  });
});
