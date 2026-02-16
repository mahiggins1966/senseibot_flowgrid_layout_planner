import { useMemo } from 'react';
import { useGridStore } from '../store/gridStore';
import { calculateZoneSizing } from '../utils/zoneSizing';
import { UNIT_FOOTPRINT_OPTIONS } from '../types';

export function VolumeSummaryPanel() {
  const { activities, volumeTiming, settings } = useGridStore();

  const stagingLanes = activities.filter((a) => a.type === 'staging-lane');

  const getFloorUnitLabel = () => {
    const flowUnit = settings.typicalFlowUnit || 'pallet';
    const option = UNIT_FOOTPRINT_OPTIONS.find(o => o.value === flowUnit);
    if (flowUnit === 'custom') return 'Units';
    if (option) return option.value.charAt(0).toUpperCase() + option.value.slice(1) + 's';
    return 'Units';
  };

  const floorUnitLabel = getFloorUnitLabel();
  const floorUnitSingular = floorUnitLabel.replace(/s$/, '');

  // Throughput unit — derived from measurement system
  const throughputUnit = settings.measurementSystem === 'Metric' ? 'Kg' : 'Lbs';

  const totals = useMemo(() => {
    let typicalVolume = 0, peakVolume = 0, typicalUnits = 0, peakUnits = 0;
    stagingLanes.forEach(lane => {
      const vt = volumeTiming.find(v => v.activity_id === lane.id);
      if (vt) {
        typicalVolume += vt.typical_volume_per_shift;
        peakVolume += vt.peak_volume_per_shift;
        typicalUnits += vt.typical_units_on_floor || 0;
        peakUnits += vt.peak_units_on_floor || 0;
      }
    });
    return { typicalVolume, peakVolume, typicalUnits, peakUnits };
  }, [stagingLanes, volumeTiming]);

  const highestDest = useMemo(() => {
    if (stagingLanes.length === 0) return null;
    let highest = stagingLanes[0];
    let highestVol = 0;
    stagingLanes.forEach(lane => {
      const vt = volumeTiming.find(v => v.activity_id === lane.id);
      const vol = vt?.typical_volume_per_shift || 0;
      if (vol > highestVol) { highest = lane; highestVol = vol; }
    });
    return highestVol > 0 ? { name: highest.name, pct: ((highestVol / totals.typicalVolume) * 100).toFixed(1) } : null;
  }, [stagingLanes, volumeTiming, totals.typicalVolume]);

  const earliestDep = useMemo(() => {
    const withTime = stagingLanes.filter(l => l.departure_time);
    if (withTime.length === 0) return null;
    withTime.sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || ''));
    return withTime[0];
  }, [stagingLanes]);

  const recommendations = useMemo(() => {
    return calculateZoneSizing(activities, volumeTiming, settings);
  }, [activities, volumeTiming, settings]);

  if (stagingLanes.length === 0) return null;

  return (
    <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="p-4 space-y-4">
        {/* Sizing Recommendations */}
        {totals.peakUnits > 0 && settings.unitFootprintSqFt && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Recommended Zone Sizes</h3>
            <p className="text-xs text-gray-500 mb-3">
              Peak {floorUnitLabel.toLowerCase()} × {settings.unitFootprintSqFt} sq ft × {settings.accessFactor ?? 1.3}x access
              {(settings.stackingHeight ?? 1) > 1 ? ` ÷ ${settings.stackingHeight}-high` : ''}
            </p>
            <div className="space-y-2">
              {recommendations.map(rec => (
                <div key={rec.activityId} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="font-medium text-amber-900 text-sm">{rec.activityName}</div>
                  <div className="text-xs text-amber-700 mt-1">
                    {rec.peakUnits} peak {floorUnitLabel.toLowerCase()}
                  </div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-lg font-bold text-amber-900">{rec.recommendedSquares}</span>
                    <span className="text-xs text-amber-700">squares ({Math.round(rec.floorAreaSqFt)} sq ft)</span>
                  </div>
                </div>
              ))}
              {recommendations.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                  Enter peak {floorUnitLabel.toLowerCase()} on floor to see recommendations.
                </p>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 italic">
              Recommendations only — adjust in Step 2F.
            </p>
          </div>
        )}

        {/* Summary Stats */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Daily Summary</h3>
          <div className="space-y-2.5">
            <div>
              <div className="text-xs text-gray-500">Typical day</div>
              <div className="text-sm font-semibold text-gray-900">
                {totals.typicalVolume.toLocaleString()} {throughputUnit.toLowerCase()}
              </div>
              {totals.typicalUnits > 0 && (
                <div className="text-xs text-blue-600 font-medium">
                  {totals.typicalUnits.toLocaleString()} {floorUnitLabel.toLowerCase()} on floor
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500">Peak day</div>
              <div className="text-sm font-semibold text-gray-900">
                {totals.peakVolume.toLocaleString()} {throughputUnit.toLowerCase()}
              </div>
              {totals.peakUnits > 0 && (
                <div className="text-xs text-blue-600 font-medium">
                  {totals.peakUnits.toLocaleString()} {floorUnitLabel.toLowerCase()} on floor
                </div>
              )}
            </div>
            {highestDest && (
              <div>
                <div className="text-xs text-gray-500">Highest volume</div>
                <div className="text-sm font-semibold text-gray-900">
                  {highestDest.name} ({highestDest.pct}%)
                </div>
              </div>
            )}
            {earliestDep && (
              <div>
                <div className="text-xs text-gray-500">First departure</div>
                <div className="text-sm font-semibold text-gray-900">
                  {earliestDep.name} ({earliestDep.departure_time})
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
