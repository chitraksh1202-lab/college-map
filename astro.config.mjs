import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import { SITE_URL } from "./src/lib/site.ts";

export default defineConfig({
  site: SITE_URL,
  integrations: [
    react(),
    tailwind(),
    sitemap({
      filter: (page) => !page.includes("/atlas"),
    }),
  ],
  output: "static",
  // "Saved" -> "My Atlas": preserve the old bookmarked/shared URL rather
  // than letting it 404. /saved was already noindex, so nothing SEO-wise
  // is lost either way.
  redirects: {
    "/saved": "/atlas",
  },
});
