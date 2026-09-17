import type { CuratedCollegeData } from "@/lib/types";

/**
 * Curated data for UCLA.
 *
 * Tour-point coordinates were verified on 2026-09-17 against independent
 * authoritative sources — never guessed, never AI-generated, and not
 * scraped from Google Maps:
 *
 * - Royce Hall / Powell Library: building footprint centroids from
 *   OpenStreetMap, sourced there from LA County Assessor building records
 *   (`lacounty:bld_id` tag) — an open government-derived geographic
 *   dataset, not a Google product. Cross-checked against UCLA's own
 *   official pages: roycehall.org (UCLA's Center for the Art of
 *   Performance / Royce Hall venue site, https://roycehall.org/visit/directions/)
 *   independently links a place at (34.0728088, -118.4421592) — within
 *   ~10m of the OSM/LA-County footprint centroid used here — and
 *   library.ucla.edu's official Powell Library page
 *   (https://www.library.ucla.edu/visit/locations/powell-library/) confirms
 *   the address "10740 Dickson Plaza," matching this building's mapped
 *   location.
 * - Bruin Walk: it's a path, not a single building, so there is no postal
 *   address to verify against. The coordinate is the midpoint of
 *   OpenStreetMap's surveyed centerline for the way named "Bruin Walk"
 *   (the main east-west pedestrian promenade), consistent with UCLA
 *   Library's official description of Powell Library sitting "at the top
 *   of Bruinwalk" and other UCLA sources describing it as the
 *   thoroughfare running through Bruin Plaza.
 *
 * Raw lookups performed via OpenStreetMap's Overpass API
 * (https://overpass-api.de) — see conversation/session notes for the exact
 * queries and returned way IDs (422876632, 422876626, 128137518).
 *
 * Street View coverage at these exact points has not been visually
 * confirmed in this environment (no PUBLIC_GOOGLE_MAPS_EMBED_KEY is
 * configured here) — see README known-limitations. All three are on
 * heavily-trafficked, publicly accessible central-campus pedestrian
 * areas, so panorama coverage is likely, but that should be confirmed
 * once a real embed key is available rather than assumed.
 */
export const uclaCuratedData: CuratedCollegeData = {
  // 110662 = UCLA's real College Scorecard/IPEDS UNITID, confirmed live
  // against the Scorecard API (see scripts/import-college-scorecard.ts).
  unitId: "110662",
  featured: true,
  tourPoints: [
    {
      id: "ucla-royce-hall",
      name: "Royce Hall",
      description: "One of UCLA's original four buildings and its most recognizable landmark.",
      latitude: 34.0729044,
      longitude: -118.4421895,
      category: "landmark",
      source: "OpenStreetMap building footprint (LA County Assessor data), way 422876632",
    },
    {
      id: "ucla-powell-library",
      name: "Powell Library",
      description: "Historic undergraduate library facing Royce Quad.",
      latitude: 34.0715674,
      longitude: -118.4421788,
      category: "academic",
      source: "OpenStreetMap building footprint (LA County Assessor data, surveyed 2023-02-10), way 422876626",
    },
    {
      id: "ucla-bruin-walk",
      name: "Bruin Walk",
      description: "The main pedestrian path connecting campus to student housing and Westwood.",
      latitude: 34.0709847,
      longitude: -118.4447687,
      category: "student-life",
      source: "Midpoint of OpenStreetMap 'Bruin Walk' pedestrian way centerline, way 128137518",
    },
  ],
};
