import type { Metadata } from "next";

const TITLE = "فاحص المعدل";
const DESCRIPTION = "أدخل معدّلك وفرعك وشوف أي قسم يوصله — بلا اختبار وبلا حساب.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/gpa-check" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/gpa-check" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
