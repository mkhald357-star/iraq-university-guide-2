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
 * **أقل بيانات ممكنة**: الإجابات، والفرع، والمعدل مقرَّباً، ودرجات المواد
 * مقرَّبة لأقرب 5، ونيّة الطالب، وتقييمه. **لا اسم ولا محافظة ولا وسيلة
 * تواصل**. درجات المواد الدقيقة شبه-معرِّف داخل المدرسة الواحدة (المدقّق)،
 * فالتقريب يجري هنا في المكتبة لا في الواجهة وحدها.
 *
 * الإصدار 2 (بعد مراجعة المدقّق قبل أول رمز):
 * - النيّة تُسأل **قبل** الاختبار: سؤالها بعد رؤية المجالات يثبّت الإجابة على
 *   ما عُرض فيصير المقياس دائرياً. ومعها مصدرها ودرجة اليقين، لأن "أدرس الطب
 *   لأن معدلي يسمح" ليس دليلاً على الميول.
 * - بصمة البنك ونطاق الصدق (VRS): رمز من بنك أسئلة آخر، أو إجابات مشكوك في
 *   جدّيتها، يُعزَل في التحليل لا يُخلَط.
 */

import { safeParse, isPlainObject } from "./safeStorage";

export const PILOT_CODE_VERSION = 2;

/** لماذا اختار الطالب هذا التخصص -- يفصل الميول عن القيود. */
export type IntentSource = "interest" | "grade" | "family" | "admitted" | "other";

/** يُقرِّب درجة مادة لأقرب 5 -- يكفي للتحليل ولا يعرّف طالباً في صفّه. */
export function roundSubjectGrade(g: number): number {
  return Math.round(g / 5) * 5;
}

/** بصمة بنك الأسئلة (المعرّفات مرتّبة) -- تكشف رموزاً من إصدار بنك مختلف. */
export function bankFingerprint(questionIds: string[]): string {
  return `${questionIds.length}-${checksum([...questionIds].sort().join("|"))}`;
}
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
  /** التخصص الذي يدرسه الطالب أو ينوي دراسته فعلاً (معرّف من data/majors.json)، أو null. سُئل قبل الاختبار. */
  intendedMajorId: string | null;
  /** مصدر النيّة، أو null إن لم يقرّر. */
  intentSource: IntentSource | null;
  /** يقينه من هذه النيّة 1..5، أو null. */
  intentCertainty: number | null;
  /** "كم تناسبك هذه التوصيات؟" 1..5، أو null. سُئل بعد رؤية النتيجة. */
  fitRating: number | null;
  /** bankFingerprint لبنك الأسئلة الذي أجاب عنه. */
  bank: string;
  /** نطاق مؤشر صدق الإجابات: low | medium | high. */
  vrsBand: string | null;
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
  const safe = {
    ...rec,
    grade: Math.round(rec.grade),
    subjectGrades: Object.fromEntries(Object.entries(rec.subjectGrades).map(([k, g]) => [k, roundSubjectGrade(g)])),
  };
  const body = toBase64Url(JSON.stringify({ ...safe, v: PILOT_CODE_VERSION }));
  return `${PREFIX}${body}.${checksum(body)}`;
}

export type PilotDecodeResult = { ok: true; record: PilotRecord } | { ok: false; reason: string };

/** أطول رمز مقبول: الرمز الحقيقي دون 2,500 حرف (اختبار)؛ ما فوق ذلك ليس من المنصة. */
const MAX_CODE_LENGTH = 8000;
const ID = /^[A-Za-z0-9_-]{1,60}$/;
const INTENT_SOURCES: readonly IntentSource[] = ["interest", "grade", "family", "admitted", "other"];

const num = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const nullOr = <T>(v: unknown, ok: (x: unknown) => x is T): v is T | null => v === null || ok(v);
const isRating = (v: unknown): v is number => num(v, 1, 5) && Number.isInteger(v);
const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v);

