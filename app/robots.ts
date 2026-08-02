import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/siteMeta";

// إلزامي مع output:'export' -- بدونه يفشل البناء (Next.js 15.5.19، مُثبَت فعلياً).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
