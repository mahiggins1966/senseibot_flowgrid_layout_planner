import { useState, useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { UNIT_FOOTPRINT_OPTIONS } from '../types';

export function VolumeTimingInput() {
  const { activities, volumeTiming, updateVolumeTiming, settings, loadVolumeTiming } = useGridStore();

  const stagingLanes = activities.filter((a) => a.type === 'staging-lane');

  const [editingValues, setEditingValues] = useState<Record<string, {
    typicalPrimary: string;
    peakPrimary: string;
    typicalUnits: string;
    peakUnits: string;
  }>>({});

  useEffect(() => {
    loadVolumeTiming();
  }, [loadVolumeTiming]);

  // Derive unit label from 2A flow unit setting (pallets, boxes, totes)
  const getFloorUnitLabel = () => {
    const flowUnit = settings.typicalFlowUnit || 'pallet';
    const option = UNIT_FOOTPRINT_OPTIONS.find(o => o.value === flowUnit);
    if (flowUnit === 'custom') return 'Units';
    if (option) return option.value.charAt(0).toUpperCase() + option.value.slice(1) + 's';
    return 'Units';
  };

  const floorUnitLabel = getFloorUnitLabel();

  // Throughput unit — default to Lbs
  const throughputUnit = settings.measurementSystem === 'Metric' ? 'Kg' : 'Lbs';

  const totalTypicalVolume = stagingLanes.reduce((sum, lane) => {
    const vt = volumeTiming.find((v) => v.activity_id === lane.id);
    return sum + (vt ? vt.typical_volume_per_shift : 0);
  }, 0);

  const totalPeakVolume = stagingLanes.reduce((sum, lane) => {
    const vt = volumeTiming.find((v) => v.activity_id === lane.id);
    return sum + (vt ? vt.peak_volume_per_shift : 0);
  }, 0);

  const totalTypicalUnits = stagingLanes.reduce((sum, lane) => {
    const vt = volumeTiming.find((v) => v.activity_id === lane.id);
    return sum + (vt?.typical_units_on_floor || 0);
  }, 0);

  const totalPeakUnits = stagingLanes.reduce((sum, lane) => {
    const vt = volumeTiming.find((v) => v.activity_id === lane.id);
    return sum + (vt?.peak_units_on_floor || 0);
  }, 0);

  const getTypicalVolumeForActivity = (activityId: string) => {
    const vt = volumeTiming.find((v) => v.activity_id === activityId);
    return vt ? vt.typical_volume_per_shift : 0;
  };

  const getPeakVolumeForActivity = (activityId: string) => {
    const vt = volumeTiming.find((v) => v.activity_id === activityId);
    return vt ? vt.peak_volume_per_shift : 0;
  };

  const getTypicalUnitsForActivity = (activityId: string) => {
    const vt = volumeTiming.find((v) => v.activity_id === activityId);
    return vt?.typical_units_on_floor || 0;
  };

  const getPeakUnitsForActivity = (activityId: string) => {
    const vt = volumeTiming.find((v) => v.activity_id === activityId);
    return vt?.peak_units_on_floor || 0;
  };

  const calculatePeakFactor = (typical: number, peak: number) => {
    if (typical === 0) return 0;
    return peak / typical;
  };

  const getPercentageForActivity = (activityId: string) => {
    if (totalTypicalVolume === 0) return 0;
    const volume = getTypicalVolumeForActivity(activityId);
    return ((volume / totalTypicalVolume) * 100).toFixed(1);
  };

  // Helper: save all fields for a lane
  const saveVolumeTiming = async (laneId: string, overrides: Partial<{
    typicalVolume: number;
    peakVolume: number;
    typicalUnitsOnFloor: number;
    peakUnitsOnFloor: number;
  }>) => {
    const vt = volumeTiming.find(v => v.activity_id === laneId);
    await updateVolumeTiming(
      laneId,
      overrides.typicalVolume ?? (vt?.typical_volume_per_shift || 0),
      overrides.peakVolume ?? (vt?.peak_volume_per_shift || 0),
      overrides.typicalUnitsOnFloor ?? (vt?.typical_units_on_floor || 0),
      overrides.peakUnitsOnFloor ?? (vt?.peak_units_on_floor || 0),
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-medium mb-2">How much material goes through each activity?</p>
        <p>
          Enter the throughput weight <strong>and</strong> how many {floorUnitLabel.toLowerCase()} sit on the floor at once.
          Weight shows proportional throughput. {floorUnitLabel} on floor drives the zone sizing math.
        </p>
      </div>

      {stagingLanes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white border border-gray-300 rounded-lg">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300" rowSpan={2}>
                  Destination
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 border-b border-gray-200" colSpan={2}>
                  Throughput ({throughputUnit})
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-blue-700 border-b border-blue-200 bg-blue-50" colSpan={2}>
                  {floorUnitLabel} on Floor
                </th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300" rowSpan={2}>
                  %
                </th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300" rowSpan={2}>
                  Depart
                </th>
              </tr>
              <tr className="bg-gray-50">
                <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 border-b border-gray-300">Typical</th>
                <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 border-b border-gray-300">Peak</th>
                <th className="px-3 py-1 text-left text-xs font-medium text-blue-600 border-b border-blue-200 bg-blue-50">Typical</th>
                <th className="px-3 py-1 text-left text-xs font-medium text-blue-600 border-b border-blue-200 bg-blue-50">Peak</th>
              </tr>
            </thead>
            <tbody>
              {stagingLanes.map((lane, index) => {
                const typicalVolume = getTypicalVolumeForActivity(lane.id);
                const peakVolume = getPeakVolumeForActivity(lane.id);
                const typicalUnits = getTypicalUnitsForActivity(lane.id);
                const peakUnits = getPeakUnitsForActivity(lane.id);
                const percentage = getPercentageForActivity(lane.id);
                const peakFactor = calculatePeakFactor(typicalVolume, peakVolume);

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
                      <td className="px-3 py-3 border-b border-gray-200">
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
                      {/* Typical Weight */}
                      <td className="px-3 py-3 border-b border-gray-200">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingValues[lane.id]?.typicalPrimary ?? typicalVolume.toString()}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            const parts = value.split('.');
                            const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                            setEditingValues(prev => ({
                              ...prev,
                              [lane.id]: {
                                ...prev[lane.id],
                                typicalPrimary: sanitized,
                                peakPrimary: prev[lane.id]?.peakPrimary ?? peakVolume.toString(),
                                typicalUnits: prev[lane.id]?.typicalUnits ?? typicalUnits.toString(),
                                peakUnits: prev[lane.id]?.peakUnits ?? peakUnits.toString(),
                              },
                            }));
                          }}
                          onBlur={async () => {
                            const val = parseFloat(editingValues[lane.id]?.typicalPrimary ?? '') || 0;
                            await saveVolumeTiming(lane.id, { typicalVolume: val });
                            setEditingValues(prev => { const n = { ...prev }; delete n[lane.id]; return n; });
                          }}
                          className="w-20 px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                      </td>
                      {/* Peak Weight */}
                      <td className="px-3 py-3 border-b border-gray-200">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingValues[lane.id]?.peakPrimary ?? peakVolume.toString()}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            const parts = value.split('.');
                            const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                            setEditingValues(prev => ({
                              ...prev,
                              [lane.id]: {
                                ...prev[lane.id],
                                typicalPrimary: prev[lane.id]?.typicalPrimary ?? typicalVolume.toString(),
                                peakPrimary: sanitized,
                                typicalUnits: prev[lane.id]?.typicalUnits ?? typicalUnits.toString(),
                                peakUnits: prev[lane.id]?.peakUnits ?? peakUnits.toString(),
                              },
                            }));
                          }}
                          onBlur={async () => {
                            const val = parseFloat(editingValues[lane.id]?.peakPrimary ?? '') || 0;
                            await saveVolumeTiming(lane.id, { peakVolume: val });
                            setEditingValues(prev => { const n = { ...prev }; delete n[lane.id]; return n; });
                          }}
                          className="w-20 px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                      </td>
                      {/* Typical Units on Floor */}
                      <td className="px-3 py-3 border-b border-blue-100 bg-blue-50/30">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingValues[lane.id]?.typicalUnits ?? typicalUnits.toString()}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            const parts = value.split('.');
                            const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                            setEditingValues(prev => ({
                              ...prev,
                              [lane.id]: {
                                ...prev[lane.id],
                                typicalPrimary: prev[lane.id]?.typicalPrimary ?? typicalVolume.toString(),
                                peakPrimary: prev[lane.id]?.peakPrimary ?? peakVolume.toString(),
                                typicalUnits: sanitized,
                                peakUnits: prev[lane.id]?.peakUnits ?? peakUnits.toString(),
                              },
                            }));
                          }}
                          onBlur={async () => {
                            const val = parseFloat(editingValues[lane.id]?.typicalUnits ?? '') || 0;
                            await saveVolumeTiming(lane.id, { typicalUnitsOnFloor: val });
                            setEditingValues(prev => { const n = { ...prev }; delete n[lane.id]; return n; });
                          }}
                          className="w-20 px-2 py-2 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          placeholder="0"
                        />
                      </td>
                      {/* Peak Units on Floor */}
                      <td className="px-3 py-3 border-b border-blue-100 bg-blue-50/30">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingValues[lane.id]?.peakUnits ?? peakUnits.toString()}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            const parts = value.split('.');
                            const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                            setEditingValues(prev => ({
                              ...prev,
                              [lane.id]: {
                                ...prev[lane.id],
                                typicalPrimary: prev[lane.id]?.typicalPrimary ?? typicalVolume.toString(),
                                peakPrimary: prev[lane.id]?.peakPrimary ?? peakVolume.toString(),
                                typicalUnits: prev[lane.id]?.typicalUnits ?? typicalUnits.toString(),
                                peakUnits: sanitized,
                              },
                            }));
                          }}
                          onBlur={async () => {
                            const val = parseFloat(editingValues[lane.id]?.peakUnits ?? '') || 0;
                            await saveVolumeTiming(lane.id, { peakUnitsOnFloor: val });
                            setEditingValues(prev => { const n = { ...prev }; delete n[lane.id]; return n; });
                          }}
                          className="w-20 px-2 py-2 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-3 border-b border-gray-200">
                        <div className="text-sm text-gray-900 font-medium">{percentage}%</div>
                      </td>
                      <td className="px-3 py-3 border-b border-gray-200">
                        <div className="text-sm text-gray-700">{lane.departure_time || '—'}</div>
                      </td>
                    </tr>
                    {peakFactor > 0 && (
                      <tr key={`${lane.id}-factor`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td colSpan={7} className="px-3 py-2 border-b border-gray-200">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`font-semibold ${peakFactorColor}`}>
                              Peak Factor: {peakFactor.toFixed(1)}x
                            </span>
                            {peakFactorNote && (
                              <span className={peakFactorColor}>— {peakFactorNote}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              <tr className="bg-gray-100 border-t-2 border-gray-400">
                <td className="px-3 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                <td className="px-3 py-3 text-sm font-bold text-gray-900">
                  {totalTypicalVolume.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-sm font-bold text-gray-900">
                  {totalPeakVolume.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-sm font-bold text-blue-900 bg-blue-50/30">
                  {totalTypicalUnits.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-sm font-bold text-blue-900 bg-blue-50/30">
                  {totalPeakUnits.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-sm font-bold text-gray-900">100%</td>
                <td className="px-3 py-3 text-sm text-gray-500">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
