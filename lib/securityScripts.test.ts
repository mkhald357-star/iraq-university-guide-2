import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import type { AddressInfo } from "node:net";

// اختبار سكربتي التثبيت الآلي (scripts/security/apply-*.mjs) ضد خادم HTTP محاكٍ محلي، لا ضد Cloudflare/GitHub الحقيقيين.
// يحرس عيوب وجدتها المراجعة المستقلة: --skip الصامت، خفض TLS 1.3، طمس قائمة السماح، نجاح بلا تحقق، وكتابة بلا --apply.

const ROOT = path.join(__dirname, "..");
const TOKEN = "TESTTOKEN_0123456789_abcdefghij";

type Req = { method: string; path: string; body: unknown };

function startServer(handler: (req: Req) => { status?: number; body?: unknown; raw?: string }) {
  const log: Req[] = [];
  const server = http.createServer((rq, rs) => {
    let b = "";
    rq.on("data", (d) => (b += d)).on("end", () => {
      let body: unknown = null;
      try {
        body = b ? JSON.parse(b) : null;
      } catch {
        body = b;
      }
      const req = { method: rq.method || "GET", path: rq.url || "", body };
      log.push(req);
      const out = handler(req);
      rs.statusCode = out.status ?? 200;
      rs.setHeader("content-type", "application/json");
      rs.end(out.raw !== undefined ? out.raw : JSON.stringify(out.body ?? null));
    });
  });
  return new Promise<{ url: string; log: Req[]; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        log,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function run(script: string, args: string[], env: Record<string, string>) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const p = spawn(process.execPath, [path.join(ROOT, "scripts", "security", script), ...args], {
      env: { ...process.env, ...env },
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
  });
}

const cfOk = (result: unknown) => ({ body: { success: true, errors: [], result } });
const writes = (log: Req[]) => log.filter((r) => r.method !== "GET");

interface CfState {
  settings: Record<string, string>;
  dnssec: string;
  records: Record<string, unknown>[];
  failPost?: boolean;
}
function cfHandler(st: CfState) {
  return (r: Req) => {
    const u = r.path.split("?")[0];
    if (u === "/zones") return cfOk([{ id: "z1", status: "active" }]);
    if (u === "/zones/z1/dns_records" && r.method === "GET") return cfOk(st.records);
    if (u === "/zones/z1/dns_records" && r.method === "POST") {
      if (st.failPost) return { body: { success: false, errors: [{ code: 1004, message: "boom" }], result: null } };
      return cfOk({});
    }
    const m = u.match(/^\/zones\/z1\/settings\/(.+)$/);
    if (m && r.method === "GET") return cfOk({ value: st.settings[m[1]] });
    if (m && r.method === "PATCH") return cfOk({});
    if (u === "/zones/z1/dnssec" && r.method === "GET") return cfOk({ status: st.dnssec });
    if (u === "/zones/z1/dnssec" && r.method === "PATCH") return cfOk({ status: "pending" });
    return { status: 404, body: { success: false, errors: [{ code: 7003, message: "no route" }] } };
  };
}
const baseSettings = (): Record<string, string> => ({
  ssl: "full",
  always_use_https: "off",
  min_tls_version: "1.0",
  automatic_https_rewrites: "off",
  rocket_loader: "on",
  email_obfuscation: "on",
});

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

async function cf(state: CfState, args: string[]) {
  const srv = await startServer(cfHandler(state));
  closers.push(srv.close);
  const r = await run("apply-cloudflare.mjs", args, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_API_BASE: srv.url });
  return { ...r, log: srv.log };
}

