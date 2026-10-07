"use strict";
/** كشف أسماء الأقسام الفاسدة. مشترك بين التدقيق والاختبار. */

const AR = "ء-ي";

const RULES = [
  { id: "NO_ARABIC", why: "لا يحتوي حرفاً عربياً", test: (n) => !new RegExp(`[${AR}]`).test(n) },

  { id: "TOO_SHORT", why: "أقل من ٣ أحرف عربية", test: (n) => (n.match(new RegExp(`[${AR}]`, "g")) || []).length < 3 },

  { id: "GRADE_BLEED", why: "تسرّب نصّ المعدّل إلى الاسم", test: (n) => /معدل|ف\s*أ\s*ك\s*ث\s*ر|فاكثر|%/.test(n) },

  { id: "FEE_BLEED", why: "تسرّب رقم الأجور إلى الاسم", test: (n) => /\d{1,3},\d{3},\d{3}|\d{6,}/.test(n) },

  { id: "ORPHAN_PUNCT", why: "رموز يتيمة فقط", test: (n) => /^[\s)(%\-–—.:،]+$/.test(n) },

  { id: "UNBALANCED", why: "أقواس غير متوازنة", test: (n) => n.split("(").length !== n.split(")").length },

  { id: "SUSPENDED", why: "حالة إدارية لا اسم قسم", test: (n) => /تعليق\s*قبول/.test(n) },
];

function checkName(name) {
  const n = String(name ?? "").trim();
  return RULES.filter((r) => r.test(n)).map((r) => ({ id: r.id, why: r.why }));
}

/**
 * يستخرج المعدّل المشترط من نصّ gradeNote.
 * يعيد null إن لم يجد -- لا يخمّن أبداً.
 */
function parseStatedMinimum(raw) {
  if (!raw) return null;
  const s = String(raw)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/\s+/g, " ");

  const m = s.match(/معدل\s*(?:من)?\s*\(?\s*(\d{2,3}(?:[.,]\d+)?)\s*\)?\s*%?/);
  if (!m) return null;

  const value = parseFloat(String(m[1]).replace(",", "."));
  if (!Number.isFinite(value) || value < 40 || value > 100) return null;

  return { value, raw: String(raw).trim() };
}

module.exports = { checkName, RULES, parseStatedMinimum };
