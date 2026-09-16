import type { CuratedCollegeData } from "@/lib/types";
import { uclaCuratedData } from "@/data/curated/ucla";

const curatedByUnitId: Record<string, CuratedCollegeData> = {
  [uclaCuratedData.unitId]: uclaCuratedData,
};

export function getCuratedDataByUnitId(unitId: string): CuratedCollegeData | undefined {
  return curatedByUnitId[unitId];
}
