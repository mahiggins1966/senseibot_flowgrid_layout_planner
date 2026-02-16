// Zone Sizing Calculator
// Computes recommended minimum grid squares for each activity based on:
// - Unit counts from Step 2D (peak_units_on_floor)
// - Sizing assumptions from Step 2A (unit footprint, stacking, access factor)
// - Grid square size from Step 2A
//
// Formula: recommendedSquares = ceil(peakUnits × unitFootprint × accessFactor ÷ stackingHeight ÷ squareSize²)

import { Activity, VolumeTiming, GridSettings } from '../types';

export interface SizingRecommendation {
  activityId: string;
  activityName: string;
  activityType: string;
  peakUnits: number;
  floorAreaSqFt: number;
  recommendedSquares: number;
  squareSizeFt: number;
  unitFootprintSqFt: number;
  accessFactor: number;
  stackingHeight: number;
  effectiveSqFtPerUnit: number;
  // Keep for backward compat
  peakVolume: number;
}

export function calculateZoneSizing(
  activities: Activity[],
  volumeTiming: VolumeTiming[],
  settings: GridSettings
): SizingRecommendation[] {
  const unitFootprint = settings.unitFootprintSqFt ?? 13.3; // Default: standard pallet
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
    if (!vt) continue;

    // Use peak units on floor (the dimensional count), not weight-based volume
    const peakUnits = vt.peak_units_on_floor ?? 0;
    if (peakUnits <= 0) continue;

    const floorAreaSqFt = peakUnits * effectiveSqFtPerUnit;
    const recommendedSquares = Math.ceil(floorAreaSqFt / sqFtPerSquare);

    recommendations.push({
      activityId: activity.id,
      activityName: activity.name,
      activityType: activity.type,
      peakUnits,
      peakVolume: peakUnits, // backward compat alias
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
