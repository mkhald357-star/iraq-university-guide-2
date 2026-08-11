// جلب ملف مهارات تخصص واحد (public/data/major-skills/<majorId>.json، مبنية
// وقت البناء عبر scripts/build-major-skills.js) بدل استيراد data/major_skills.json
// الكامل (كل الـ88 تخصصاً) داخل حزمة العميل في كل صفحة تحتاج تفصيل تخصص واحد
// فقط -- نفس نمط lib/majorProfileClient.ts بالضبط.

export interface SkillEntry {
  name: string;
  /** لماذا تهم هذه المهارة تحديداً هذا التخصص -- لا صياغة عامة تصلح لأي تخصص. */
  why: string;
  /** خطوة فعلية ملموسة لبنائها أثناء الدراسة -- لا نصيحة عامة. */
  how: string;
}

export interface MajorSkillSet {
  id: string;
  soft: SkillEntry[];
  practical: SkillEntry[];
  digital: SkillEntry[];
}

export async function fetchMajorSkills(majorId: string): Promise<MajorSkillSet | null> {
  try {
    const res = await fetch(`/data/major-skills/${majorId}.json`);
    if (!res.ok) return null;
    return (await res.json()) as MajorSkillSet;
  } catch {
    return null;
  }
}
