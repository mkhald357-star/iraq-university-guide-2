import type { Metadata } from "next";
import { OG_IMAGE_PATH, OG_IMAGE_ALT } from "../../lib/siteMeta";

const TITLE = "اختبار الميول";
const DESCRIPTION = "أربعون سؤالاً تحدّد ميولك وتطابقك بتخصصات تناسبك. مجاناً وبلا حساب.";
// openGraph/images هنا لا يُدمَج تلقائياً مع الجذر (app/layout.tsx) --
// Next.js لا يدمج عميقاً حقول الكائنات، يستبدلها كاملة (مُثبَت فعلياً،
// data/admission_rules.md §33) -- فيجب تكرار الصورة صراحة في كل مسار.
const IMAGES = [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/quiz" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/quiz", images: IMAGES },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE_PATH] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
