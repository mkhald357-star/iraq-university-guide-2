const { execSync } = require("child_process");

// معرّف بناء ثابت = الـcommit، فبناء الـcommit نفسه يُنتج الملفات نفسها بايتاً ببايت.
// هذا شرط مراقبة السلامة (SECURITY-PLAN.md س4): مقارنة الموقع الحي بإعادة بناء الـcommit المنشور.
function commitBuildId() {
  const env = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  if (env) return env;
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return null; // لا git: يعود Next لمعرّف عشوائي
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true, // إلزامي مع static export -- معالج الصور في Next.js يحتاج خادماً وقت التشغيل
  },
  productionBrowserSourceMaps: false, // لا خرائط مصدر في المنشور (postbuild يُفشل إن ظهرت)
  poweredByHeader: false,
  generateBuildId: commitBuildId,
};

module.exports = nextConfig;
