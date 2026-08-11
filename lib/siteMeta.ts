/**
 * المصدر الوحيد لكل بيانات الهوية والمشاركة. لا تكرّر أياً منها.
 *
 * ⚠️ REPORT_TELEGRAM/REPORT_EMAIL لا تزالان قيمتين نائبتين صراحة -- قنوات
 * الإبلاغ الفعلية لم تُحدَّد بعد (بطلب المستخدم المباشر، data/admission_rules.md
 * §33). SITE_URL حُسم في §37 (2026-08-10) بعد تحقّق مباشر (curl + Playwright)
 * أن iraqmajors.com حيّ فعلاً وينشر آخر بناء للمنصة. استُعمل ".invalid" (نطاق
 * محجوز رسمياً من IANA لا يمكن أن يُسجَّل أو يُحَلّ فعلياً -- RFC 2606) بدل
 * "example.com" للحقلين المتبقيين كي لا يُخلَطا بقيمة قد تعمل صدفة. **يجب
 * استبدالهما قبل الإطلاق الفعلي** -- ابحث عن "REPLACE_BEFORE_LAUNCH".
 */

export const SITE_URL = "https://iraqmajors.com";

export const SITE_NAME = "منصة التوجيه الجامعي العراقي";

export const SITE_TAGLINE = "اختر تخصصك الجامعي بالأرقام الحقيقية";

export const SITE_DESCRIPTION =
  "منصّة عراقية مجانية: اختبار ميول علمي، ومطابقة بحدود القبول الرسمية لكل قسم جامعي في العراق. " +
  "بلا حساب، وبلا جمع بيانات.";

/** ⚠️ REPLACE_BEFORE_LAUNCH -- قناة الإبلاغ عن الأخطاء، ضع الرابط الفعلي */
export const REPORT_TELEGRAM = "https://t.me/REPLACE_BEFORE_LAUNCH";
/** ⚠️ REPLACE_BEFORE_LAUNCH -- ضع البريد الفعلي */
export const REPORT_EMAIL = "REPLACE_BEFORE_LAUNCH@invalid";

export const OG_IMAGE_PATH = "/og/cover.png";
export const OG_IMAGE_ALT = `${SITE_NAME} — ${SITE_TAGLINE}`;
