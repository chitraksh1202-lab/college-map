import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CollegePreview } from "@/lib/colleges";
import { formatOwnership, formatNumber } from "@/lib/format";
import { getDisplayName } from "@/lib/search";
import { loadInstitutionPreviews } from "@/lib/client-data";
import { track } from "@/lib/analytics";
import SaveButton from "@/components/SaveButton";

type Props = {
  /** Page-scoped list (a state's, a country's, or a single college's own map) — small enough to embed directly. */
  colleges?: CollegePreview[];
  /**
   * Set on the homepage instead of `colleges`: fetches the full worldwide
   * dataset lazily instead of embedding ~24k institutions in the page.
   */
  dataUrl?: boolean;
  /**
   * World exploration mode (homepage): opens on a world view, shows the
   * World/US/Europe/Asia region pills, custom zoom/reset controls, and the
   * "N universities · N countries" info chip.
   */
  world?: boolean;
};

type Bounds = [[number, number], [number, number]];

/**
 * Dev-only basemap style (CARTO Positron, unauthenticated, free for
 * development traffic). Before production scale, replace with a
 * self-hosted PMTiles style served from Cloudflare R2 per CLAUDE.md —
 * do not rely on a third-party hosted style for production traffic.
 * The style is recoloured at load time (see `restyleBasemap`) so the map
 * sits inside our warm palette; no custom style hosting is needed yet.
 */
const DEV_MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const WORLD_BOUNDS: Bounds = [
  [-175, -56],
  [178, 75],
];
const CONUS_BOUNDS: Bounds = [
  [-125.5, 24.2],
  [-66.5, 49.6],
];
const EUROPE_BOUNDS: Bounds = [
  [-25, 34],
  [45, 71],
];
const ASIA_BOUNDS: Bounds = [
  [26, -11],
  [150, 55],
];
const MOBILE_US_VIEW = { center: [-97, 40.5] as [number, number], zoom: 2.7 };

const INK = "#241f19";
const SAND = "#fdfbf7";
const EMBER = "#d8602a";
const EMBER_DEEP = "#b84a1c";

/**
 * "Place Lens" — explore by the kind of life around a campus, not by
 * admissions stats. Deliberately built ONLY from a classification we
 * already derive honestly at import time: NCES's own urban-centric
 * locale codes, bucketed into `campusSetting` in
 * scripts/import-college-scorecard.ts (mapCampusSetting). No new data,
 * no invented per-college judgment calls.
 *
 * "Coast", "Mountains", and "Warm/Cold" were considered and deliberately
 * left out — there is no coastline/elevation/climate dataset in this
 * project, and approximating them from state alone would be inaccurate
 * (e.g. most of Texas isn't coastal) and effectively invented.
 *
 * Only US institutions currently have `campusSetting` (ROR doesn't
 * publish an equivalent), so a lens narrows the map to US colleges for
 * now — an honest reflection of "US = deeper data" rather than a bug.
 */
type PlaceLensId = "big-city" | "college-town" | "small-town";
const PLACE_LENSES: { id: PlaceLensId; label: string; setting: string }[] = [
  { id: "big-city", label: "Big City", setting: "urban" },
  { id: "college-town", label: "College Town", setting: "college-town" },
  { id: "small-town", label: "Small Town", setting: "rural" },
];

type RegionId = "world" | "us" | "europe" | "asia";
const REGIONS: { id: RegionId; label: string; bounds: Bounds }[] = [
  { id: "world", label: "World", bounds: WORLD_BOUNDS },
  { id: "us", label: "US", bounds: CONUS_BOUNDS },
  { id: "europe", label: "Europe", bounds: EUROPE_BOUNDS },
  { id: "asia", label: "Asia", bounds: ASIA_BOUNDS },
];

/**
 * Bounding box around the given colleges (state/country pages), with a
 * small margin. Points far outside the American longitude band (e.g. a
 * lone Guam or Pacific-territory institution) are excluded from the FIT
 * only — they still render as markers.
 */
