import type { Metadata } from "next";
import { OG_IMAGE_PATH, OG_IMAGE_ALT } from "../../lib/siteMeta";

const TITLE = "بنك أفكار مشاريع التخرّج";
const DESCRIPTION = "أفكار مشاريع مرتبطة بتخصصك وبحاجة حقيقية في السوق المحلي.";
const IMAGES = [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/projects" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/projects", images: IMAGES },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE_PATH] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
