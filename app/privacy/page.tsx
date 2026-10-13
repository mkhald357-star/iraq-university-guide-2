import ClearDataButton from "../components/ClearDataButton";
import { CUTOFFS_YEAR } from "../../lib/admissionDisclosure";
import { REPORT_TELEGRAM, REPORT_TELEGRAM_HANDLE, REPORT_INSTAGRAM, REPORT_INSTAGRAM_HANDLE } from "../../lib/siteMeta";

/** صفحة الخصوصية (SECURITY-PLAN.md س5): ما يُحفظ، وأين، وكيف يُمسح، ومصدر الأرقام، وقنوات التواصل الوحيدة. */
export default function PrivacyPage() {
  return (
    <main id="main" dir="rtl" className="mx-auto max-w-3xl px-4 py-10 leading-loose text-ink">
      <h1 className="text-2xl font-extrabold">الخصوصية والأمان</h1>

      <h2 className="mt-8 text-lg font-bold">لا حساب، ولا جمع بيانات</h2>
      <p className="mt-2 text-ink-soft">
        المنصة لا تطلب تسجيلاً ولا اسماً ولا رقم هاتف، ولا ترسل إجاباتك أو معدّلك إلى أي خادم. لا نستعمل أدوات تتبّع ولا
        إعلانات ولا ملفات تعريف لأطراف خارجية.
      </p>

      <h2 className="mt-8 text-lg font-bold">ما يُحفظ في جهازك فقط</h2>
      <p className="mt-2 text-ink-soft">
        لتجد نتيجتك عند عودتك، يحفظ متصفحك (لا نحن) على هذا الجهاز: نتيجة اختبار الميول وإجاباته، والمعدّل والفرع
        والمحافظة التي أدخلتها، وقائمة رغباتك، واختيار الوضع الداكن. إن كان الجهاز مشتركاً، امسحها:
      </p>
      <div className="mt-3">
        <ClearDataButton />
      </div>

      <h2 className="mt-8 text-lg font-bold">من أين الأرقام</h2>
      <p className="mt-2 text-ink-soft">
        حدود القبول منقولة من وثائق نشرتها وزارة التعليم العالي والبحث العلمي (دليل الطالب و«الحدود الدنيا للقبول
        المركزي» للسنة الدراسية {CUTOFFS_YEAR}). حين ينشر الجدول حداً للكلية أو للمسار لا للقسم وحده، نذكر ذلك تحت
        الرقم. القرار النهائي دائماً لموقع الوزارة الرسمي.
      </p>

      <h2 className="mt-8 text-lg font-bold">حساباتنا الوحيدة</h2>
      <p className="mt-2 text-ink-soft">
        للبلاغات والتواصل: تلغرام{" "}
        <a href={REPORT_TELEGRAM} target="_blank" rel="noopener noreferrer" className="underline" dir="ltr">
          {REPORT_TELEGRAM_HANDLE}
        </a>{" "}
        وإنستغرام{" "}
        <a href={REPORT_INSTAGRAM} target="_blank" rel="noopener noreferrer" className="underline" dir="ltr">
          {REPORT_INSTAGRAM_HANDLE}
        </a>
        . لا نطلب منك أبداً كلمة مرور أو مالاً أو صوراً شخصية. أي حساب أو موقع آخر يدّعي أنه نحن ليس لنا.
      </p>

      <h2 className="mt-8 text-lg font-bold">الإبلاغ عن ثغرة أمنية</h2>
      <p className="mt-2 text-ink-soft">
        إن وجدت ثغرة في الموقع، راسلنا على الحسابين أعلاه. التفاصيل في{" "}
        <a href="/.well-known/security.txt" className="underline" dir="ltr">
          /.well-known/security.txt
        </a>
        .
      </p>
    </main>
  );
}
