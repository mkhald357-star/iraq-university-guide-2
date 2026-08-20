// جلب ملف أفكار مشاريع تخصص واحد (public/data/major-projects/<majorId>.json،
// مبنية وقت البناء عبر scripts/build-major-projects.js) بدل استيراد
// data/major_projects.json الكامل (كل الـ88 تخصصاً، 4,400 فكرة) داخل حزمة
// العميل -- نفس نمط lib/skillsClient.ts بالضبط.

export interface ProjectIdea {
  title: string;
  /** الحاجة/الفجوة العامة التي يعالجها المشروع -- لا إحصائية أو جهة محدَّدة. */
  problem: string;
  /** ماذا ينطوي عليه التنفيذ فعلياً -- مكوّنات/خطوات/مُخرَج ملموس. */
  description: string;
}

export interface MajorProjectSet {
  id: string;
  technical: ProjectIdea[];
  ai: ProjectIdea[];
  research: ProjectIdea[];
}

export async function fetchMajorProjects(majorId: string): Promise<MajorProjectSet | null> {
  try {
    const res = await fetch(`/data/major-projects/${majorId}.json`);
    if (!res.ok) return null;
    return (await res.json()) as MajorProjectSet;
  } catch {
    return null;
  }
}
