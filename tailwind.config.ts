// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx,js,jsx,cjs}",
    "./src/components/**/*.{ts,tsx,js,jsx,cjs}",
    "./src/pages/**/*.{ts,tsx,js,jsx,cjs}",
  "./src/layout/**/*.{ts,tsx,js,jsx,cjs}",
  ],
  theme: {
    extend: {
      screens: {
      sm: "640px",  // small phones
      md: "768px",  // tablets / small laptops
      lg: "1024px", // desktops
      xl: "1280px", // large desktops
      "2xl": "1536px",
    },
      colors: {
        accent: "#6366f1",
      },
      boxShadow: {
        // now `shadow-soft` works
        soft: "0 2px 8px 0 rgb(0 0 0 / 0.08), 0 1px 3px -1px rgb(0 0 0 / 0.06)",
      },
    },
  },
  darkMode: "class",
  plugins: [],
};

export default config;
