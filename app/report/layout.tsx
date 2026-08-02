import type { Metadata } from "next";

const TITLE = "نتيجتك";
const DESCRIPTION = "تخصصاتك الأنسب مع حدود القبول الرسمية لكل قسم.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/report" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/report" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
