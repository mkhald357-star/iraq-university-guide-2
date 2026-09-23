/**
 * حوض الأسئلة الذي يُحسَب عليه متجه الطالب: الأسئلة الأساسية + كل سؤال
 * احتياط/ترجيح أجاب عنه فعلاً. مصدر وحيد تستخدمه صفحة الاختبار وصفحة
 * /report معاً -- كانت /report تحسب من الأسئلة الأساسية وحدها فتتجاهل
 * إجابات الجولة الإضافية، فيختلف متجه التقرير عن متجه الاختبار نفسه.
 */
import type { RiasecQuestion } from "./riasec";

export function buildScoredPool<Q extends RiasecQuestion>(
  answers: Record<string, number>,
  core: Q[],
  extraBanks: Q[][]
): Q[] {
  const coreIds = new Set(core.map((q) => q.id));
  const extra = new Map<string, Q>();
  extraBanks.flat().forEach((q) => {
    if (!coreIds.has(q.id) && q.id in answers && !extra.has(q.id)) extra.set(q.id, q);
  });
  return [...core, ...extra.values()];
}
