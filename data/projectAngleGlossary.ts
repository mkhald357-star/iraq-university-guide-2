// تعريف عام لكل زاوية مشاريع تخرّج كمفهوم -- يُعرض مرة واحدة أعلى صفحة
// /projects، لا مكرَّراً لكل تخصص. بيانات خالصة بلا JSX، نفس نمط
// data/skillCategoryGlossary.ts -- أيقونة كل زاوية تُربَط في app/projects/page.tsx.

export type ProjectAngleId = "technical" | "ai" | "research";

export interface ProjectAngleMeta {
  id: ProjectAngleId;
  label: string;
  glossary: string;
}

export const PROJECT_ANGLES: ProjectAngleMeta[] = [
  {
    id: "technical",
    label: "حلول تقنية وعملية",
    glossary:
      "مشروع تبنيه أو تجريه فعلياً بأدوات تخصصك — نظام، تطبيق، جهاز، نموذج أولي يعمل، أو تجربة مختبرية/عملية منفَّذة، لا فكرة نظرية على الورق.",
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
];
