// تعريف عام لكل زاوية مشاريع تخرّج كمفهوم -- يُعرض مرة واحدة أعلى صفحة
// /projects، لا مكرَّراً لكل تخصص. بيانات خالصة بلا JSX، نفس نمط
// data/skillCategoryGlossary.ts -- أيقونة كل زاوية تُربَط في app/projects/page.tsx.

export type ProjectAngleId = "technical" | "ai" | "research" | "impact";

export interface ProjectAngleMeta {
  id: ProjectAngleId;
  label: string;
  glossary: string;
}

export const PROJECT_ANGLES: ProjectAngleMeta[] = [
  {
    id: "technical",
    label: "حلول تقنية",
    glossary:
      "مشروع تبنيه فعلياً بأدوات تخصصك — نظام، تطبيق، جهاز، أو نموذج أولي يعمل، لا فكرة نظرية على الورق.",
  },
  {
    id: "ai",
    label: "بالذكاء الاصطناعي",
    glossary:
      "مشروع يوظّف الذكاء الاصطناعي (تعلّم آلي، معالجة لغة، رؤية حاسوبية) بتطبيق مُخصَّص لطبيعة تخصصك تحديداً، لا استخداماً عاماً.",
  },
  {
    id: "research",
    label: "بحث ميداني",
    glossary: "تحقيق أو تحليل بيانات حقيقي — مُخرَجه دراسة أو تقرير يكشف واقعاً فعلياً، لا نظاماً مبنياً.",
  },
  {
    id: "impact",
    label: "ريادة وأثر مجتمعي",
    glossary: "مشروع بعنصر خدمة أو نموذج عمل يُشغَّل فعلياً — يخدم فئة حقيقية مرتبطة بمجال تخصصك.",
  },
];
