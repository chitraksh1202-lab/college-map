/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,vue,svelte}"],
  theme: {
    extend: {
      colors: {
        horizon: {
          50: "#f2f9ff",
          100: "#e2f2ff",
          200: "#bfe4ff",
          300: "#8ccfff",
          400: "#4fb3ff",
          500: "#1f93ff",
          600: "#0d74e0",
          700: "#0a5cb5",
          800: "#0d4b8f",
          900: "#103f73",
        },
        sunset: {
          400: "#ff9d6c",
          500: "#ff7a45",
          600: "#f05a24",
        },
      },
      fontFamily: {
        display: ["'Clash Display'", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