describe("apply-cloudflare.mjs", () => {
  it("المعاينة بلا --apply لا تكتب شيئاً", async () => {
    const r = await cf({ settings: baseSettings(), dnssec: "disabled", records: [] }, []);
    expect(writes(r.log)).toEqual([]);
    expect(r.out).toContain("معاينة فقط");
    expect(r.out).not.toContain(TOKEN);
  });

  it("--apply يكتب بنوده، وإعادة التشغيل على حالة مستوفاة لا تكتب", async () => {
    const r = await cf({ settings: baseSettings(), dnssec: "disabled", records: [] }, ["--apply"]);
    const w = writes(r.log);
    expect(w.filter((x) => x.path.endsWith("/dns_records"))).toHaveLength(4);
    expect(w.some((x) => x.path.endsWith("/dnssec"))).toBe(true);
    const done = await cf(
      {
        settings: {
          ssl: "strict",
          always_use_https: "on",
          min_tls_version: "1.2",
          automatic_https_rewrites: "on",
          rocket_loader: "off",
          email_obfuscation: "off",
        },
        dnssec: "active",
        records: [
          { type: "CAA", name: "iraqmajors.com", data: { flags: 0, tag: "issue", value: "letsencrypt.org" } },
          { type: "TXT", name: "iraqmajors.com", content: "v=spf1 -all" },
          { type: "TXT", name: "_dmarc.iraqmajors.com", content: "v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s" },
          { type: "TXT", name: "*._domainkey.iraqmajors.com", content: "v=DKIM1; p=" },
        ],
      },
      ["--apply"]
    );
    expect(writes(done.log)).toEqual([]);
    expect(done.code).toBe(0);
  });

  it("لا يُخفَّض إعداد أشدّ: TLS 1.3 يبقى، وstrict يبقى", async () => {
    const s = baseSettings();
    s.min_tls_version = "1.3";
    s.ssl = "strict";
    const r = await cf({ settings: s, dnssec: "active", records: [] }, ["--apply"]);
    const patched = writes(r.log).map((x) => x.path);
    expect(patched.some((p) => p.endsWith("/settings/min_tls_version"))).toBe(false);
    expect(patched.some((p) => p.endsWith("/settings/ssl"))).toBe(false);
  });

  it.each([["--skip=ssl,dnssec"], ["--skip", "ssl,dnssec"], ["--skip=SSL,DNSSEC"]].map((a) => [a]))(
    "الاستثناء يعمل بالصيغ كلها: %j",
    async (args) => {
      const r = await cf({ settings: baseSettings(), dnssec: "disabled", records: [] }, [
        "--apply",
        ...(args as string[]),
      ]);
      const p = writes(r.log).map((x) => x.path);
      expect(p.some((x) => x.endsWith("/settings/ssl"))).toBe(false);
      expect(p.some((x) => x.endsWith("/dnssec"))).toBe(false);
      expect(p.some((x) => x.endsWith("/settings/min_tls_version"))).toBe(true);
    }
  );

  it.each([[["--skip"]], [["--skip="]], [["--skip", "--apply"]]])(
    "--skip بلا قيمة = خطأ استعمال بلا أي طلب: %j",
    async (args) => {
      const r = await cf({ settings: baseSettings(), dnssec: "disabled", records: [] }, [
        "--apply",
        ...(args as string[]),
      ]);
      expect(r.code).toBe(2);
      expect(r.log).toHaveLength(0);
    }
  );

  it("معرّف المنطقة لا يُطبع في المخرجات", async () => {
    const r = await cf({ settings: baseSettings(), dnssec: "active", records: [] }, []);
    expect(r.out).not.toContain("z1,");
    expect(r.out).not.toMatch(/zone [0-9a-z]+/i);
  });

  it("اسم استثناء مجهول = خطأ استعمال، بلا أي طلب", async () => {
    const r = await cf({ settings: baseSettings(), dnssec: "disabled", records: [] }, ["--apply", "--skip=sll"]);
    expect(r.code).toBe(2);
    expect(r.log).toHaveLength(0);
  });

  it("DNSSEC بحالة pending لا يُعاد تفعيله", async () => {
    const r = await cf({ settings: baseSettings(), dnssec: "pending", records: [] }, ["--apply"]);
    expect(writes(r.log).some((x) => x.path.endsWith("/dnssec"))).toBe(false);
    expect(r.out).toContain("pending");
  });

  it("سجل بقيمة مختلفة لا يُعدَّل: تعارض بلا كتابة لذلك السجل، رمز الخروج 1", async () => {
    const r = await cf(
      {
        settings: baseSettings(),
        dnssec: "active",
        records: [{ type: "TXT", name: "iraqmajors.com", content: "v=spf1 include:foo.com ~all" }],
      },
      ["--apply"]
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("تعارض");
    const spf = writes(r.log).filter((x) => x.method === "POST" && JSON.stringify(x.body).includes("spf1"));
    expect(spf).toHaveLength(0);
  });

  it("CAA على نطاق فرعي لا يُحتسب موجوداً للجذر", async () => {
    const r = await cf(
      {
        settings: baseSettings(),
        dnssec: "active",
        records: [
          { type: "CAA", name: "sub.iraqmajors.com", data: { flags: 0, tag: "issue", value: "letsencrypt.org" } },
        ],
      },
      ["--apply"]
    );
    expect(writes(r.log).some((x) => x.method === "POST" && JSON.stringify(x.body).includes('"CAA"'))).toBe(true);
  });

  it("فشل إضافة سجل لا يقطع التنفيذ: يُبلَّغ ويكمل الإعدادات", async () => {
    const r = await cf({ settings: baseSettings(), dnssec: "active", records: [], failPost: true }, ["--apply"]);
    expect(r.out).toContain("فشل الإضافة");
    expect(r.out).not.toContain("at file:");
    expect(writes(r.log).some((x) => x.path.endsWith("/settings/min_tls_version"))).toBe(true);
    expect(r.code).toBe(1);
  });
});

interface GhState {
  alerts: boolean;
  fixes: boolean;
  allowed: string;
  sha: boolean;
  selected: { github_owned_allowed: boolean; verified_allowed: boolean; patterns_allowed: string[] };
  ignoreSha?: boolean;
  forbidRead?: boolean;
  selectedStatus?: number;
}
function ghHandler(st: GhState) {
  const R = "/repos/o/r";
  return (r: Req) => {
    const u = r.path.split("?")[0];
    if (u === R) return { body: { private: true } };
    if (st.forbidRead && r.method === "GET" && u !== R) return { status: 403, body: { message: "forbidden" } };
    if (u === `${R}/vulnerability-alerts`) {
      if (r.method === "GET") return { status: st.alerts ? 204 : 404, raw: "" };
      st.alerts = true;
      return { status: 204, raw: "" };
    }
    if (u === `${R}/automated-security-fixes`) {
      if (r.method === "GET") return { body: { enabled: st.fixes } };
      st.fixes = true;
      return { status: 204, raw: "" };
    }
    if (u === `${R}/actions/permissions` && r.method === "GET") {
      return { body: { enabled: true, allowed_actions: st.allowed, sha_pinning_required: st.sha } };
    }
    if (u === `${R}/actions/permissions` && r.method === "PUT") {
      const b = r.body as { allowed_actions: string; sha_pinning_required?: boolean };
      st.allowed = b.allowed_actions;
      if (!st.ignoreSha && b.sha_pinning_required) st.sha = true;
      return { status: 204, raw: "" };
    }
    if (u === `${R}/actions/permissions/selected-actions` && r.method === "GET") {
      if (st.selectedStatus) return { status: st.selectedStatus, body: { message: "err" } };
      return { body: st.selected };
    }
    if (u === `${R}/actions/permissions/selected-actions` && r.method === "PUT") {
      st.selected = r.body as GhState["selected"];
      return { status: 204, raw: "" };
    }
    return { status: 404, body: { message: "no route" } };
  };
}
async function gh(state: GhState, args: string[]) {
  const srv = await startServer(ghHandler(state));
  closers.push(srv.close);
  const r = await run("apply-github.mjs", args, {
    GITHUB_TOKEN: TOKEN,
    GITHUB_REPO: "o/r",
    GITHUB_API_BASE: srv.url,
  });
  return { ...r, log: srv.log };
}
const ghBase = (): GhState => ({
  alerts: false,
  fixes: false,
  allowed: "all",
  sha: false,
  selected: { github_owned_allowed: false, verified_allowed: false, patterns_allowed: [] },
});

describe("apply-github.mjs", () => {
  it("المعاينة لا تكتب شيئاً", async () => {
    const r = await gh(ghBase(), []);
    expect(writes(r.log)).toEqual([]);
    expect(r.out).toContain("معاينة فقط");
  });

  it("--apply يُفعّل ويتحقق بإعادة القراءة، ويحفظ قائمة السماح القائمة", async () => {
    const s = ghBase();
    s.selected = { github_owned_allowed: false, verified_allowed: true, patterns_allowed: ["dorny/paths-filter@*"] };
    const r = await gh(s, ["--apply"]);
    expect(r.code).toBe(0);
    expect(s.alerts && s.fixes && s.sha && s.allowed === "selected").toBe(true);
    expect(s.selected.github_owned_allowed).toBe(true);
    expect(s.selected.patterns_allowed).toEqual(["dorny/paths-filter@*"]);
    expect(s.selected.verified_allowed).toBe(true);
    expect(r.out).toContain("تُرك كما هو");
  });

  it("إن تجاهل الخادم تثبيت الـSHA لا يُعلَن «فُعِّل»، ويخرج بـ1", async () => {
    const s = ghBase();
    s.ignoreSha = true;
    const r = await gh(s, ["--apply"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("لم يتفعّل");
    expect(r.out).not.toMatch(/Actions: إجراءات محدّدة \+ تثبيت بالـSHA — فُعِّل/);
  });

  it("رفض القراءة (403) يُبلَّغ كتعذّر قراءة لا كـ«سيُفعَّل»", async () => {
    const s = ghBase();
    s.forbidRead = true;
    const r = await gh(s, []);
    expect(r.out).toContain("تعذّرت القراءة");
    expect(r.out).not.toContain("سيُفعَّل");
    expect(r.code).toBe(1);
  });

  it.each([[500], [403]])("فشل قراءة قائمة السماح (%i) لا يطمسها: لا كتابة فوقها، خروج 1", async (status) => {
    const s = ghBase();
    s.allowed = "selected";
    s.alerts = true;
    s.fixes = true;
    s.selected = { github_owned_allowed: true, verified_allowed: true, patterns_allowed: ["my-org/*"] };
    s.selectedStatus = status;
    const r = await gh(s, ["--apply"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("تعذّرت قراءة قائمة الإجراءات");
    expect(s.selected.patterns_allowed).toEqual(["my-org/*"]);
    expect(writes(r.log).filter((x) => x.path.includes("selected-actions"))).toHaveLength(0);
  });

  it("409 (ليس selected) يُعامَل كقائمة فارغة وتُفعَّل بلا فشل", async () => {
    const s = ghBase();
    s.selectedStatus = 409;
    const r = await gh(s, ["--apply"]);
    expect(r.code).toBe(0);
    expect(s.allowed).toBe("selected");
  });
});
