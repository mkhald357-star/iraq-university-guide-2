import { execSync } from "node:child_process";
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
  "/privacy",
  "/decider",
  "/skills",
  "/cost",
  "/projects",
];

// تاريخ آخر commit لا وقت البناء: البناء نفسه يُنتج الملف نفسه (شرط مراقبة السلامة، SECURITY-PLAN.md س4).
function lastCommitDate(): Date {
  try {
    return new Date(execSync("git log -1 --format=%cI").toString().trim());
  } catch {
    return new Date();
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = lastCommitDate();
  return ROUTES.map((r) => ({
    url: `${SITE_URL}${r}`,
    lastModified,
    changeFrequency: "monthly",
    priority: r === "" ? 1 : 0.7,
  }));
}
