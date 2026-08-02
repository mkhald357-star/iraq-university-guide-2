/**
 * المصدر الوحيد لكل بيانات الهوية والمشاركة. لا تكرّر أياً منها.
 *
 * ⚠️ SITE_URL/REPORT_TELEGRAM/REPORT_EMAIL قيَم نائبة مؤقَّتة صراحة -- النطاق
 * الفعلي لم يُحسَم بعد وقنوات الإبلاغ لم تُحدَّد بعد (بطلب المستخدم المباشر،
 * data/admission_rules.md §33). استُعمل ".invalid" (نطاق محجوز رسمياً من
 * IANA لا يمكن أن يُسجَّل أو يُحَلّ فعلياً -- RFC 2606) بدل "example.com"
 * كي لا يُخلَط بقيمة قد تعمل صدفة. **يجب استبدال الثلاثة قبل الإطلاق
 * الفعلي** -- ابحث عن "REPLACE_BEFORE_LAUNCH" في الشيفرة كلها.
 */

/** ⚠️ REPLACE_BEFORE_LAUNCH -- ضع النطاق الفعلي هنا، بلا شرطة مائلة في النهاية */
export const SITE_URL = "https://REPLACE_WITH_REAL_DOMAIN.invalid";

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
