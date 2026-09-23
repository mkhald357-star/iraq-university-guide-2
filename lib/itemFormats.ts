/**
 * أشكال شاشات الاختبار. البنك (data/questions.json) يبقى قائمة **عبارات مسطّحة**
 * يسجّلها computeUserRiasecVector كما هي، وكل عبارة تحمل اختيارياً ما يجمعها
 * في شاشة:
 *
 * - "single" (الافتراضي): عبارة واحدة على مقياس الموافقة الخماسي.
 * - "grid": موقف واحد (lead) تحته 2-3 عبارات، يقيّم الطالب كلاً منها على
 *   نفس المقياس في الشاشة نفسها. كل صفّ بند عادي بأوزانه الخاصة.
 * - "pick": أربعة أنشطة من أبعاد مختلفة يختار الطالب منها "الأقرب لي"
 *   و"الأبعد عني". الأقرب = +1، الأبعد = -1، الباقيان = 0 (pickAnswers).
 *   أوزان الخيار في البنك مضروبة سلفاً بمعامل الشكل (PICK_WEIGHT_SCALE)
 *   المضبوط بالمحاكاة، فلا يحتاج المحرك أي معاملة خاصة. التطبيع في
 *   computeUserRiasecVector بـ±|w| لكل خيار هو المدى الواقعي فعلاً: كل بُعد
 *   يظهر مرة واحدة في المجموعة، وكل خيار يمكن أن يكون الأقرب (+|w|) أو
 *   الأبعد (-|w|).
 *
 * إجابات "pick" ليست موافقة على عبارة، فتُستبعد من إشارات الموافقة في كشف
 * الجدّية (isAgreeScaleItem، lib/validity.ts).
 */

export type ItemFormat = "single" | "grid" | "pick";

/**
 * معامل أوزان خيارات pick في البنك (يُطبَّق عند كتابة البنك،
 * scripts/eval/write-bank-formats.js). إجابة الأقرب/الأبعد نسبية: خياران من
 * أربعة يأخذان 0 حتى لطالب يحبّ البُعدين، فبوزن كامل تسحب المتجه نحو 50 وتضخّم
 * التخصصات متوسطة البروفايل (تشخيص المعايرة على أداة المدقّق: κ=1 → 16 تخصصاً
 * خارج نطاق فترة الثقة في خلايا التجربة، κ=0.5 → 10، κ=0 يُفقد نموذج idealPoint
 * نحو 5 نقاط دقة). هذا هو "التطبيع بالمدى الواقعي" الذي اشترطه المدقّق.
 */
export const PICK_WEIGHT_SCALE = 0.5;

export interface FormattedItemLike {
  id: string;
  text?: string;
  dimensions: Partial<Record<string, number>>;
  format?: ItemFormat;
  /** معرّف الشاشة المشتركة لصفوف grid وخيارات pick. */
  screenId?: string;
  /** نص الموقف (grid) أو سؤال الاختيار (pick) -- مكرَّر على كل عناصر الشاشة. */
  lead?: string;
}

export function itemFormat(q: { format?: ItemFormat }): ItemFormat {
  return q.format ?? "single";
}

/** بند يُجاب على مقياس الموافقة (single أو صفّ grid) -- لا خيار pick. */
export function isAgreeScaleItem(q: { format?: ItemFormat }): boolean {
  return itemFormat(q) !== "pick";
}

export interface QuizScreen<T extends FormattedItemLike = FormattedItemLike> {
  id: string;
  format: ItemFormat;
  lead?: string;
  items: T[];
}

/** يجمع العبارات المسطّحة في شاشات بترتيب ظهورها الأول. */
export function groupScreens<T extends FormattedItemLike>(items: T[]): QuizScreen<T>[] {
  const screens: QuizScreen<T>[] = [];
  const byId = new Map<string, QuizScreen<T>>();
  for (const q of items) {
    const format = itemFormat(q);
    const key = format === "single" || !q.screenId ? `single:${q.id}` : q.screenId;
    let screen = byId.get(key);
    if (!screen) {
      screen = { id: format === "single" ? q.id : key, format, lead: q.lead, items: [] };
      byId.set(key, screen);
      screens.push(screen);
    }
    screen.items.push(q);
  }
  return screens;
}

/** إجابات خيارات شاشة pick: الأقرب +1، الأبعد -1، والبقية 0. */
export function pickAnswers(
  optionIds: string[],
  most: string | null | undefined,
  least: string | null | undefined
): Record<string, number> {
  return Object.fromEntries(optionIds.map((id) => [id, id === most ? 1 : id === least ? -1 : 0]));
}

/**
 * زمن الإجابة التقديري (ثوانٍ) -- نموذج الزمن المتفق عليه مع مدقّق المحاكاة:
 * عبارة مفردة 6 ث، صفّ grid 4 ث (الموقف يُقرأ مرة واحدة)، شاشة pick 12 ث.
 */
export const SECONDS_PER_SINGLE = 6;
export const SECONDS_PER_GRID_ROW = 4;
export const SECONDS_PER_PICK = 12;

export function estimateScreenSeconds(screen: QuizScreen): number {
  if (screen.format === "grid") return SECONDS_PER_GRID_ROW * screen.items.length;
  if (screen.format === "pick") return SECONDS_PER_PICK;
  return SECONDS_PER_SINGLE * screen.items.length;
}

export function estimateSeconds(items: FormattedItemLike[]): number {
  return groupScreens(items).reduce((s, sc) => s + estimateScreenSeconds(sc), 0);
}
