import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1d4ed8", // blue-700
        secondary: "#9333ea", // purple-600
        background: "#f8fafc", // slate-50
        surface: "#ffffff",
      },
      fontFamily: {
        cairo: ["var(--font-cairo)"],
      },
    },
  },
  plugins: [],
};
export default config;
