import { REPORT_TELEGRAM, REPORT_INSTAGRAM, SITE_NAME } from "./siteMeta";

export interface IssueContext {
  page: string; // المسار
  university?: string;
  college?: string;
  department?: string;
  shownValue?: string; // ما ظهر للطالب فعلاً
}

/**
 * يبني نصّ البلاغ. لا يتضمّن أي بيانات شخصية --
 * لا معدّل، ولا فرع، ولا محافظة، ولا أي مُدخَل للطالب.
 */
export function buildReportText(ctx: IssueContext): string {
  const lines = [`بلاغ عن خطأ — ${SITE_NAME}`, ""];

  lines.push(`الصفحة: ${ctx.page}`);
  if (ctx.university) lines.push(`الجامعة: ${ctx.university}`);
  if (ctx.college) lines.push(`الكلية: ${ctx.college}`);
  if (ctx.department) lines.push(`القسم: ${ctx.department}`);
  if (ctx.shownValue) lines.push(`المعروض: ${ctx.shownValue}`);

  lines.push("", "وصف الخطأ (اكتب هنا):", "");
  return lines.join("\n");
}

/**
 * روابط المحادثة المباشرة. تلغرام وإنستغرام لا يقبلان نصاً جاهزاً لحساب شخصي، فالنص يُنسخ للحافظة
 * أولاً (في الحوار) ثم يُفتح الرابط ليلصقه الطالب. الرابط لا يحمل أي نص ولا أي بيانات.
 */
export function telegramLink(): string {
  return REPORT_TELEGRAM;
}

export function instagramLink(): string {
  return REPORT_INSTAGRAM;
}
