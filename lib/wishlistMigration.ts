/**
 * ترحيل الرغبات المحفوظة (localStorage "wishlistPlan") إلى بيانات اليوم.
 *
 * الرغبة المحفوظة لقطة كاملة من العرض وقت الإضافة (معرّف كلية موضعي قديم `_col_N` + أرقام قديمة).
 * معرّفات الكليات صارت حتمية (_c_<hash>) وقد تنقسم كلية بالأحرم، فتُطابَق الرغبة بمفتاح دلالي
 * (جامعة + كلية + قسم) وتُستبدل لقطتها بالعرض الحالي ببياناته وأرقامه، وما لا يُطابَق يُوسَم
 * `unavailable` ويبقى في القائمة (لا يُحذف بصمت).
 */
import type { UniversityOffering } from "./majorMatcher";
import type { WishOffering } from "./wishlistPlanner";

function squash(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** اسم الكلية دون لاحقة الحرم («كلية/القرنة» ← «كلية»). */
export function collegeBase(name: string): string {
  const i = (name || "").indexOf("/");
  return squash(i > 0 ? name.slice(0, i) : name);
}

function sameDept(a: UniversityOffering, w: UniversityOffering): boolean {
  return a.universityId === w.universityId && squash(a.departmentName) === squash(w.departmentName);
}

/** يعيد العرض الحالي المقابل للقطة، أو null إن لم يوجد مقابل واحد لا لبس فيه. */
export function findCurrentOffering(
  saved: UniversityOffering,
  current: UniversityOffering[]
): UniversityOffering | null {
  const sameUniDept = current.filter((o) => sameDept(o, saved));
  const exact = sameUniDept.filter((o) => squash(o.collegeName) === squash(saved.collegeName));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  // الكلية انقسمت بالأحرم أو تغيّرت لاحقتها: المطابقة بالاسم دون اللاحقة، شرط أن تكون وحيدة
  const base = sameUniDept.filter((o) => collegeBase(o.collegeName) === collegeBase(saved.collegeName));
  return base.length === 1 ? base[0] : null;
}

export function migrateWish(wish: WishOffering, current: UniversityOffering[] | null): WishOffering {
  // لم تُحمَّل بيانات التخصص (فشل شبكة، أو الجالب يعيد [] عند الفشل): تبقى اللقطة كما هي دون وسمها «غير متاح»
  if (current === null || current.length === 0) return wish;
  const found = findCurrentOffering(wish.offering, current);
  if (!found || !found.sessions.includes(wish.session)) {
    return { ...wish, unavailable: true };
  }
  const { unavailable: _drop, ...rest } = wish;
  void _drop;
  return { ...rest, offering: found };
}

/** `loadMajor(majorId)` يعيد عروض التخصص الحالية، أو null إن تعذّر الجلب. */
export async function migrateWishlist(
  wishes: WishOffering[],
  loadMajor: (majorId: string) => Promise<UniversityOffering[] | null>
): Promise<WishOffering[]> {
  const ids = [...new Set(wishes.map((w) => w.majorId))];
  const loaded = new Map<string, UniversityOffering[] | null>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        loaded.set(id, await loadMajor(id));
      } catch {
        loaded.set(id, null);
      }
    })
  );
  return wishes.map((w) => migrateWish(w, loaded.get(w.majorId) ?? null));
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const gradeOk = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));

/** هل العنصر المحفوظ يصلح رغبة قابلة للعرض والتصنيف؟ (بيانات المتصفح غير موثوقة: قد تكون تالفة أو بإصدار أقدم) */
export function isWishShape(w: unknown): w is WishOffering {
  if (!isObj(w) || typeof w.majorId !== "string" || (w.session !== "صباحي" && w.session !== "مسائي")) return false;
  const o = w.offering;
  if (!isObj(o)) return false;
  if (typeof o.universityId !== "string" || typeof o.departmentName !== "string") return false;
  if (!isObj(o.averageGrades) || !gradeOk(o.averageGrades["صباحي"]) || !gradeOk(o.averageGrades["مسائي"])) return false;
  if (!Array.isArray(o.sessions)) return false;
  return true;
}

/** يُبقي الرغبات الصالحة فقط ويُسقط التالف بدل أن يكسر الصفحة. */
export function sanitizeWishlist(v: unknown): WishOffering[] {
  return Array.isArray(v) ? v.filter(isWishShape) : [];
}
