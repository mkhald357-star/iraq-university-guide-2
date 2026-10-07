/**
 * عائلات التخصصات: المجال الدراسي كما يتعرّف عليه الطالب («الحوسبة»،
 * «الكهرباء والإلكترونيات»…) لا الفئة الإدارية في data/majors.json.
 *
 * لماذا لا تُشتقّ من البروفايلات: التجميع الهرمي على بروفايلات RIASEC ينتج
 * كتلاً حسب البُعد الغالب لا حسب المجال -- عند عتبة تشابه 82 يجتمع الصيدلة
 * والأمن السيبراني وهندسة البرمجيات والرياضيات والفيزياء في عائلة واحدة
 * لأنها كلها استقصائية. المجال معنى لا مسافة، فالعائلات منسَّقة في
 * data/major_families.json ويتحقّق منها validate-data.
 */
import familiesData from "../data/major_families.json";

export interface MajorFamily {
  id: string;
  name: string;
  memberIds: string[];
}

export interface FamilyData {
  families: MajorFamily[];
  /** معرّف التخصص ← معرّف عائلته. */
  byMajor: Record<string, string>;
  byId: Record<string, MajorFamily>;
}

export function buildFamilyData(
  raw: { families: MajorFamily[] } = familiesData as { families: MajorFamily[] }
): FamilyData {
  const byMajor: Record<string, string> = {};
  const byId: Record<string, MajorFamily> = {};
  raw.families.forEach((f) => {
    byId[f.id] = f;
    f.memberIds.forEach((id) => (byMajor[id] = f.id));
  });
  return { families: raw.families, byMajor, byId };
}

export const MAJOR_FAMILIES: FamilyData = buildFamilyData();

/**
 * عائلة التخصص. تخصص خارج الخريطة يحصل على عائلة خاصة به (`__solo:<id>`)
 * فلا يسقط من التوصية أبداً -- إضافة تخصص جديد بلا تحديث الخريطة تُضعف
 * التنويع ولا تُخفي التخصص.
 */
export function familyOf(data: FamilyData, majorId: string): string {
  return data.byMajor[majorId] ?? `__solo:${majorId}`;
}

export function familyName(data: FamilyData, familyId: string): string {
  return data.byId[familyId]?.name ?? "";
}
