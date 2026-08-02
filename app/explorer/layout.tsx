import type { Metadata } from "next";
import { OG_IMAGE_PATH, OG_IMAGE_ALT } from "../../lib/siteMeta";

const TITLE = "مستكشف الجامعات";
const DESCRIPTION = "تصفّح كل قسم جامعي في العراق وفلتِره بالمحافظة والفرع والحد الأدنى.";
// openGraph/images لا يُدمَج تلقائياً مع الجذر -- data/admission_rules.md §33.
const IMAGES = [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/explorer" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/explorer", images: IMAGES },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE_PATH] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
