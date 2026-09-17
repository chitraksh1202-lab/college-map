import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CollegePreview } from "@/lib/colleges";
import { formatOwnership, formatNumber } from "@/lib/format";
import { getDisplayName } from "@/lib/search";

type Props = {
  colleges: CollegePreview[];
  showCaliforniaShortcut?: boolean;
};

/**
 * Dev-only basemap style (CARTO Positron, unauthenticated, free for
 * development traffic). Before production scale, replace with a
 * self-hosted PMTiles style served from Cloudflare R2 per CLAUDE.md —
 * do not rely on a third-party hosted style for production traffic.
 */
const DEV_MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const US_BOUNDS: [[number, number], [number, number]] = [
  [-125, 24],
  [-66, 49],
];

const CALIFORNIA_BOUNDS: [[number, number], [number, number]] = [
  [-124.5, 32.4],
  [-114.0, 42.1],
];

/** Bounding box around the given colleges, with a small margin so edge points aren't clipped. */
function boundsFor(colleges: CollegePreview[]): [[number, number], [number, number]] {
  const lats = colleges.map((c) => c.latitude);
  const lons = colleges.map((c) => c.longitude);
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

export default function MapExplorer({ colleges, showCaliforniaShortcut = false }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [selected, setSelected] = useState<CollegePreview | null>(null);
  const collegesBySlug = useMemo(() => {
    const map = new Map<string, CollegePreview>();
    for (const college of colleges) map.set(college.slug, college);
    return map;
  }, [colleges]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const single = colleges.length === 1;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DEV_MAP_STYLE,
      ...(single
        ? { center: [colleges[0].longitude, colleges[0].latitude] as [number, number], zoom: 13 }
        : { bounds: colleges.length > 0 ? boundsFor(colleges) : US_BOUNDS, fitBoundsOptions: { padding: 32 } }),
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("colleges", {
        type: "geojson",
        data: collegesToGeoJSON(colleges),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "colleges",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0d74e0",
          "circle-radius": ["step", ["get", "point_count"], 18, 5, 22, 10, 28],
          "circle-opacity": 0.85,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
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
          "text-size": 13,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "colleges",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#ff7a45",
          "circle-radius": 9,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
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
            map.easeTo({ center: geometry.coordinates as [number, number], zoom });
          })
          .catch(() => {});
      });

      map.on("click", "unclustered-point", (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const slug = feature?.properties?.slug as string | undefined;
        if (!slug) return;
        const college = collegesBySlug.get(slug);
        if (college) setSelected(college);
      });

      for (const layer of ["clusters", "unclustered-point"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [collegesBySlug, colleges]);

  function flyToCalifornia() {
    mapRef.current?.fitBounds(CALIFORNIA_BOUNDS, { padding: 40, duration: 1200 });
  }

  return (
    <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden rounded-3xl border border-horizon-100 shadow-xl shadow-horizon-900/5 md:h-[75vh]">
      <div ref={mapContainerRef} className="h-full w-full" />

      {showCaliforniaShortcut && (
        <button
          type="button"
          onClick={flyToCalifornia}
          className="absolute left-4 top-4 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-horizon-800 shadow-md backdrop-blur transition hover:bg-white"
        >
          Explore California
        </button>
      )}

      {selected && (
        <>
          {/* Backdrop on mobile only, to make the sheet feel modal */}
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-10 bg-black/20 md:hidden"
          />
          <div className="fixed inset-x-0 bottom-0 z-20 rounded-t-3xl bg-white p-5 shadow-2xl md:absolute md:bottom-4 md:right-4 md:left-auto md:top-auto md:w-80 md:rounded-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-display text-lg font-semibold text-slate-900">
                  {getDisplayName(selected)}
                </h3>
                <p className="text-sm text-slate-500">
                  {selected.city}, {selected.stateCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-slate-400">Type</dt>
                <dd className="font-medium text-slate-700">
                  {formatOwnership(selected.ownership)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Enrollment</dt>
                <dd className="font-medium text-slate-700">
                  {formatNumber(selected.undergraduateEnrollment)}
                </dd>
              </div>
            </dl>

            <a
              href={`/college/${selected.slug}`}
              className="block w-full rounded-full bg-sunset-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-sunset-600"
            >
              Explore College
            </a>
          </div>
        </>
      )}
    </div>
  );
}
