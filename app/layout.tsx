import "./globals.css";
import { Cairo } from "next/font/google";
import type { Metadata } from "next";
import { QuizProvider } from "./context/QuizContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["300", "400", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "منصة التوجيه الجامعي العراقي",
  description: "اكتشف التخصص الجامعي الذي يناسب قدراتك ويضمن لك وظيفة في السوق العراقي.",
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
          <QuizProvider>
            <main className="max-w-4xl mx-auto p-4 md:p-8">{children}</main>
          </QuizProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
