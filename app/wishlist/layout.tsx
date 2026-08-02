import type { Metadata } from "next";

const TITLE = "مرتِّب الرغبات";
const DESCRIPTION = "رتّب رغباتك على حدود القبول الحقيقية.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/wishlist" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/wishlist" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
