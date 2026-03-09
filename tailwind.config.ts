import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "sans-serif"],
        serif: ["Instrument Serif", "serif"],
      },
      colors: {
        cream: "#f5f0e8",
        slate: "#1a1a2e",
      },
    },
  },
  plugins: [],
} satisfies Config;