function boundsFor(colleges: CollegePreview[]): Bounds {
  const framable = colleges.filter((c) => c.longitude >= -180 && c.longitude <= -60);
  const pool = framable.length > 0 ? framable : colleges;
  const lats = pool.map((c) => c.latitude);
  const lons = pool.map((c) => c.longitude);
  const margin = 0.5;
  return [
    [Math.min(...lons) - margin, Math.min(...lats) - margin],
    [Math.max(...lons) + margin, Math.max(...lats) + margin],
  ];
}

function collegesToGeoJSON(colleges: CollegePreview[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: colleges.map((college) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [college.longitude, college.latitude] },
      properties: { slug: college.slug },
    })),
  };
}

/**
 * Recolours the stock Positron layers into warm land / soft water / legible
 * state lines, and hides low-value noise. Every call is guarded so a
 * renamed upstream layer degrades to "unstyled", never to a crash.
 */
function restyleBasemap(map: maplibregl.Map) {
  const paint = (id: string, prop: string, value: unknown) => {
    if (map.getLayer(id)) map.setPaintProperty(id, prop, value);
  };
  const layout = (id: string, prop: string, value: unknown) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, prop, value);
  };
  const hide = (id: string) => layout(id, "visibility", "none");

  const zoomRange = (id: string, min: number, max: number) => {
    if (map.getLayer(id)) map.setLayerZoomRange(id, min, max);
  };

  // Land & water. CARTO's vector tiles carry no terrain / hillshade data, so
  // "texture" here comes from landcover and protected-area polygons only —
  // parks and forests are pulled down to national zoom to give the West its
  // green mass instead of a flat parchment sheet.
  paint("background", "background-color", "#efe4cf");
  paint("water", "fill-color", "#b9d0dc");
  paint("waterway", "line-color", "#aac5d1");
  paint("landcover", "fill-color", "#cdd5ad");
  paint("landcover", "fill-opacity", ["interpolate", ["linear"], ["zoom"], 3, 0.7, 8, 0.5, 12, 0.35]);
  for (const id of ["park_national_park", "park_nature_reserve", "landuse"]) {
    zoomRange(id, 3, 24);
    paint(id, "fill-color", "#c9d2a6");
    paint(id, "fill-opacity", ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 0.45, 12, 0.3]);
  }
  paint("landuse_residential", "fill-color", "#e8dcc5");

  // Boundaries: states/countries readable from the national view, counties only up close
  zoomRange("boundary_state", 2, 24);
  paint("boundary_state", "line-color", "#a08c6c");
  paint("boundary_state", "line-width", ["interpolate", ["linear"], ["zoom"], 3, 0.7, 6, 1.1, 10, 1.5]);
  paint("boundary_state", "line-opacity", 0.75);
  paint("boundary_country_inner", "line-color", "#85704f");
  paint("boundary_country_inner", "line-width", ["interpolate", ["linear"], ["zoom"], 1, 0.6, 3, 1, 8, 1.6]);
  paint("boundary_country_outline", "line-color", "#e6dcc8");
  layout("boundary_county", "visibility", "none");

  // Labels: state/country names visible from the national/world view, quiet and warm
  zoomRange("place_state", 3.2, 10);
  layout("place_state", "text-size", ["interpolate", ["linear"], ["zoom"], 3.2, 9.5, 5, 11.5, 7, 14]);
  layout("place_state", "text-letter-spacing", 0.12);
  paint("place_state", "text-color", "#7a6a55");
  paint("place_state", "text-halo-color", "#efe4cf");
  paint("place_state", "text-halo-width", 1.2);
  zoomRange("place_city_dot_r2", 3.6, 7);
  for (const id of ["place_city_r6", "place_city_r5", "place_city_dot_r7", "place_city_dot_r4", "place_city_dot_r2", "place_city_dot_z7", "place_capital_dot_z7", "place_town", "place_villages", "place_suburbs", "place_hamlet"]) {
    paint(id, "text-color", "#3f372e");
    paint(id, "icon-color", "#3f372e");
    paint(id, "text-halo-color", "rgba(250, 246, 238, 0.9)");
  }
  for (const id of ["watername_ocean", "watername_sea"]) {
    paint(id, "text-color", "#7d97a3");
    paint(id, "text-halo-color", "#cddfe6");
  }
  for (const id of ["watername_lake", "watername_lake_line", "waterway_label"]) {
    paint(id, "text-color", "#7d97a3");
    paint(id, "text-halo-color", "#f2eadb");
  }
  // World-level country labels ARE useful at world zoom (unlike national
  // mode, where they were noise) — shown quietly, hidden once state/city
  // labels take over.
  zoomRange("place_country_1", 1, 5);
  zoomRange("place_country_2", 1, 5);
  for (const id of ["place_country_1", "place_country_2"]) {
    paint(id, "text-color", "#6f5f47");
    paint(id, "text-halo-color", "#efe4cf");
    paint(id, "text-halo-width", 1.2);
  }
  for (const id of ["place_continent", "poi_stadium", "poi_park", "housenumber"]) {
    hide(id);
  }

  // Roads: quiet, warm greys instead of stark white-on-grey
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== "line") continue;
    const isRoad = /^(road|bridge|tunnel)_/.test(layer.id);
    if (!isRoad) continue;
    if (/_case/.test(layer.id) || /_path$/.test(layer.id) || /_rail/.test(layer.id) || layer.id === "rail") {
      paint(layer.id, "line-color", "#d9cfbd");
    } else {
      paint(layer.id, "line-color", "#faf5ec");
    }
  }
  for (const id of ["roadname_minor", "roadname_sec", "roadname_pri", "roadname_major"]) {
    paint(id, "text-color", "#6f6353");
    paint(id, "text-halo-color", "#f7f1e6");
  }
  paint("building", "fill-color", "#e4dac7");
  paint("building-top", "fill-color", "#ebe2d1");
  paint("building-top", "fill-outline-color", "#dccfb8");
}

