import type { CuratedCollegeData } from "@/lib/types";

/**
 * Curated data for UCLA. Coordinates below are development placeholders
 * near the general UCLA campus area (unverified: true) and MUST be
 * checked against an authoritative source (e.g. official campus map)
 * before this college is marked production-ready.
 */
export const uclaCuratedData: CuratedCollegeData = {
  unitId: "TEST-000001",
  featured: true,
  tourPoints: [
    {
      id: "ucla-royce-hall",
      name: "Royce Hall",
      description: "One of UCLA's original four buildings and its most recognizable landmark.",
      latitude: 34.0736,
      longitude: -118.4429,
      category: "landmark",
      unverified: true,
    },
    {
      id: "ucla-powell-library",
      name: "Powell Library",
      description: "Historic undergraduate library facing Royce Quad.",
      latitude: 34.0722,
      longitude: -118.4425,
      category: "academic",
      unverified: true,
    },
    {
      id: "ucla-bruin-walk",
      name: "Bruin Walk",
      description: "The main pedestrian path connecting campus to student housing and Westwood.",
      latitude: 34.0709,
      longitude: -118.4441,
      category: "student-life",
      unverified: true,
    },
  ],
};
