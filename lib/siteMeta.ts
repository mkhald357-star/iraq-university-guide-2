/**
 * المصدر الوحيد لكل بيانات الهوية والمشاركة. لا تكرّر أياً منها.
 *
 * قنوات الإبلاغ حُسمت (2026-10-13، قرار المالك): تلغرام @kaxfk وإنستغرام ka_xf، ولا بريد.
 * SITE_URL حُسم في §37 (2026-08-10) بعد تحقّق مباشر (curl + Playwright)
 * أن iraqmajors.com حيّ فعلاً وينشر آخر بناء للمنصة. استُعمل ".invalid" (نطاق
 * محجوز رسمياً من IANA لا يمكن أن يُسجَّل أو يُحَلّ فعلياً -- RFC 2606) بدل
 * "example.com" كي لا تُخلَط بقيمة قد تعمل صدفة. اختبار في lib/siteMeta.test.ts يُفشل البناء إن عادت
 * أي قيمة نائبة (حماية من انتحال قناة بلاغ غير محجوزة).
 */

export const SITE_URL = "https://iraqmajors.com";

export const SITE_NAME = "منصة التوجيه الجامعي العراقي";

export const SITE_TAGLINE = "اختر تخصصك الجامعي بالأرقام الحقيقية";

export const SITE_DESCRIPTION =
  "منصّة عراقية مجانية: اختبار ميول علمي، ومطابقة بحدود القبول الرسمية لكل قسم جامعي في العراق. " +
  "بلا حساب، وبلا جمع بيانات.";

/** قناة الإبلاغ عن الأخطاء: حساب تلغرام المالك (رابط المحادثة المباشرة). */
export const REPORT_TELEGRAM = "https://t.me/kaxfk";
export const REPORT_TELEGRAM_HANDLE = "@kaxfk";
/** قناة بديلة: رسائل إنستغرام المباشرة لحساب المالك. */
export const REPORT_INSTAGRAM = "https://ig.me/m/ka_xf";
export const REPORT_INSTAGRAM_HANDLE = "ka_xf";

export const OG_IMAGE_PATH = "/og/cover.png";
export const OG_IMAGE_ALT = `${SITE_NAME} — ${SITE_TAGLINE}`;
