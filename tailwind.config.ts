import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "sans-serif"],
        serif: ["Instrument Serif", "serif"],
      },
      colors: {
        cream: "#f5f0e8",
        slate: "#1a1a2e",
        // Semantic tokens — switch automatically with .dark class via CSS variables
        paper:   "rgb(var(--paper)   / <alpha-value>)",
        ink:     "rgb(var(--ink)     / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
      },
    },
  },
  plugins: [],
} satisfies Config;
