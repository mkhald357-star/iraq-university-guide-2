import "./globals.css";
import { Cairo, El_Messiri } from "next/font/google";
import type { Metadata } from "next";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AssistantWidget } from "./components/AssistantWidget";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import SkipLink from "./components/SkipLink";
import { ReportIssueProvider } from "./context/ReportIssueContext";
import { buildOrganizationJsonLd, buildWebSiteJsonLd, serializeJsonLd } from "../lib/jsonLd";
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, OG_IMAGE_PATH, OG_IMAGE_ALT } from "../lib/siteMeta";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["300", "400", "600", "700", "900"],
});

// خط عرض ثانٍ للعناوين الكبيرة فقط (h1-h3 عبر globals.css) -- شخصية بصرية
// مميّزة (بنية هندسية بطابع تحريري) تفصل العناوين عن النص العادي، بخلاف
// الاعتماد على Cairo وحده لكل شيء. Cairo يبقى وحيداً للنص العادي والواجهة.
const elMessiri = El_Messiri({
  subsets: ["arabic", "latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  // 🔴 إلزامي: بدونه تصبح روابط og:image نسبية فلا تُقرأ عند المشاركة
  // (data/admission_rules.md §33). SITE_URL محسومة فعلياً منذ §37 (iraqmajors.com).
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  // بلا هذا، مشاركة رابط المنصة عبر واتساب/تيليجرام/فيسبوك (أكثر قنوات
  // المشاركة شيوعاً لهذا النوع من المحتوى محلياً) تعرض معاينة فارغة بلا
  // عنوان أو وصف أو صورة.
  openGraph: {
    type: "website",
    locale: "ar_IQ",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} ${elMessiri.variable} font-cairo bg-surface-subtle text-ink min-h-screen`}>
        {/* يُشغَّل قبل الرسم لتفادي "وميض" اللون الخاطئ عند تحميل صفحة
            بالوضع الداكن المحفوظ -- inline لأنه يجب أن يُنفَّذ متزامناً
            قبل أول رسم، لا كسكربت خارجي مؤجَّل. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildOrganizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildWebSiteJsonLd()) }}
        />
        <SkipLink />
        <SiteHeader />
        <ErrorBoundary>
          <ReportIssueProvider>
            <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto p-4 md:p-8">
              {children}
            </main>
            <SiteFooter />
            <AssistantWidget />
          </ReportIssueProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
