import type { Metadata } from "next";

const TITLE = "دخل التخصص";
const DESCRIPTION = "الراتب الحكومي الأول والمخصصات، بمصادر رسمية موثّقة.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/income" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/income" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
