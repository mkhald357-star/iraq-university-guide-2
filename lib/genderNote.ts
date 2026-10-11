/**
 * الجنس يُذكر لقسم محدَّد فقط، لا لكل قسم:
 *  - قسم لجنس واحد في الحدود الرسمية (رياض الأطفال، كليات البنات…) ⇒ "للإناث فقط" / "للذكور فقط".
 *  - قسم يختلف فيه حدّ الذكور عن الإناث لفرع الطالب ⇒ "ذكور X% · إناث Y%".
 * بقية الأقسام (مختلط) لا تُعاد لها أي عبارة جنس.
 */
import type { GenderRestriction } from "./majorMatcher";

export interface GenderCarrier {
  genderRestriction?: GenderRestriction;
  /** سجل by-branch: حدّا جنسي فرع هذا السجل. */
  morningGender?: { ذكر: number; أنثى: number };
  /** عرض كامل: حدّا الجنسين لكل فرع. */
  genderByBranch?: Record<string, { ذكر: number; أنثى: number }>;
  forBranch?: string;
}

export function genderRestrictionLabel(g: GenderRestriction | undefined): string | null {
  if (g === "أنثى") return "للإناث فقط";
  if (g === "ذكر") return "للذكور فقط";
  return null;
}

const BRANCH_ORDER = ["علمي", "أدبي", "فنون"];

function fmt(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, "")}%`;
}

/** سطر حدّي الجنسين، أو null إن لم يكن للقسم حدّان مختلفان في الفرع/الفروع المعروضة. */
export function genderCutoffLine(o: GenderCarrier): string | null {
  if (o.morningGender) return `ذكور ${fmt(o.morningGender.ذكر)} · إناث ${fmt(o.morningGender.أنثى)}`;
  const by = o.genderByBranch;
  if (!by) return null;
  if (o.forBranch) {
    const g = by[o.forBranch];
    return g ? `ذكور ${fmt(g.ذكر)} · إناث ${fmt(g.أنثى)}` : null;
  }
  const parts = BRANCH_ORDER.filter((b) => by[b]).map((b) => `${b}: ذكور ${fmt(by[b].ذكر)} · إناث ${fmt(by[b].أنثى)}`);
  return parts.length ? parts.join(" — ") : null;
}
