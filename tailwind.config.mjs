/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,vue,svelte}"],
  theme: {
    extend: {
      colors: {
        // Warm off-white base + warm near-black ink — the restrained
        // "premium travel editorial" palette. No blue as a UI color; the
        // map provides its own cartographic tones.
        sand: {
          50: "#fdfbf7",
          100: "#f7f2e9",
          200: "#efe6d3",
        },
        stone: {
          200: "#e7dfd0",
          300: "#d8cbb4",
          400: "#b7a690",
          500: "#8e7d68",
        },
        ink: {
          500: "#5c574c",
          700: "#372f26",
          800: "#241f19",
          900: "#161310",
        },
        // Single distinctive accent — a refined terracotta/ember, used
        // deliberately (primary actions, active/selected states) rather
        // than everywhere.
        ember: {
          50: "#fdf1ea",
          200: "#f6c9ac",
          400: "#e97f47",
          500: "#d8602a",
          600: "#b74a1d",
          700: "#963c19",
        },
        // One muted supporting tone for quiet secondary accents
        // (ownership tags, subtle badges) — not a second bright color.
        pine: {
          500: "#5b6f5a",
          600: "#48594a",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "Georgia", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(22, 19, 16, 0.04), 0 8px 24px -12px rgba(22, 19, 16, 0.12)",
        lift: "0 4px 8px rgba(22, 19, 16, 0.05), 0 16px 32px -12px rgba(22, 19, 16, 0.18)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
