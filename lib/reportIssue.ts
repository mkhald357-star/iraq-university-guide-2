import { REPORT_TELEGRAM, REPORT_EMAIL, SITE_NAME } from "./siteMeta";

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

export function telegramLink(text: string): string {
  return `${REPORT_TELEGRAM}?text=${encodeURIComponent(text)}`;
}

export function mailtoLink(text: string): string {
  const subject = encodeURIComponent(`بلاغ عن خطأ — ${SITE_NAME}`);
  return `mailto:${REPORT_EMAIL}?subject=${subject}&body=${encodeURIComponent(text)}`;
}
