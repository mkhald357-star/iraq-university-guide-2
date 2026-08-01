import { CHANNEL_NOTICE_TITLE, CHANNEL_NOTICE_BODY, CHANNEL_BADGE } from "../../lib/admissionDisclosure";

/**
 * تنويه نطاق بيانات القبول (القناة العامة فقط). إلزامي على كل سطح يعرض
 * حدّاً أدنى. غير قابل للإخفاء أو الطيّ عمداً -- تنويه يُغلَق هو تنويه لا يُقرأ.
 */
export function ChannelNotice({ className = "" }: { className?: string }) {
  return (
    <aside dir="rtl" role="note" className={`rounded-md border border-line bg-surface-muted p-4 ${className}`}>
      <p className="font-bold text-ink">{CHANNEL_NOTICE_TITLE}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{CHANNEL_NOTICE_BODY}</p>
    </aside>
  );
}

/** شارة مضغوطة -- بجوار جدول أو بطاقة، تعزيز بصري لا بديل عن ChannelNotice. */
export function ChannelBadge({ className = "" }: { className?: string }) {
  return (
    <span
      dir="rtl"
      className={`inline-flex shrink-0 items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-ink-muted ${className}`}
    >
      {CHANNEL_BADGE}
    </span>
  );
}
