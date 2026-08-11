/**
 * بيانات Organization/WebSite المنظَّمة (JSON-LD) لجذر الموقع -- تُبنى حصراً
 * من قيم lib/siteMeta.ts المحسومة فعلاً (SITE_URL/SITE_NAME/...)، بلا أي
 * قيمة جديدة أو مُخترَعة. REPORT_TELEGRAM/REPORT_EMAIL لا تزالان نائبتين
 * (§33) فلا تدخلان هنا إطلاقاً.
 */
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from "./siteMeta";

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: SITE_TAGLINE,
    url: SITE_URL,
  };
}
