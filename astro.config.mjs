import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// TODO: replace with the real production domain once one is chosen/deployed.
const SITE_URL = "https://college-explorer.pages.dev";

export default defineConfig({
  site: SITE_URL,
  integrations: [
    react(),
    tailwind(),
    sitemap({
      filter: (page) => !page.includes("/saved"),
    }),
  ],
  output: "static",
});
