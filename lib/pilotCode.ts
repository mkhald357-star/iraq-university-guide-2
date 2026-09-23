/**
 * رمز التجربة الميدانية (الإصدار 2، المسار هـ): المخرج الوحيد من دائرة
 * المحاكاة. الحقيقة في أداة المدقّق مشتقّة من بروفايلات الأقسام نفسها، فلا
 * تستطيع أي محاكاة أن تحكم على صحّتها -- وحده طالب حقيقي يقول ماذا يدرس
 * وهل تناسبه التوصية.
 *
 * المنصة بلا خادم ولا قاعدة بيانات، فالقناة رمز نصي ينسخه الطالب ويرسله
 * **طوعاً** لمنظّم التجربة. لا يُرسل شيء تلقائياً، ولا يظهر هذا إلا برابط
 * التجربة (/quiz?pilot=1).
 *
 * **أقل بيانات ممكنة**: الإجابات، والفرع، والمعدل مقرَّباً، ودرجات المواد إن
 * أُدخلت، وسؤالان. **لا اسم ولا محافظة ولا وسيلة تواصل** -- لا شيء يعرّف
 * الطالب.
 */

export const PILOT_CODE_VERSION = 1;
const PREFIX = "IQM1.";

export interface PilotRecord {
  v: number;
  /** وقت الإكمال (اليوم فقط، بلا ساعة) -- لتمييز الدفعات لا لتعريف الطالب. */
  day: string;
  branch: string;
  /** المعدل مقرَّباً لأقرب عدد صحيح. */
  grade: number;
  subjectGrades: Record<string, number>;
  /** كل الإجابات المُسجَّلة: الأساسية وأي عبارات من جولة فكّ الحيرة. */
  answers: Record<string, number>;
  /** ما عرضته المنصة: قادة المجالات الثلاثة بالترتيب. */
  shownLeads: string[];
  /** التخصص الذي يدرسه الطالب أو ينوي دراسته فعلاً (معرّف من data/majors.json)، أو null. */
  intendedMajorId: string | null;
  /** "كم تناسبك هذه التوصيات؟" 1..5، أو null. */
  fitRating: number | null;
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** مجموع تحقق بسيط يكشف رمزاً ناقصاً أو محرَّفاً عند النسخ (لا حماية أمنية). */
function checksum(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function encodePilotRecord(rec: Omit<PilotRecord, "v">): string {
  const body = toBase64Url(JSON.stringify({ ...rec, v: PILOT_CODE_VERSION }));
  return `${PREFIX}${body}.${checksum(body)}`;
}

export type PilotDecodeResult = { ok: true; record: PilotRecord } | { ok: false; reason: string };

export function decodePilotRecord(code: string): PilotDecodeResult {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) return { ok: false, reason: "ليس رمز تجربة" };
  const rest = trimmed.slice(PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot < 0) return { ok: false, reason: "رمز ناقص" };
  const body = rest.slice(0, dot);
  if (checksum(body) !== rest.slice(dot + 1)) return { ok: false, reason: "رمز تالف أو منقوص عند النسخ" };
  try {
    const rec = JSON.parse(fromBase64Url(body)) as PilotRecord;
    if (rec.v !== PILOT_CODE_VERSION) return { ok: false, reason: `إصدار رمز غير مدعوم: ${rec.v}` };
    return { ok: true, record: rec };
  } catch {
    return { ok: false, reason: "رمز لا يُقرأ" };
  }
}
