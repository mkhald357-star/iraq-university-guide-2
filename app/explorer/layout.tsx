import type { Metadata } from "next";

const TITLE = "مستكشف الجامعات";
const DESCRIPTION = "تصفّح كل قسم جامعي في العراق وفلتِره بالمحافظة والفرع والحد الأدنى.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/explorer" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/explorer" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
