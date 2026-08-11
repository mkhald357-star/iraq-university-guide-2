// تعريف عام لكل فئة مهارات كمفهوم -- يُعرض مرة واحدة أعلى صفحة /skills، لا
// مكرَّراً لكل تخصص. بيانات خالصة بلا JSX (نفس نمط data/services.ts) -- أيقونة
// كل فئة تُربَط في app/skills/page.tsx نفسه.

export type SkillCategoryId = "soft" | "practical" | "digital";

export interface SkillCategoryMeta {
  id: SkillCategoryId;
  label: string;
  glossary: string;
}

export const SKILL_CATEGORIES: SkillCategoryMeta[] = [
  {
    id: "soft",
    label: "مهارات ناعمة",
    glossary:
      "قدرات شخصية وتفاعلية — كيف تتواصل، تدير وقتك، تعمل ضمن فريق، وتتحمّل ضغط العمل. لا تخصّ مادة دراسية بعينها، لكنها غالباً ما تحدّد نجاحك المهني أكثر من الشهادة نفسها.",
  },
  {
    id: "practical",
    label: "مهارات عملية",
    glossary:
      "الأدوات والممارسات المهنية الفعلية الخاصة بجوهر تخصصك تحديداً — ما يفعله محترف هذا المجال يومياً في عمله، لا معرفة نظرية عامة.",
  },
  {
    id: "digital",
    label: "مهارات رقمية وتقنية عامة",
    glossary:
      "أدوات وتقنيات حديثة تُستخدم عبر مجالات كثيرة اليوم، لكن بتطبيق مُكيَّف لطبيعة تخصصك — من التحليل الرقمي إلى أدوات الذكاء الاصطناعي.",
  },
];
