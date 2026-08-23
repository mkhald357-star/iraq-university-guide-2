import type { Config } from "tailwindcss";

const config: Config = {
  // يربط متغيّر dark: في Tailwind بنفس آلية زر التبديل الفعلي
  // (ThemeToggle.tsx يضبط data-theme على <html>) بدل الافتراضي media (يتبع
  // نظام التشغيل فقط بلا علاقة باختيار المستخدم الصريح المحفوظ).
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--c-primary-600)",
          50: "var(--c-primary-50)",
          100: "var(--c-primary-100)",
          200: "var(--c-primary-200)",
          300: "var(--c-primary-300)",
          400: "var(--c-primary-400)",
          500: "var(--c-primary-500)",
          600: "var(--c-primary-600)",
          700: "var(--c-primary-700)",
          800: "var(--c-primary-800)",
          900: "var(--c-primary-900)",
        },
        surface: {
          DEFAULT: "var(--c-bg)",
          subtle: "var(--c-bg-subtle)",
          muted: "var(--c-bg-muted)",
        },
        ink: {
          DEFAULT: "var(--c-text)",
          soft: "var(--c-text-soft)",
          muted: "var(--c-text-muted)",
        },
        line: {
          DEFAULT: "var(--c-border)",
          strong: "var(--c-border-strong)",
        },
        band: {
          safe: "var(--c-safe)",
          "safe-bg": "var(--c-safe-bg)",
          close: "var(--c-close)",
          "close-bg": "var(--c-close-bg)",
          reach: "var(--c-reach)",
          "reach-bg": "var(--c-reach-bg)",
          unknown: "var(--c-unknown)",
          "unknown-bg": "var(--c-unknown-bg)",
        },
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
      },
      boxShadow: {
        sm: "var(--sh-sm)",
        md: "var(--sh-md)",
        lg: "var(--sh-lg)",
      },
      fontFamily: {
        cairo: ["var(--font-cairo)"],
        display: ["var(--font-display)", "var(--font-cairo)"],
      },
    },
  },
  plugins: [],
};
export default config;
