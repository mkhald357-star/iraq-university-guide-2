/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true, // إلزامي مع static export -- معالج الصور في Next.js يحتاج خادماً وقت التشغيل
  },
};

module.exports = nextConfig;
