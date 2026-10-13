/**
 * بيانات Organization/WebSite المنظَّمة (JSON-LD) لجذر الموقع -- تُبنى حصراً
 * من قيم lib/siteMeta.ts المحسومة فعلاً (SITE_URL/SITE_NAME/...)، بلا أي
 * قيمة جديدة أو مُخترَعة.
 */
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from "./siteMeta";

/**
 * التحويل الوحيد المسموح لحقن JSON-LD في <script>: يهرّب < و> و& وفاصلي السطر (U+2028/2029) فلا يمكن
 * لأي قيمة أن تغلق وسم السكربت أو تُفسَّر HTML (SECURITY-PLAN.md س1-3).
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

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
