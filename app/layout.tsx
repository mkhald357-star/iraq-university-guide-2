import "./globals.css";
import { Cairo } from "next/font/google";
import type { Metadata } from "next";
import { ErrorBoundary } from "./components/ErrorBoundary";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["300", "400", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "منصة التوجيه الجامعي العراقي",
  description: "اكتشف التخصص الجامعي الذي يناسب قدراتك ويضمن لك وظيفة في السوق العراقي.",
  // بلا هذا، مشاركة رابط المنصة عبر واتساب/تيليجرام/فيسبوك (أكثر قنوات
  // المشاركة شيوعاً لهذا النوع من المحتوى محلياً) تعرض معاينة فارغة بلا
  // عنوان أو وصف. لا يوجد og:image بعد لغياب أي أصل صورة جاهز في المشروع.
  openGraph: {
    title: "منصة التوجيه الجامعي العراقي",
    description: "اكتشف التخصص الجامعي الذي يناسب قدراتك ويضمن لك وظيفة في السوق العراقي.",
    locale: "ar_IQ",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} font-cairo bg-background text-slate-900 min-h-screen`}>
        <ErrorBoundary>
          <main className="max-w-4xl mx-auto p-4 md:p-8">{children}</main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
