import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/siteMeta";

// /report خارج الخريطة عمداً -- نتيجة شخصية بمعامل ?major=، لا صفحة عامة
// قابلة للفهرسة (data/admission_rules.md §33).
const ROUTES = ["", "/quiz", "/explorer", "/gpa-check", "/wishlist", "/destinations", "/income"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({
    url: `${SITE_URL}${r}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: r === "" ? 1 : 0.7,
  }));
}
