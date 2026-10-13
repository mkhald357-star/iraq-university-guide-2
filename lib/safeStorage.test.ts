import { describe, it, expect, beforeEach } from "vitest";
import { safeParse, readStored, clearAppData, isPlainObject, APP_STORAGE_KEYS } from "./safeStorage";

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: new MemStorage() };
});
const ls = () => (globalThis as unknown as { window: { localStorage: MemStorage } }).window.localStorage;

describe("التخزين المحلي الآمن", () => {
  it("يُسقط مفاتيح تلويث النموذج", () => {
    const v = safeParse('{"__proto__":{"polluted":true},"a":1,"constructor":{"x":1}}') as Record<string, unknown>;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(v, "__proto__")).toBe(false);
    expect(v.a).toBe(1);
  });

  it("يعيد القيمة الافتراضية لبيانات تالفة أو بشكل خاطئ", () => {
    ls().setItem("wishlistPlan", "{not json");
    expect(readStored("wishlistPlan", Array.isArray, [])).toEqual([]);
    ls().setItem("wishlistPlan", '{"a":1}');
    expect(readStored("wishlistPlan", Array.isArray, [])).toEqual([]);
    ls().setItem("wishlistPlan", "[1,2]");
    expect(readStored("wishlistPlan", Array.isArray, [])).toEqual([1, 2]);
  });

  it("زر المسح يمسح كل مفاتيح المنصة ولا يمسّ غيرها", () => {
    for (const k of APP_STORAGE_KEYS) ls().setItem(k, "1");
    ls().setItem("other-site-key", "keep");
    expect(clearAppData()).toBe(APP_STORAGE_KEYS.length);
    for (const k of APP_STORAGE_KEYS) expect(ls().getItem(k)).toBeNull();
    expect(ls().getItem("other-site-key")).toBe("keep");
  });

  it("كل مفتاح تكتبه الصفحات مدرج في قائمة المسح", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files = ["app/quiz/page.tsx", "app/wishlist/page.tsx", "app/components/ThemeToggle.tsx"];
    const written = new Set<string>();
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      for (const m of src.matchAll(/localStorage\.setItem\(\s*["']([^"']+)["']/g)) written.add(m[1]);
    }
    written.add("wishlistPlan"); // يُكتب عبر ثابت WISHLIST_STORAGE_KEY
    for (const k of written) expect(APP_STORAGE_KEYS as readonly string[]).toContain(k);
    expect(isPlainObject({})).toBe(true);
  });
});
