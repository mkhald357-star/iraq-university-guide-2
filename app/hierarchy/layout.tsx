import type { Metadata } from "next";
import { OG_IMAGE_PATH, OG_IMAGE_ALT } from "../../lib/siteMeta";

const TITLE = "الحدود الدنيا بالتسلسل: محافظة، جامعة، كلية، قسم";
const DESCRIPTION =
  "كل صف من جدول الحدود الدنيا للقبول المركزي الرسمي مرتباً بالمحافظة فالجامعة فالكلية فالقسم، مع تمييز حد القسم عن حد الكلية والمسار.";
const IMAGES = [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/hierarchy" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/hierarchy", images: IMAGES },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE_PATH] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