export default function MapExplorer({ colleges, dataUrl = false, world = false }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapLoadedRef = useRef(false);
  const hasFitInitialRef = useRef(false);
  const [selected, setSelected] = useState<CollegePreview | null>(null);
  const [region, setRegion] = useState<RegionId>("world");
  const [fetchedColleges, setFetchedColleges] = useState<CollegePreview[] | null>(null);

  useEffect(() => {
    if (!dataUrl) return;
    let cancelled = false;
    loadInstitutionPreviews()
      .then((data) => {
        if (!cancelled) setFetchedColleges(data);
      })
      .catch(() => {
        // Map degrades to "no points yet" rather than crashing — search
        // and direct college/state/country URLs still work.
      });
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  const [activeLens, setActiveLens] = useState<PlaceLensId | null>(null);
  const rawPool = colleges ?? fetchedColleges ?? [];
  const activeLensSetting = activeLens ? PLACE_LENSES.find((l) => l.id === activeLens)?.setting : undefined;
  const pool = useMemo(
    () => (activeLensSetting ? rawPool.filter((c) => c.campusSetting === activeLensSetting) : rawPool),
    [rawPool, activeLensSetting]
  );
  const collegesBySlug = useMemo(() => {
    const map = new Map<string, CollegePreview>();
    for (const college of pool) map.set(college.slug, college);
    return map;
  }, [pool]);
  const countryCount = useMemo(() => new Set(pool.map((c) => c.countryCode)).size, [pool]);

  // --- Map creation: runs once. Does not depend on data being loaded yet,
  // so the map/basemap render immediately even while `dataUrl` is fetching. ---
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const narrow = mapContainerRef.current.clientWidth < 640;
    // `colleges` (as opposed to `dataUrl`) means the exact points are known
    // synchronously — a state/country page or a college's own location map
    // — so frame them immediately at construction time, with no flash of a
    // wrong default view before the async data-apply effect can correct it.
    const knownUpfront = colleges ?? [];
    const single = knownUpfront.length === 1;
    let initialView: Partial<maplibregl.MapOptions>;
    if (single) {
      initialView = { center: [knownUpfront[0].longitude, knownUpfront[0].latitude], zoom: 13 };
    } else if (knownUpfront.length > 0) {
      initialView = { bounds: boundsFor(knownUpfront), fitBoundsOptions: { padding: 40 } };
    } else if (world && narrow) {
      initialView = { center: MOBILE_US_VIEW.center, zoom: 1.4 };
    } else {
      initialView = { bounds: world ? WORLD_BOUNDS : CONUS_BOUNDS, fitBoundsOptions: { padding: world ? 16 : 40 } };
    }
    if (knownUpfront.length > 0) hasFitInitialRef.current = true;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DEV_MAP_STYLE,
      ...initialView,
      attributionControl: { compact: true },
      minZoom: world ? 1.2 : 2.2,
    });
    mapRef.current = map;

    map.on("load", () => {
      restyleBasemap(map);

      map.addSource("colleges", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 64,
        clusterMaxZoom: 12,
      });

      // Cluster size is driven by count with a wide spread (a 5-college
      // cluster is a quiet dot, a 250+ cluster is a landmark) and grows a
      // little as you zoom so regional views don't feel sparse.
      const byCount = (base: number, k: number): maplibregl.ExpressionSpecification => [
        "step",
        ["get", "point_count"],
        base * k,
        10,
        (base + 4) * k,
        30,
        (base + 8) * k,
        100,
        (base + 13) * k,
        500,
        (base + 20) * k,
        2000,
        (base + 28) * k,
      ];
      // Zoom must be the outer expression for MapLibre's paint validator.
      const clusterRadius = (base: number): maplibregl.ExpressionSpecification => [
        "interpolate",
        ["linear"],
        ["zoom"],
        1.5,
        byCount(base, 0.85),
        7,
        byCount(base, 1.25),
      ];
      const small: maplibregl.ExpressionSpecification = ["<", ["get", "point_count"], 10];

      // Soft outer halo, then a paper-coloured ring, then the ink disc.
      map.addLayer({
        id: "cluster-halo",
        type: "circle",
        source: "colleges",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": INK,
          "circle-radius": clusterRadius(18),
          "circle-opacity": ["case", small, 0.05, 0.11],
          "circle-blur": 0.6,
        },
      });
      map.addLayer({
        id: "cluster-ring",
        type: "circle",
        source: "colleges",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": SAND,
          "circle-radius": clusterRadius(13),
          "circle-opacity": ["case", small, 0.7, 0.9],
        },
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "colleges",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["case", small, "#3a332b", INK],
          "circle-radius": clusterRadius(9),
          "circle-opacity": ["case", small, 0.88, 1],
          "circle-stroke-width": ["case", small, 1, 1.5],
          "circle-stroke-color": SAND,
        },
      });
      map.addLayer({
        id: "cluster-hover",
        type: "circle",
        source: "colleges",
        filter: ["==", ["get", "cluster_id"], -1],
        paint: {
          "circle-color": "transparent",
          "circle-radius": clusterRadius(13),
          "circle-stroke-width": 2,
          "circle-stroke-color": EMBER,
          "circle-stroke-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "colleges",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Open Sans Bold", "Noto Sans Regular"],
          "text-size": ["step", ["get", "point_count"], 10, 10, 11.5, 30, 12.5, 100, 14, 500, 15, 2000, 16],
          "text-allow-overlap": true,
        },
        paint: { "text-color": SAND },
      });

      // Selection treatment: wide soft glow + crisp ember ring under the dot.
      map.addLayer({
        id: "selected-glow",
        type: "circle",
        source: "colleges",
        filter: ["==", ["get", "slug"], ""],
        paint: {
          "circle-color": EMBER,
          "circle-radius": 22,
          "circle-opacity": 0.16,
          "circle-blur": 0.6,
        },
      });
      map.addLayer({
        id: "selected-ring",
        type: "circle",
        source: "colleges",
        filter: ["==", ["get", "slug"], ""],
        paint: {
          "circle-color": SAND,
          "circle-radius": 13,
          "circle-stroke-width": 2,
          "circle-stroke-color": EMBER,
        },
      });
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "colleges",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": EMBER,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1.5, 2, 7, 5, 12, 7.5],
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 1.5, 0.6, 7, 1.5],
          "circle-stroke-color": SAND,
        },
      });
      map.addLayer({
        id: "point-hover",
        type: "circle",
        source: "colleges",
        filter: ["==", ["get", "slug"], ""],
        paint: {
          "circle-color": EMBER_DEEP,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 6, 7, 7.5, 12, 9.5],
          "circle-stroke-width": 2,
          "circle-stroke-color": SAND,
        },
      });

      map.on("click", "clusters", (event: MapLayerMouseEvent) => {
        const features = map.queryRenderedFeatures(event.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource("colleges") as GeoJSONSource | undefined;
        if (clusterId === undefined || !source) return;
        source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            const geometry = features[0]?.geometry;
            if (geometry?.type !== "Point") return;
            map.easeTo({
              center: geometry.coordinates as [number, number],
              zoom: Math.min(zoom + 0.3, 14),
              duration: 650,
              easing: (t) => 1 - Math.pow(1 - t, 3),
            });
          })
          .catch(() => {});
      });

      map.on("click", "unclustered-point", (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const slug = feature?.properties?.slug as string | undefined;
        if (!slug) return;
        const college = collegesBySlugRef.current.get(slug);
        if (!college) return;
        setSelected(college);
        map.setFilter("selected-glow", ["==", ["get", "slug"], slug]);
        map.setFilter("selected-ring", ["==", ["get", "slug"], slug]);
        const desktop = map.getContainer().clientWidth >= 768;
        map.easeTo({
          center: [college.longitude, college.latitude],
          // On desktop the preview sits bottom-right, so nudge the pin left/up of centre.
          offset: desktop ? [140, 60] : [0, -90],
          zoom: Math.max(map.getZoom(), 5.5),
          duration: 550,
          easing: (t) => 1 - Math.pow(1 - t, 3),
        });
      });

      map.on("mousemove", "clusters", (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.cluster_id;
        map.getCanvas().style.cursor = "pointer";
        map.setFilter("cluster-hover", ["==", ["get", "cluster_id"], id ?? -1]);
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
        map.setFilter("cluster-hover", ["==", ["get", "cluster_id"], -1]);
      });
      map.on("mousemove", "unclustered-point", (event: MapLayerMouseEvent) => {
        const slug = event.features?.[0]?.properties?.slug ?? "";
        map.getCanvas().style.cursor = "pointer";
        map.setFilter("point-hover", ["==", ["get", "slug"], slug]);
      });
      map.on("mouseleave", "unclustered-point", () => {
        map.getCanvas().style.cursor = "";
        map.setFilter("point-hover", ["==", ["get", "slug"], ""]);
      });

      mapLoadedRef.current = true;
      applyPendingData();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      hasFitInitialRef.current = false;
    };
  }, [world]);

  // Ref mirror of collegesBySlug so the click handler (registered once,
  // above) always sees the latest data without re-registering listeners.
  const collegesBySlugRef = useRef(collegesBySlug);
  collegesBySlugRef.current = collegesBySlug;

  const applyPendingDataRef = useRef<() => void>(() => {});
  applyPendingDataRef.current = () => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const source = map.getSource("colleges") as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(collegesToGeoJSON(pool));

    // Single-college pages (a college's own location map) centre & zoom in
    // directly; everything else fits to the data once, the first time it
    // arrives, and never again (so panning/zooming isn't fought later).
    if (!hasFitInitialRef.current && pool.length > 0) {
      hasFitInitialRef.current = true;
      if (pool.length === 1) {
        map.jumpTo({ center: [pool[0].longitude, pool[0].latitude], zoom: 13 });
      } else if (!world) {
        map.fitBounds(boundsFor(pool), { padding: 40 });
      }
      // world mode keeps its initial world/CONUS-mobile view — the data
      // arriving shouldn't yank the camera away from what the visitor
      // already sees.
    }
  };
  function applyPendingData() {
    applyPendingDataRef.current();
  }

  useEffect(() => {
    applyPendingDataRef.current();
  }, [pool]);

  function goToRegion(id: RegionId) {
    const target = REGIONS.find((r) => r.id === id);
    if (!target) return;
    setRegion(id);
    closePreview();
    const map = mapRef.current;
    if (!map) return;
    const easing = (t: number) => 1 - Math.pow(1 - t, 3);
    if (id === "us" && map.getContainer().clientWidth < 640) {
      map.easeTo({ ...MOBILE_US_VIEW, duration: 1100, easing });
      return;
    }
    map.fitBounds(target.bounds, { padding: 24, duration: 1100, easing });
  }

  function zoomBy(delta: number) {
    mapRef.current?.easeTo({ zoom: (mapRef.current.getZoom() ?? 3) + delta, duration: 300 });
  }

  function closePreview() {
    setSelected(null);
    mapRef.current?.setFilter("selected-glow", ["==", ["get", "slug"], ""]);
    mapRef.current?.setFilter("selected-ring", ["==", ["get", "slug"], ""]);
  }

  const controlButton =
    "flex h-10 w-10 items-center justify-center text-ink-800 transition hover:bg-sand-100 active:scale-95 disabled:opacity-40";

  return (
    <div
      className={`map-shell relative w-full overflow-hidden border border-stone-200 bg-[#f2eadb] shadow-lift ${
        world
          ? "h-[70vh] min-h-[460px] rounded-[22px] md:h-[calc(100vh-9.5rem)] md:min-h-[600px] md:rounded-[30px]"
          : "h-[72vh] min-h-[440px] rounded-[28px] md:h-[78vh]"
      }`}
    >
      <div ref={mapContainerRef} className="h-full w-full" />
      {/* Soft paper vignette so the canvas reads as an editorial map, not a widget */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[3] rounded-[inherit] shadow-[inset_0_0_90px_rgba(84,64,32,0.14)]"
      />

      {/* Custom zoom controls */}
      <div className="absolute right-3 top-3 z-[5] flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-sand-50/95 shadow-soft backdrop-blur md:right-4 md:top-4">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in" className={controlButton}>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 4v12M4 10h12" />
          </svg>
        </button>
        <span className="h-px bg-stone-200" aria-hidden="true" />
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out" className={controlButton}>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 10h12" />
          </svg>
        </button>
        {world && (
          <>
            <span className="h-px bg-stone-200" aria-hidden="true" />
            <button type="button" onClick={() => goToRegion("world")} aria-label="Reset to world view" title="Reset view" className={controlButton}>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 10a6 6 0 1 1-1.8-4.3" />
                <path d="M16 3v4h-4" />
              </svg>
            </button>
          </>
        )}
      </div>

      {world && (
        <div
          role="group"
          aria-label="Jump to region"
          className="absolute left-3 top-3 z-[5] flex items-center gap-0.5 rounded-full border border-stone-200 bg-sand-50/95 p-1 shadow-soft backdrop-blur md:left-4 md:top-4"
        >
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => goToRegion(r.id)}
              aria-pressed={region === r.id}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-sand-100 aria-pressed:bg-ink-900 aria-pressed:text-sand-50 md:text-[0.8rem]"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {world && (
        <div className="absolute left-3 top-14 z-[5] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 md:left-4 md:top-16">
          {PLACE_LENSES.map((lens) => {
            const isActive = activeLens === lens.id;
            return (
              <button
                key={lens.id}
                type="button"
                onClick={() => {
                  const next = isActive ? null : lens.id;
                  setActiveLens(next);
                  if (next) track("place_lens_selected", { lens: next });
                }}
                aria-pressed={isActive}
                className="rounded-full border border-stone-200 bg-sand-50/95 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-soft backdrop-blur transition hover:bg-sand-100 aria-pressed:border-ember-400 aria-pressed:bg-ember-50 aria-pressed:text-ember-700 md:text-[0.8rem]"
              >
                {lens.label}
              </button>
            );
          })}
          {activeLens && (
            <button
              type="button"
              onClick={() => setActiveLens(null)}
              className="rounded-full bg-ink-900/90 px-2.5 py-1.5 text-xs font-semibold text-sand-50 shadow-soft backdrop-blur transition hover:bg-ink-900"
              aria-label="Clear place lens"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {world && !selected && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[5] hidden rounded-2xl border border-stone-200 bg-sand-50/95 px-4 py-3 shadow-soft backdrop-blur md:bottom-5 md:left-5 md:block">
          <p className="font-display text-[0.95rem] font-semibold text-ink-900">
            {pool.length > 0
              ? `${formatNumber(pool.length)} ${activeLens ? "colleges" : "universities"} · ${countryCount} ${countryCount === 1 ? "country" : "countries"}`
              : "Loading universities…"}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {activeLens
              ? "Based on official US campus-setting data."
              : "Zoom in, click a dot, find your place."}
          </p>
        </div>
      )}

      {selected && (
        <>
          {/* Backdrop on mobile only, to make the sheet feel modal */}
          <button
            type="button"
            aria-label="Close preview"
            onClick={closePreview}
            className="fixed inset-0 z-10 bg-ink-900/25 md:hidden"
          />
          <div className="animate-rise-in fixed inset-x-0 bottom-0 z-20 rounded-t-[28px] bg-sand-50 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl md:absolute md:bottom-5 md:right-5 md:left-auto md:top-auto md:w-[22rem] md:rounded-3xl md:border md:border-stone-200 md:pb-5 md:shadow-lift">
            <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-stone-300 md:hidden" aria-hidden="true" />
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-display text-xl font-semibold leading-tight text-ink-900">
                  {getDisplayName(selected)}
                </h3>
                <p className="mt-1 text-sm text-ink-500">
                  {selected.city}, {selected.stateCode ?? selected.countryName}
                </p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                aria-label="Close"
                className="shrink-0 rounded-full p-1.5 text-ink-500 transition hover:bg-stone-200/70 hover:text-ink-900"
              >
                ✕
              </button>
            </div>

            <div className="mb-5 flex flex-wrap gap-2 text-xs font-medium text-ink-700">
              <span className="rounded-full bg-sand-100 px-3 py-1.5">
                {selected.ownership ? formatOwnership(selected.ownership) : selected.countryName}
              </span>
              {selected.undergraduateEnrollment !== undefined && (
                <span className="rounded-full bg-sand-100 px-3 py-1.5">
                  Undergrad: {formatNumber(selected.undergraduateEnrollment)}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <a
                href={`/college/${selected.slug}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ember-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-ember-600 active:scale-[0.98]"
              >
                Explore college
                <span aria-hidden="true">→</span>
              </a>
              <SaveButton
                key={selected.unitId}
                unitId={selected.unitId}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-3 text-sm font-semibold text-ink-900 ring-1 ring-inset ring-stone-200 transition hover:bg-sand-100 active:scale-95 aria-pressed:bg-ink-900 aria-pressed:text-sand-50 aria-pressed:ring-ink-900"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
