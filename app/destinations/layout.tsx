import type { Metadata } from "next";

const TITLE = "وجهات العمل";
const DESCRIPTION = "أين يشتغل خرّيجو كل تخصص في العراق، وما الترخيص المطلوب.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/destinations" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/destinations" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
