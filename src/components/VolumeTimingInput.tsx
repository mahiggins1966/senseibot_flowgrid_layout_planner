import { useState, useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { calculateZoneSizing } from '../utils/zoneSizing';

export function VolumeTimingInput() {
  const { activities, volumeTiming, updateVolumeTiming, settings, loadVolumeTiming } = useGridStore();

  const stagingLanes = activities.filter((a) => a.type === 'staging-lane');
  const workActivities = activities.filter((a) => a.type !== 'staging-lane');

  const [editingValues, setEditingValues] = useState<Record<string, {
    typicalPrimary: string;
    peakPrimary: string;
    typicalSecondary: string;
    peakSecondary: string;
  }>>({});

  useEffect(() => {
    loadVolumeTiming();
  }, [loadVolumeTiming]);

  const totalTypicalVolume = stagingLanes.reduce((sum, lane) => {
    const vt = volumeTiming.find((v) => v.activity_id === lane.id);
    return sum + (vt ? vt.typical_volume_per_shift : 0);
  }, 0);

  const totalPeakVolume = stagingLanes.reduce((sum, lane) => {
    const vt = volumeTiming.find((v) => v.activity_id === lane.id);
    return sum + (vt ? vt.peak_volume_per_shift : 0);
  }, 0);

  const totalTypicalSecondaryVolume = stagingLanes.reduce((sum, lane) => {
    const vt = volumeTiming.find((v) => v.activity_id === lane.id);
    return sum + (vt?.typical_secondary_volume_per_shift || 0);
  }, 0);

  const totalPeakSecondaryVolume = stagingLanes.reduce((sum, lane) => {
    const vt = volumeTiming.find((v) => v.activity_id === lane.id);
    return sum + (vt?.peak_secondary_volume_per_shift || 0);
  }, 0);

  const getPrimaryUnitLabel = () => {
    if (!settings.primaryFlowUnit) return 'Items';
    if (settings.primaryFlowUnit === 'custom' && settings.primaryFlowUnitCustom) {
      return settings.primaryFlowUnitCustom.charAt(0).toUpperCase() + settings.primaryFlowUnitCustom.slice(1);
    }
    const unitMap: Record<string, string> = {
      lbs: 'Lbs',
      kg: 'Kg',
      pallets: 'Pallets',
      units: 'Units',
      orders: 'Orders',
      cases: 'Cases',
      containers: 'Containers',
    };
    return unitMap[settings.primaryFlowUnit] || 'Items';
  };

  const primaryUnit = getPrimaryUnitLabel();

  const getSecondaryUnitLabel = () => {
    if (!settings.secondaryFlowUnit) return '';
    if (settings.secondaryFlowUnit === 'custom' && settings.secondaryFlowUnitCustom) {
      return settings.secondaryFlowUnitCustom.charAt(0).toUpperCase() + settings.secondaryFlowUnitCustom.slice(1);
    }
    const unitMap: Record<string, string> = {
      lbs: 'Lbs',
      kg: 'Kg',
      pallets: 'Pallets',
      units: 'Units',
      orders: 'Orders',
      cases: 'Cases',
      containers: 'Containers',
    };
    return unitMap[settings.secondaryFlowUnit] || '';
  };

  const secondaryUnit = getSecondaryUnitLabel();
  const hasSecondaryUnit = !!settings.secondaryFlowUnit;

  const getTypicalVolumeForActivity = (activityId: string) => {
    const vt = volumeTiming.find((v) => v.activity_id === activityId);
    return vt ? vt.typical_volume_per_shift : 0;
  };

  const getPeakVolumeForActivity = (activityId: string) => {
    const vt = volumeTiming.find((v) => v.activity_id === activityId);
    return vt ? vt.peak_volume_per_shift : 0;
  };

  const getTypicalSecondaryVolumeForActivity = (activityId: string) => {
    const vt = volumeTiming.find((v) => v.activity_id === activityId);
    return vt?.typical_secondary_volume_per_shift || 0;
  };

  const getPeakSecondaryVolumeForActivity = (activityId: string) => {
    const vt = volumeTiming.find((v) => v.activity_id === activityId);
    return vt?.peak_secondary_volume_per_shift || 0;
  };

  const calculatePeakFactor = (typical: number, peak: number) => {
    if (typical === 0) return 0;
    return peak / typical;
  };

  const calculateFullLoads = (volume: number) => {
    if (!settings.largestVehicleCapacity || settings.largestVehicleCapacity <= 0) return null;
    const fullLoads = Math.ceil(volume / settings.largestVehicleCapacity);
    const percentCapacity = ((volume % settings.largestVehicleCapacity) / settings.largestVehicleCapacity * 100).toFixed(0);
    return { fullLoads, percentCapacity, lastLoadPercent: volume % settings.largestVehicleCapacity };
  };

  const getPercentageForActivity = (activityId: string) => {
    if (totalTypicalVolume === 0) return 0;
    const volume = getTypicalVolumeForActivity(activityId);
    return ((volume / totalTypicalVolume) * 100).toFixed(1);
  };

  const getHighestVolumeDestination = () => {
    if (stagingLanes.length === 0) return null;

    let highest = stagingLanes[0];
    let highestVolume = getTypicalVolumeForActivity(highest.id);

    stagingLanes.forEach((lane) => {
      const volume = getTypicalVolumeForActivity(lane.id);
      if (volume > highestVolume) {
        highest = lane;
        highestVolume = volume;
      }
    });

    return highestVolume > 0 ? highest : null;
  };

  const getEarliestDeparture = () => {
    const lanesWithTime = stagingLanes.filter((lane) => lane.departure_time);
    if (lanesWithTime.length === 0) return null;

    lanesWithTime.sort((a, b) => {
      if (!a.departure_time || !b.departure_time) return 0;
      return a.departure_time.localeCompare(b.departure_time);
    });

    return lanesWithTime[0];
  };

  const highestDest = getHighestVolumeDestination();
  const earliestDep = getEarliestDeparture();

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-medium mb-2">How much material goes through each activity?</p>
        <p>
          Enter the typical volume for each destination and when things need to leave. This data
          tells the tool which areas need the most space and which need to be closest to the doors.
        </p>
      </div>

      {stagingLanes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white border border-gray-300 rounded-lg">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300">
                  Destination
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300">
                  Typical {primaryUnit}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300">
                  Peak {primaryUnit}
                </th>
                {hasSecondaryUnit && (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300">
                      Typical {secondaryUnit}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300">
                      Peak {secondaryUnit}
                    </th>
                  </>
                )}
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300">
                  Percentage
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300">
                  Departure Time
                </th>
              </tr>
            </thead>
            <tbody>
              {stagingLanes.map((lane, index) => {
                const typicalVolume = getTypicalVolumeForActivity(lane.id);
                const peakVolume = getPeakVolumeForActivity(lane.id);
                const typicalSecondaryVolume = getTypicalSecondaryVolumeForActivity(lane.id);
                const peakSecondaryVolume = getPeakSecondaryVolumeForActivity(lane.id);
                const percentage = getPercentageForActivity(lane.id);
                const peakFactor = calculatePeakFactor(typicalVolume, peakVolume);
                const fullLoadsCalc = calculateFullLoads(peakVolume);

                let peakFactorColor = 'text-gray-700';
                let peakFactorNote = '';
                if (peakFactor > 2.0) {
                  peakFactorColor = 'text-red-600';
                  peakFactorNote = 'Very high variability — overflow area recommended';
                } else if (peakFactor > 1.5) {
                  peakFactorColor = 'text-orange-600';
                  peakFactorNote = 'High variability — consider extra buffer space';
                }

                return (
                  <>
                    <tr key={lane.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                          {lane.color && (
                            <div
                              className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                              style={{ backgroundColor: lane.color }}
                            />
                          )}
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{lane.name}</div>
                            {lane.destination_code && (
                              <div className="text-xs text-gray-500">Code: {lane.destination_code}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b border-gray-200">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingValues[lane.id]?.typicalPrimary ?? typicalVolume.toString()}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            const parts = value.split('.');
                            const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                            setEditingValues({
                              ...editingValues,
                              [lane.id]: {
                                typicalPrimary: sanitized,
                                peakPrimary: editingValues[lane.id]?.peakPrimary ?? peakVolume.toString(),
                                typicalSecondary: editingValues[lane.id]?.typicalSecondary ?? typicalSecondaryVolume.toString(),
                                peakSecondary: editingValues[lane.id]?.peakSecondary ?? peakSecondaryVolume.toString(),
                              },
                            });
                          }}
                          onBlur={async (e) => {
                            const value = e.target.value;
                            const newTypicalVolume = value === '' ? 0 : parseFloat(value);
                            if (!isNaN(newTypicalVolume)) {
                              await updateVolumeTiming(
                                lane.id,
                                newTypicalVolume,
                                peakVolume,
                                hasSecondaryUnit ? typicalSecondaryVolume : undefined,
                                hasSecondaryUnit ? peakSecondaryVolume : undefined
                              );
                            }
                            const newEditingValues = { ...editingValues };
                            delete newEditingValues[lane.id];
                            setEditingValues(newEditingValues);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 border-b border-gray-200">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingValues[lane.id]?.peakPrimary ?? peakVolume.toString()}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            const parts = value.split('.');
                            const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                            setEditingValues({
                              ...editingValues,
                              [lane.id]: {
                                typicalPrimary: editingValues[lane.id]?.typicalPrimary ?? typicalVolume.toString(),
                                peakPrimary: sanitized,
                                typicalSecondary: editingValues[lane.id]?.typicalSecondary ?? typicalSecondaryVolume.toString(),
                                peakSecondary: editingValues[lane.id]?.peakSecondary ?? peakSecondaryVolume.toString(),
                              },
                            });
                          }}
                          onBlur={async (e) => {
                            const value = e.target.value;
                            const newPeakVolume = value === '' ? 0 : parseFloat(value);
                            if (!isNaN(newPeakVolume)) {
                              await updateVolumeTiming(
                                lane.id,
                                typicalVolume,
                                newPeakVolume,
                                hasSecondaryUnit ? typicalSecondaryVolume : undefined,
                                hasSecondaryUnit ? peakSecondaryVolume : undefined
                              );
                            }
                            const newEditingValues = { ...editingValues };
                            delete newEditingValues[lane.id];
                            setEditingValues(newEditingValues);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                      </td>
                      {hasSecondaryUnit && (
                        <>
                          <td className="px-4 py-3 border-b border-gray-200">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editingValues[lane.id]?.typicalSecondary ?? typicalSecondaryVolume.toString()}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                const parts = value.split('.');
                                const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                                setEditingValues({
                                  ...editingValues,
                                  [lane.id]: {
                                    typicalPrimary: editingValues[lane.id]?.typicalPrimary ?? typicalVolume.toString(),
                                    peakPrimary: editingValues[lane.id]?.peakPrimary ?? peakVolume.toString(),
                                    typicalSecondary: sanitized,
                                    peakSecondary: editingValues[lane.id]?.peakSecondary ?? peakSecondaryVolume.toString(),
                                  },
                                });
                              }}
                              onBlur={async (e) => {
                                const value = e.target.value;
                                const newTypicalSecondaryVolume = value === '' ? 0 : parseFloat(value);
                                if (!isNaN(newTypicalSecondaryVolume)) {
                                  await updateVolumeTiming(
                                    lane.id,
                                    typicalVolume,
                                    peakVolume,
                                    newTypicalSecondaryVolume,
                                    peakSecondaryVolume
                                  );
                                }
                                const newEditingValues = { ...editingValues };
                                delete newEditingValues[lane.id];
                                setEditingValues(newEditingValues);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-3 border-b border-gray-200">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editingValues[lane.id]?.peakSecondary ?? peakSecondaryVolume.toString()}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                const parts = value.split('.');
                                const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                                setEditingValues({
                                  ...editingValues,
                                  [lane.id]: {
                                    typicalPrimary: editingValues[lane.id]?.typicalPrimary ?? typicalVolume.toString(),
                                    peakPrimary: editingValues[lane.id]?.peakPrimary ?? peakVolume.toString(),
                                    typicalSecondary: editingValues[lane.id]?.typicalSecondary ?? typicalSecondaryVolume.toString(),
                                    peakSecondary: sanitized,
                                  },
                                });
                              }}
                              onBlur={async (e) => {
                                const value = e.target.value;
                                const newPeakSecondaryVolume = value === '' ? 0 : parseFloat(value);
                                if (!isNaN(newPeakSecondaryVolume)) {
                                  await updateVolumeTiming(
                                    lane.id,
                                    typicalVolume,
                                    peakVolume,
                                    typicalSecondaryVolume,
                                    newPeakSecondaryVolume
                                  );
                                }
                                const newEditingValues = { ...editingValues };
                                delete newEditingValues[lane.id];
                                setEditingValues(newEditingValues);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                            />
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 border-b border-gray-200">
                        <div className="text-sm text-gray-900 font-medium">{percentage}%</div>
                      </td>
                      <td className="px-4 py-3 border-b border-gray-200">
                        <div className="text-sm text-gray-700">{lane.departure_time || '—'}</div>
                      </td>
                    </tr>
                    {peakFactor > 0 && (
                      <tr key={`${lane.id}-factor`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td colSpan={hasSecondaryUnit ? 7 : 5} className="px-4 py-2 border-b border-gray-200">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`font-semibold ${peakFactorColor}`}>
                              Peak Factor: {peakFactor.toFixed(1)}x
                            </span>
                            {peakFactorNote && (
                              <span className={peakFactorColor}>— {peakFactorNote}</span>
                            )}
                            {fullLoadsCalc && (
                              <span className="text-gray-600 ml-4">
                                ({fullLoadsCalc.fullLoads} full load{fullLoadsCalc.fullLoads !== 1 ? 's' : ''} at peak)
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              <tr className="bg-gray-100 border-t-2 border-gray-400">
                <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">
                  {totalTypicalVolume.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">
                  {totalPeakVolume.toLocaleString()}
                </td>
                {hasSecondaryUnit && (
                  <>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      {totalTypicalSecondaryVolume.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      {totalPeakSecondaryVolume.toLocaleString()}
                    </td>
                  </>
                )}
                <td className="px-4 py-3 text-sm font-bold text-gray-900">100%</td>
                <td className="px-4 py-3 text-sm text-gray-500">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Recommended Zone Sizes */}
      {stagingLanes.length > 0 && totalPeakVolume > 0 && settings.unitFootprintSqFt && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
          <p className="font-semibold text-amber-900 mb-2">Recommended Minimum Zone Sizes</p>
          <p className="text-amber-700 text-xs mb-3">
            Based on peak volume × {settings.unitFootprintSqFt} sq ft per unit × {settings.accessFactor ?? 1.3}x access
            {(settings.stackingHeight ?? 1) > 1 ? ` ÷ ${settings.stackingHeight}-high stacking` : ''}
            {' '}÷ {settings.squareSize}×{settings.squareSize} ft squares
          </p>
          <div className="space-y-1.5">
            {calculateZoneSizing(activities, volumeTiming, settings).map(rec => (
              <div key={rec.activityId} className="flex items-center justify-between">
                <span className="text-amber-800">{rec.activityName}</span>
                <span className="font-bold text-amber-900">
                  {rec.recommendedSquares} squares
                  <span className="font-normal text-amber-700 ml-1">({Math.round(rec.floorAreaSqFt)} sq ft)</span>
                </span>
              </div>
            ))}
            {calculateZoneSizing(activities, volumeTiming, settings).length === 0 && (
              <p className="text-amber-600 italic">Enter peak volumes above to see recommendations.</p>
            )}
          </div>
          <p className="text-xs text-amber-600 mt-2">These are recommendations only — you can adjust zone sizes when placing them in Step 2F.</p>
        </div>
      )}

      {stagingLanes.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">Typical shift:</span>
            <span className="text-gray-900">
              {totalTypicalVolume.toLocaleString()} {primaryUnit.toLowerCase()}
              {hasSecondaryUnit && ` (${totalTypicalSecondaryVolume.toLocaleString()} ${secondaryUnit.toLowerCase()})`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">Peak shift:</span>
            <span className="text-gray-900">
              {totalPeakVolume.toLocaleString()} {primaryUnit.toLowerCase()}
              {hasSecondaryUnit && ` (${totalPeakSecondaryVolume.toLocaleString()} ${secondaryUnit.toLowerCase()})`}
            </span>
          </div>
          {highestDest && (
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Highest volume:</span>
              <span className="text-gray-900">
                {highestDest.name} ({getPercentageForActivity(highestDest.id)}%)
              </span>
            </div>
          )}
          {earliestDep && (
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">First departure:</span>
              <span className="text-gray-900">
                {earliestDep.name} ({earliestDep.departure_time})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
