# College Explorer

Explore US colleges like places, not rankings. This is the **Phase 1 vertical slice**: homepage → interactive US map → California → UCLA profile → Street View campus explorer → save → Teleport. See [`claude.md`](./claude.md) for the full product spec.

## Stack

- [Astro](https://astro.build) (static output) + strict TypeScript
- React islands for interactive pieces only: map, search, save, teleport, saved list
- Tailwind CSS
- [MapLibre GL JS](https://maplibre.org) for the map
- Google Maps Embed API for Street View

## Getting started

```bash
npm install
cp .env.example .env   # then fill in PUBLIC_GOOGLE_MAPS_EMBED_KEY
npm run dev
```

Open http://localhost:4321.

## Scripts

| Command           | Description                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`       | Start the dev server                          |
| `npm run build`     | Type-check (`astro check`) then build         |
| `npm run preview`   | Preview the production build locally          |
| `npm run lint`      | Lint `.ts`/`.tsx`/`.astro` files              |
| `npm run format`    | Format the project with Prettier              |

## Environment variables

| Variable                       | Required | Notes                                                                                   |
| ------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `PUBLIC_GOOGLE_MAPS_EMBED_KEY`  | For Street View | Public, browser-restricted key for the [Google Maps Embed API](https://developers.google.com/maps/documentation/embed/get-api-key). Restrict it by HTTP referrer. Without it, the Campus Explorer section shows a graceful "not configured" message instead of a broken embed. |

No other environment variables or services are required — there is no database and no auth in this slice.

## Data architecture

See [`src/data/README.md`](./src/data/README.md). In short: `test-colleges.ts` is a temporary, hand-written dataset of ~20 real institutions (geography/ownership only — no fabricated admissions statistics, per `claude.md`) used to validate the UI/routing/map architecture. It's isolated behind `src/lib/colleges.ts` so it can be swapped for the real College Scorecard import pipeline output later without touching pages or components.

## Known limitations (expected for this slice)

- The MapLibre style (`CARTO Positron`) is an unauthenticated dev basemap — replace with a self-hosted PMTiles style on Cloudflare R2 before production traffic.
- Only ~20 colleges exist, with most numeric stats intentionally left blank (rendered as "Data unavailable").
- UCLA's three campus tour-point coordinates are development placeholders (`unverified: true`) and must be checked before shipping.
- No automated tests yet.
