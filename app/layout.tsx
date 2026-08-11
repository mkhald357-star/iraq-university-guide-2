import "./globals.css";
import { Cairo } from "next/font/google";
import type { Metadata } from "next";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AssistantWidget } from "./components/AssistantWidget";
import SiteFooter from "./components/SiteFooter";
import SkipLink from "./components/SkipLink";
import { ReportIssueProvider } from "./context/ReportIssueContext";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "../lib/jsonLd";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  OG_IMAGE_PATH,
  OG_IMAGE_ALT,
} from "../lib/siteMeta";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["300", "400", "600", "700", "900"],
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
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} font-cairo bg-surface-subtle text-slate-900 min-h-screen`}>
        <ErrorBoundary>
          <ReportIssueProvider>
            <main className="max-w-4xl mx-auto p-4 md:p-8">{children}</main>
            <SiteFooter />
            <AssistantWidget />
          </ReportIssueProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
