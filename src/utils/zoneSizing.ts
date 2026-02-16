// Zone Sizing Calculator
// Computes recommended minimum grid squares for each activity based on:
// - Volume data from Step 2D (peak_volume_per_shift)
// - Sizing assumptions from Step 2A (unit footprint, stacking, access factor)
// - Grid square size from Step 2A

import { Activity, VolumeTiming, GridSettings } from '../types';

export interface SizingRecommendation {
  activityId: string;
  activityName: string;
  activityType: string;
  peakVolume: number;
  floorAreaSqFt: number;
  recommendedSquares: number;
  squareSizeFt: number;
  unitFootprintSqFt: number;
  accessFactor: number;
  stackingHeight: number;
  effectiveSqFtPerUnit: number;
}

export function calculateZoneSizing(
  activities: Activity[],
  volumeTiming: VolumeTiming[],
  settings: GridSettings
): SizingRecommendation[] {
  const unitFootprint = settings.unitFootprintSqFt ?? 4;
  const stacking = settings.stackingHeight ?? 1;
  const access = settings.accessFactor ?? 1.3;
  const squareSize = settings.squareSize;
  const sqFtPerSquare = squareSize * squareSize;

  const effectiveSqFtPerUnit = (unitFootprint * access) / stacking;

  const recommendations: SizingRecommendation[] = [];

  for (const activity of activities) {
    if (activity.type !== 'staging-lane' && activity.type !== 'work-area') {
      continue;
    }

    const vt = volumeTiming.find(v => v.activity_id === activity.id);
    if (!vt || vt.peak_volume_per_shift <= 0) {
      continue;
    }

    const peakVolume = vt.peak_volume_per_shift;
    const floorAreaSqFt = peakVolume * effectiveSqFtPerUnit;
    const recommendedSquares = Math.ceil(floorAreaSqFt / sqFtPerSquare);

    recommendations.push({
      activityId: activity.id,
      activityName: activity.name,
      activityType: activity.type,
      peakVolume,
      floorAreaSqFt,
      recommendedSquares,
      squareSizeFt: squareSize,
      unitFootprintSqFt: unitFootprint,
      accessFactor: access,
      stackingHeight: stacking,
      effectiveSqFtPerUnit,
    });
  }

  return recommendations;
}
