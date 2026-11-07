import { describe, it, expect, afterEach, vi } from "vitest";
import {
  HOME_ORDER_KEY,
  applyOrder,
  clearHomeOrder,
  isDefaultOrder,
  loadHomeOrder,
  moveId,
  parseStoredOrder,
  saveHomeOrder,
} from "@/lib/home-order";

const A = "a0000000-0000-4000-8000-000000000001";
const B = "a0000000-0000-4000-8000-000000000002";
const C = "a0000000-0000-4000-8000-000000000003";
const GONE = "a0000000-0000-4000-8000-00000000dead";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("home-order · applyOrder", () => {
  it("drops ids that no longer exist, keeps the stored order, appends new worlds in default order", () => {
    const out = applyOrder([A, B, C], [C, GONE, A]);
    expect(out.includes(GONE), "un goalId que ya no existe apareció en el orden").toBe(false);
    expect(out).toEqual([C, A, B]);
  });

  it("lists a repeated id once", () => {
    expect(applyOrder([A, B], [B, B, A, B])).toEqual([B, A]);
  });

  it("without a stored order returns the default order", () => {
    expect(applyOrder([A, B, C], null)).toEqual([A, B, C]);
  });
});

describe("home-order · parseStoredOrder", () => {
  it("a corrupt value is ignored instead of breaking home", () => {
    let parsed: string[] | null | undefined;
    try {
      parsed = parseStoredOrder("{no es json");
    } catch (e) {
      throw new Error(`un valor corrupto en ${HOME_ORDER_KEY} rompió el inicio: ${String(e)}`);
    }
    expect(parsed).toBeNull();
  });

  it("rejects the wrong shape, more than 64 ids and ids that are not UUIDs", () => {
    expect(parseStoredOrder(null)).toBeNull();
    expect(parseStoredOrder(JSON.stringify([A]))).toBeNull();
    expect(parseStoredOrder(JSON.stringify({ v: 2, order: [A] }))).toBeNull();
    expect(parseStoredOrder(JSON.stringify({ v: 1, order: "x" }))).toBeNull();
    expect(parseStoredOrder(JSON.stringify({ v: 1, order: [A, "no-uuid"] }))).toBeNull();
    const many = Array.from({ length: 65 }, (_, i) => `a0000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(parseStoredOrder(JSON.stringify({ v: 1, order: many }))).toBeNull();
  });

  it("accepts a valid { v: 1, order }", () => {
    expect(parseStoredOrder(JSON.stringify({ v: 1, order: [B, A] }))).toEqual([B, A]);
  });
});

describe("home-order · moveId and isDefaultOrder", () => {
  it("swaps with the neighbour and returns the same array at either end", () => {
    const order = [A, B, C];
    expect(moveId(order, B, -1)).toEqual([B, A, C]);
    expect(moveId(order, B, 1)).toEqual([A, C, B]);
    expect(moveId(order, A, -1)).toBe(order);
    expect(moveId(order, C, 1)).toBe(order);
    expect(moveId(order, GONE, 1)).toBe(order);
  });

  it("knows when the order is the default one", () => {
    expect(isDefaultOrder([A, B, C], [A, B, C])).toBe(true);
    expect(isDefaultOrder([B, A, C], [A, B, C])).toBe(false);
  });
});

describe("home-order · device storage", () => {
  it("saves, loads and clears under its own key", () => {
    saveHomeOrder([C, A]);
    expect(JSON.parse(localStorage.getItem(HOME_ORDER_KEY)!)).toEqual({ v: 1, order: [C, A] });
    expect(loadHomeOrder()).toEqual([C, A]);
    clearHomeOrder();
    expect(localStorage.getItem(HOME_ORDER_KEY)).toBeNull();
    expect(loadHomeOrder()).toBeNull();
  });

  it("a corrupt stored value loads as no order", () => {
    localStorage.setItem(HOME_ORDER_KEY, "{roto");
    expect(loadHomeOrder()).toBeNull();
  });

  it("without usable localStorage nothing throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(loadHomeOrder()).toBeNull();
    expect(() => saveHomeOrder([A])).not.toThrow();
  });
});