function numberMap(v: unknown, maxKeys: number, min: number, max: number): Record<string, number> | null {
  if (!isPlainObject(v)) return null;
  const entries = Object.entries(v);
  if (entries.length > maxKeys) return null;
  for (const [k, x] of entries) if (!ID.test(k) || !num(x, min, max)) return null;
  return Object.fromEntries(entries) as Record<string, number>;
}

/**
 * الرمز يصل من أشخاص خارج المنصة ويُحلَّل على جهاز المنظّم (scripts/eval)، ومجموع التحقق
 * ليس حماية (يحسبه أي أحد). لذا يُعامَل كمدخل عدائي: تحليل يُسقط مفاتيح __proto__/constructor،
 * وتحقق صارم من كل حقل ونوعه ومداه، ولا يُعاد إلا الحقول المعروفة (SECURITY-PLAN.md س7).
 */
function validateRecord(raw: unknown): PilotRecord | string {
  if (!isPlainObject(raw)) return "بنية غير صالحة";
  if (raw.v !== PILOT_CODE_VERSION) return `إصدار رمز غير مدعوم: ${String(raw.v).slice(0, 10)}`;
  if (typeof raw.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) return "حقل day غير صالح";
  if (typeof raw.branch !== "string" || raw.branch.length > 20) return "حقل branch غير صالح";
  if (!num(raw.grade, 0, 100)) return "حقل grade غير صالح";
  const subjectGrades = numberMap(raw.subjectGrades, 30, 0, 100);
  if (!subjectGrades) return "حقل subjectGrades غير صالح";
  const answers = numberMap(raw.answers, 400, -10, 10);
  if (!answers) return "حقل answers غير صالح";
  if (!Array.isArray(raw.shownLeads) || raw.shownLeads.length > 10 || !raw.shownLeads.every(isId))
    return "حقل shownLeads غير صالح";
  if (!nullOr(raw.intendedMajorId, isId)) return "حقل intendedMajorId غير صالح";
  const isSource = (x: unknown): x is IntentSource => INTENT_SOURCES.includes(x as IntentSource);
  if (!nullOr(raw.intentSource, isSource)) return "حقل intentSource غير صالح";
  if (!nullOr(raw.intentCertainty, isRating)) return "حقل intentCertainty غير صالح";
  if (!nullOr(raw.fitRating, isRating)) return "حقل fitRating غير صالح";
  if (typeof raw.bank !== "string" || !/^\d{1,4}-[0-9a-z]{1,13}$/.test(raw.bank)) return "حقل bank غير صالح";
  const isBand = (x: unknown): x is string => x === "low" || x === "medium" || x === "high";
  if (!nullOr(raw.vrsBand, isBand)) return "حقل vrsBand غير صالح";
  return {
    v: PILOT_CODE_VERSION,
    day: raw.day,
    branch: raw.branch,
    grade: raw.grade,
    subjectGrades,
    answers,
    shownLeads: [...raw.shownLeads],
    intendedMajorId: raw.intendedMajorId,
    intentSource: raw.intentSource,
    intentCertainty: raw.intentCertainty,
    fitRating: raw.fitRating,
    bank: raw.bank,
    vrsBand: raw.vrsBand,
  };
}

export function decodePilotRecord(code: string): PilotDecodeResult {
  if (typeof code !== "string" || code.length > MAX_CODE_LENGTH) return { ok: false, reason: "رمز أطول من المسموح" };
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) return { ok: false, reason: "ليس رمز تجربة" };
  const rest = trimmed.slice(PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot < 0) return { ok: false, reason: "رمز ناقص" };
  const body = rest.slice(0, dot);
  if (checksum(body) !== rest.slice(dot + 1)) return { ok: false, reason: "رمز تالف أو منقوص عند النسخ" };
  try {
    const rec = validateRecord(safeParse(fromBase64Url(body)));
    return typeof rec === "string" ? { ok: false, reason: rec } : { ok: true, record: rec };
  } catch {
    return { ok: false, reason: "رمز لا يُقرأ" };
  }
}
