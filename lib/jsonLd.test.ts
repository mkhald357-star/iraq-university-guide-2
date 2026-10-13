import { describe, it, expect } from "vitest";
import { serializeJsonLd } from "./jsonLd";

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

// SECURITY-PLAN.md س1-3: لا قيمة في JSON-LD تستطيع إغلاق <script> أو فتح وسم HTML.
describe("serializeJsonLd", () => {
  const evil = { name: "</script><script>alert(1)</script>", note: `<!-- & ${LS}${PS} -->` };
  const out = serializeJsonLd(evil);

  it("لا يحوي < أو > أو & حرفياً، ولا فاصلي السطر", () => {
    for (const ch of ["<", ">", "&", LS, PS]) expect(out.includes(ch)).toBe(false);
  });

  it("يبقى JSON صالحاً يعيد القيم الأصلية نفسها", () => {
    expect(JSON.parse(out)).toEqual(evil);
  });
});
