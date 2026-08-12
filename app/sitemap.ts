import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/siteMeta";

// إلزامي مع output:'export' -- بدونه يفشل البناء (Next.js 15.5.19، مُثبَت فعلياً).
export const dynamic = "force-static";

// /report خارج الخريطة عمداً -- نتيجة شخصية بمعامل ?major=، لا صفحة عامة
// قابلة للفهرسة (data/admission_rules.md §33).
const ROUTES = [
  "",
  "/quiz",
  "/explorer",
  "/gpa-check",
  "/wishlist",
  "/destinations",
  "/income",
  "/compare",
  "/decider",
  "/skills",
  "/cost",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({
    url: `${SITE_URL}${r}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: r === "" ? 1 : 0.7,
  }));
}
