import type { Metadata } from "next";

const TITLE = "اختبار الميول";
const DESCRIPTION = "أربعون سؤالاً تحدّد ميولك وتطابقك بتخصصات تناسبك. مجاناً وبلا حساب.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/quiz" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/quiz" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
