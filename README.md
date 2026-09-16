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
cp .env.example .env   # then fill in the env vars below
npm run data:import     # fetches official College Scorecard data -> src/data/generated/colleges.json
npm run dev
```

Open http://localhost:4321.

## Scripts

| Command             | Description                                                          |
| -------------------- | ---------------------------------------------------------------------- |
| `npm run dev`         | Start the dev server                                                  |
| `npm run data:import` | Fetch/normalize/validate College Scorecard data into `src/data/generated/colleges.json` |
| `npm run build`       | Type-check (`astro check`) then build                                 |
| `npm run preview`     | Preview the production build locally                                  |
| `npm run lint`        | Lint `.ts`/`.tsx`/`.astro` files                                      |
| `npm run format`      | Format the project with Prettier                                      |

## Environment variables

| Variable                       | Required | Notes                                                                                   |
| ------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `PUBLIC_GOOGLE_MAPS_EMBED_KEY`  | For Street View | Public, browser-restricted key for the [Google Maps Embed API](https://developers.google.com/maps/documentation/embed/get-api-key). Restrict it by HTTP referrer. Without it, the Campus Explorer section shows a graceful "not configured" message instead of a broken embed. |
| `COLLEGE_SCORECARD_ZIP_URL`    | Optional | Only needed if `data:import`'s automatic discovery of the current bulk-download link breaks. No key/credential of any kind is required — the bulk file is public. |

No database and no auth in this slice.

## Data architecture

See [`src/data/README.md`](./src/data/README.md). In short: `npm run data:import` (`scripts/import-college-scorecard.ts`) downloads the official "Most Recent Institution-Level Data" bulk CSV from the US Dept of Education College Scorecard (https://collegescorecard.ed.gov/data/), verifies a confident match for each of our ~20 target institutions, normalizes the result into the internal `College` schema, validates it, and writes `src/data/generated/colleges.json` — the file the app actually reads through `src/lib/colleges.ts`. Curated campus-tour data (`src/data/curated/`) stays separate and is joined at render time, never merged into the official dataset. Pass `--refresh` to force a fresh download instead of reusing the cached copy in `src/data/raw/`.

## Known limitations (expected for this slice)

- The MapLibre style (`CARTO Positron`) is an unauthenticated dev basemap — replace with a self-hosted PMTiles style on Cloudflare R2 before production traffic.
- Only ~20 colleges exist. Several official metrics (SAT average, net price, etc.) are legitimately absent from College Scorecard for some institutions and render as "Data unavailable" — this is expected, not a bug.
- UCLA's three campus tour-point coordinates are development placeholders (`unverified: true`) and must be checked before shipping.
- No automated tests yet.
