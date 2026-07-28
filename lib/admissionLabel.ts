/**
 * "قبول مباشر" يُشتَقّ حصراً من isDirectAdmission (الحقل الحقيقي المحسوب في
 * scripts/build-universities-data.js من طول مصفوفة cutoffs الفعلية) -- لا من
 * فراغ القيمة. فراغ القيمة بدون isDirectAdmission يعني بيانات مفقودة فعلياً
 * (فجوة استخراج)، لا قبولاً مباشراً، وهذان معنيان متناقضان تماماً لا يجوز
 * دمجهما (انظر data/admission_rules.md §17). دالة مستقلة (لا داخل مكوّن React)
 * لتبقى قابلة للاختبار المباشر بلا حاجة لبنية اختبار مكوّنات جديدة.
 */
export function formatGrade(value: number | null | undefined, sessionAvailable: boolean, isDirectAdmission: boolean) {
  if (!sessionAvailable) return { text: "—", isDirect: false };
  if (isDirectAdmission) return { text: "قبول مباشر", isDirect: true };
  if (value == null) return { text: "غير متوفر", isDirect: false };
  return { text: `${value}%`, isDirect: false };
}
