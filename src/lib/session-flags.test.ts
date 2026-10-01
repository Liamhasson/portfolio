import { describe, expect, test } from "vitest";
import { hasSeenLoader, LOADER_SEEN_KEY, markLoaderSeen } from "./session-flags";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("SecurityError");
  },
} as unknown as Storage;

describe("loader session flag", () => {
  test("false before, true after marking", () => {
    const s = memoryStorage();
    expect(hasSeenLoader(s)).toBe(false);
    markLoaderSeen(s);
    expect(hasSeenLoader(s)).toBe(true);
    expect(s.getItem(LOADER_SEEN_KEY)).toBe("1");
  });

  test("blocked storage: reports unseen and never throws", () => {
    expect(hasSeenLoader(throwingStorage)).toBe(false);
    expect(() => markLoaderSeen(throwingStorage)).not.toThrow();
  });

  test("defaults to window.sessionStorage", () => {
    window.sessionStorage.clear();
    expect(hasSeenLoader()).toBe(false);
    markLoaderSeen();
    expect(hasSeenLoader()).toBe(true);
  });
});
