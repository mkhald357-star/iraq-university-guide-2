/**
 * إدخال المعدل/الدرجات كنص لا كـ<input type="number">:
 *  - مدخل الأرقام في المتصفح يغيّر قيمته بعجلة التمرير وبأسهم لوحة المفاتيح وأزرار الزيادة،
 *    فيتبدّل المعدل دون أن يقصد الطالب (خصوصاً أثناء تمرير الصفحة بإصبع/فأرة فوق الحقل).
 *  - هنا لا تتغيّر القيمة إلا بما يكتبه الطالب، وتُقبل الأرقام العربية (٧٨) والفاصلة العشرية (٧٨،٥).
 */

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXT_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** يحوّل ما كتبه الطالب إلى نص رقمي نظيف: أرقام لاتينية، نقطة عشرية واحدة، حتى 3 خانات صحيحة و2 عشرية. */
export function sanitizeGradeInput(raw: string): string {
  let s = "";
  for (const ch of raw) {
    const a = ARABIC_INDIC.indexOf(ch);
    const b = EXT_ARABIC_INDIC.indexOf(ch);
    if (a >= 0) s += String(a);
    else if (b >= 0) s += String(b);
    else if (ch === "٫" || ch === "," || ch === "،" || ch === "." || ch === "/") s += ".";
    else if (ch >= "0" && ch <= "9") s += ch;
  }
  const dot = s.indexOf(".");
  if (dot < 0) return s.slice(0, 3);
  const intPart = s.slice(0, dot).slice(0, 3);
  const frac = s
    .slice(dot + 1)
    .replace(/\./g, "")
    .slice(0, 2);
  return `${intPart}.${frac}`;
}

/** رسالة صلاحية عربية إن كانت القيمة خارج [0, max]؛ فارغة إن كانت صالحة أو الحقل فارغاً. */
export function gradeRangeMessage(text: string, max: number): string {
  if (text === "" || text === ".") return "";
  const n = Number(text);
  if (!Number.isFinite(n)) return "اكتب رقماً صحيحاً";
  if (n < 0 || n > max) return `القيمة بين 0 و${max}`;
  return "";
}

/** يطبّق التنظيف على عنصر الإدخال نفسه ويضبط رسالة الصلاحية الأصلية للمتصفح. */
export function applyGradeInput(el: HTMLInputElement, max: number): string {
  const clean = sanitizeGradeInput(el.value);
  if (el.value !== clean) el.value = clean;
  el.setCustomValidity(gradeRangeMessage(clean, max));
  return clean;
}
