import { describe, it, expect } from "vitest";
import { civilDay, dayOrdinal, civilDayOrdinal, msToDays } from "@/core/time";

const TZ = "America/Monterrey"; // UTC-6, no DST

describe("civilDay", () => {
  it("applies the TZ offset (not UTC)", () => {
    // 2026-06-28T04:00:00Z → Monterrey 2026-06-27 22:00
    expect(civilDay(Date.UTC(2026, 5, 28, 4, 0, 0), TZ)).toBe("2026-06-27");
  });

  it("handles the civil-day boundary at UTC-6", () => {
    expect(civilDay(Date.UTC(2026, 5, 28, 5, 59, 0), TZ)).toBe("2026-06-27");
    expect(civilDay(Date.UTC(2026, 5, 28, 6, 0, 0), TZ)).toBe("2026-06-28");
  });
});

describe("dayOrdinal", () => {
  it("consecutive civil days differ by 1", () => {
    expect(dayOrdinal("2026-06-28") - dayOrdinal("2026-06-27")).toBe(1);
    expect(dayOrdinal("2026-06-30") - dayOrdinal("2026-06-27")).toBe(3);
  });

  it("civilDayOrdinal composes civilDay + dayOrdinal", () => {
    expect(civilDayOrdinal(Date.UTC(2026, 5, 28, 6, 0, 0), TZ)).toBe(
      dayOrdinal("2026-06-28"),
    );
  });
});

describe("msToDays", () => {
  it("converts ms to fractional days", () => {
    expect(msToDays(86_400_000)).toBe(1);
    expect(msToDays(43_200_000)).toBe(0.5);
  });
});
