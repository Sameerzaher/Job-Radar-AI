import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#050816",
        surface: "#0f172a",
        accent: {
          DEFAULT: "#4f46e5",
          soft: "#6366f1"
        }
      },
      borderRadius: {
        xl: "1rem"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(15,23,42,0.7)"
      }
    }
  },
  plugins: []
};

export default config;
