/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/styles/**/*.ts"
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f172a",
        surface: "#1e293b",
        accent: { DEFAULT: "#6366f1", soft: "#818cf8" }
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"]
      },
      fontSize: {
        "ds-caption": ["0.75rem", { lineHeight: "1.25rem" }],
        "ds-body": ["0.875rem", { lineHeight: "1.375rem" }],
        "ds-body-lg": ["1rem", { lineHeight: "1.5rem" }],
        "ds-title": ["1.125rem", { lineHeight: "1.5rem" }],
        "ds-page": ["1.5rem", { lineHeight: "2rem" }],
        "ds-display": ["1.875rem", { lineHeight: "2.25rem" }]
      },
      spacing: {
        "ds-page": "1.5rem",
        "ds-section": "2rem",
        "ds-block": "1rem",
        "ds-card": "1.25rem",
        "ds-card-lg": "1.5rem",
        "ds-input-gap": "0.5rem"
      },
      borderRadius: {
        "ds-sm": "0.375rem",
        "ds-md": "0.5rem",
        "ds-lg": "0.75rem",
        "ds-xl": "1rem",
        "ds-2xl": "1.25rem"
      },
      boxShadow: {
        soft: "0 4px 24px -4px rgba(0,0,0,0.2), 0 8px 16px -6px rgba(0,0,0,0.15)",
        card: "0 1px 3px 0 rgba(0,0,0,0.2), 0 1px 2px -1px rgba(0,0,0,0.2)"
      }
    }
  },
  plugins: []
};

