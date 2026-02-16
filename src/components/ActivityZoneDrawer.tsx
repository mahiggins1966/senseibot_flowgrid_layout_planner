import { useState, useMemo, useEffect, useRef } from 'react';
import { CheckCircle, Circle } from 'lucide-react';
import { useGridStore } from '../store/gridStore';
import { Activity } from '../types';
import { calculateZoneSizing, SizingRecommendation } from '../utils/zoneSizing';

export function ActivityZoneDrawer() {
  const {
    activities,
    zones,
    isDrawingZone,
    setIsDrawingZone,
    setZoneDrawStart,
    selectedActivityForZone,
    setSelectedActivityForZone,
    zoneDrawWidth,
    zoneDrawHeight,
    setZoneDrawWidth,
    setZoneDrawHeight,
    settings,
    paintedSquares,
    doors,
    volumeTiming,
    activityRelationships,
    getGridDimensions,
  } = useGridStore();

  const [placementFeedback, setPlacementFeedback] = useState<Array<{
    message: string;
    type: 'success' | 'warning';
  }>>([]);

  const lastZoneCountRef = useRef(zones.length);

  // Calculate recommended sizes using the sizing model
  const sizingRecommendations = useMemo(() => {
    return calculateZoneSizing(activities, volumeTiming, settings);
  }, [activities, volumeTiming, settings]);

  const getRecommendation = (activityId: string): SizingRecommendation | undefined => {
    return sizingRecommendations.find(r => r.activityId === activityId);
  };

  // Convert recommended squares into width × height dimensions
  const getRecommendedDimensions = (squares: number): { width: number; height: number } => {
    if (squares <= 0) return { width: 3, height: 3 };
    // Aim for aspect ratio ~1.3 (slightly wider than tall)
    const targetAspect = 1.3;
    let height = Math.max(2, Math.round(Math.sqrt(squares / targetAspect)));
    let width = Math.max(2, Math.round(squares / height));
    // Make sure we meet the minimum
    while (width * height < squares) {
      if (width <= height * targetAspect) {
        width++;
      } else {
        height++;
      }
    }
    return { width, height };
  };

  // Sort activities: unplaced first, then by recommended size (largest first), then placed
  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      const aPlaced = zones.some(z => z.activity_id === a.id);
      const bPlaced = zones.some(z => z.activity_id === b.id);

      // Placed activities go to bottom
      if (aPlaced && !bPlaced) return 1;
      if (!aPlaced && bPlaced) return -1;

      // Among unplaced, sort by recommended squares descending (largest first)
      const aRec = getRecommendation(a.id);
      const bRec = getRecommendation(b.id);
      const aSquares = aRec?.recommendedSquares ?? 0;
      const bSquares = bRec?.recommendedSquares ?? 0;

      if (aSquares !== bSquares) return bSquares - aSquares;

      // Fall back to sort_order
      return a.sort_order - b.sort_order;
    });
  }, [activities, zones, sizingRecommendations]);

  // Validate zone placement against closeness relationships AND sizing
  useEffect(() => {
    if (zones.length > lastZoneCountRef.current) {
      const newZone = zones[zones.length - 1];
      if (!newZone.activity_id) {
        lastZoneCountRef.current = zones.length;
        return;
      }

      const feedback: Array<{ message: string; type: 'success' | 'warning' }> = [];
      const newActivity = activities.find(a => a.id === newZone.activity_id);
      const newActivityName = newActivity?.name || 'Zone';

      // Check sizing recommendation
      const rec = getRecommendation(newZone.activity_id);
      if (rec) {
        const actualSquares = newZone.grid_width * newZone.grid_height;
        if (actualSquares < rec.recommendedSquares) {
          feedback.push({
            message: `${newActivityName} is ${actualSquares} squares — recommended minimum is ${rec.recommendedSquares} based on ${rec.peakVolume} peak units`,
            type: 'warning'
          });
        } else {
          feedback.push({
            message: `${newActivityName} meets recommended size (${actualSquares} ≥ ${rec.recommendedSquares} squares)`,
            type: 'success'
          });
        }
      }

      // Check closeness relationships
      const relationships = activityRelationships.filter(
        rel => rel.activity_a_id === newZone.activity_id || rel.activity_b_id === newZone.activity_id
      );

      relationships.forEach(rel => {
        const relatedActivityId = rel.activity_a_id === newZone.activity_id
          ? rel.activity_b_id
          : rel.activity_a_id;

        const relatedZone = zones.find(z => z.activity_id === relatedActivityId && z.id !== newZone.id);
        if (!relatedZone) return;

        const relatedActivity = activities.find(a => a.id === relatedActivityId);
        if (!relatedActivity) return;

        const zoneCenterRow = newZone.grid_y + newZone.grid_height / 2;
        const zoneCenterCol = newZone.grid_x + newZone.grid_width / 2;
        const relatedCenterRow = relatedZone.grid_y + relatedZone.grid_height / 2;
        const relatedCenterCol = relatedZone.grid_x + relatedZone.grid_width / 2;

        const distance = Math.round(
          Math.sqrt(
            Math.pow(zoneCenterCol - relatedCenterCol, 2) +
            Math.pow(zoneCenterRow - relatedCenterRow, 2)
          )
        );

        if (rel.rating === 'must-be-close') {
          feedback.push({
            message: `${newActivityName} is ${distance} squares from ${relatedActivity.name} — rated Must be close`,
            type: distance <= 5 ? 'success' : 'warning'
          });
        } else if (rel.rating === 'prefer-close') {
          feedback.push({
            message: `${newActivityName} is ${distance} squares from ${relatedActivity.name} — rated Prefer close`,
            type: distance <= 8 ? 'success' : 'warning'
          });
        } else if (rel.rating === 'keep-apart') {
          feedback.push({
            message: `${newActivityName} is ${distance} squares from ${relatedActivity.name} — rated Keep apart`,
            type: distance >= 10 ? 'success' : 'warning'
          });
        }
      });

      setPlacementFeedback(feedback);

      if (feedback.length > 0) {
        setTimeout(() => {
          setPlacementFeedback([]);
        }, 10000);
      }
    }

    lastZoneCountRef.current = zones.length;
  }, [zones, activityRelationships, activities, sizingRecommendations]);

  const formatUnit = (unit?: string) => {
    if (!unit) return 'units';
    if (unit === 'custom') return settings.primaryFlowUnitCustom || 'units';
    return unit;
  };

  const getActivityColor = (activity: Activity) => {
    if (activity.type === 'corridor') return '#FFFFFF';
    if (activity.color) return activity.color;
    switch (activity.type) {
      case 'work-area': return '#3B82F6';
      case 'support-area': return '#8B5CF6';
      default: return '#3B82F6';
    }
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'work-area': return 'Work Area';
      case 'staging-lane': return 'Staging Lane';
      case 'corridor': return 'Corridor / Path';
      case 'support-area': return 'Support Area';
      default: return type;
    }
  };

  const activityZoneMap = useMemo(() => {
    const map = new Map<string, typeof zones[0]>();
    zones.forEach(zone => {
      if (zone.activity_id) {
        map.set(zone.activity_id, zone);
      }
    });
    return map;
  }, [zones]);

  const placedCount = activityZoneMap.size;
  const totalCount = activities.length;

  const getAvailableSquares = () => {
    const gridDims = getGridDimensions();
    const totalSquares = gridDims.rows * gridDims.cols;

    let permanentCount = 0;
    let semiFixedCount = 0;
    paintedSquares.forEach(square => {
      if (square.type === 'permanent') permanentCount++;
      else if (square.type === 'semi-fixed') semiFixedCount++;
    });

    const doorSquares = doors.reduce((sum, door) => sum + door.width, 0);

    let zoneSquares = 0;
    zones.forEach(zone => {
      zoneSquares += zone.grid_width * zone.grid_height;
    });

    const availableSquares = totalSquares - permanentCount - semiFixedCount - doorSquares;
    const unassigned = availableSquares - zoneSquares;

    return { totalSquares, availableSquares, unassigned };
  };

  const { availableSquares, unassigned } = getAvailableSquares();

  // Calculate closeness relationships for selected activity
  const selectedActivityRelationships = useMemo(() => {
    if (!selectedActivityForZone) return null;

    const mustBeClose: Activity[] = [];
    const preferClose: Activity[] = [];
    const keepApart: Activity[] = [];

    activityRelationships.forEach(rel => {
      let relatedActivityId: string | null = null;

      if (rel.activity_a_id === selectedActivityForZone) {
        relatedActivityId = rel.activity_b_id;
      } else if (rel.activity_b_id === selectedActivityForZone) {
        relatedActivityId = rel.activity_a_id;
      }

      if (relatedActivityId) {
        const relatedActivity = activities.find(a => a.id === relatedActivityId);
        if (relatedActivity) {
          if (rel.rating === 'must-be-close') {
            mustBeClose.push(relatedActivity);
          } else if (rel.rating === 'prefer-close') {
            preferClose.push(relatedActivity);
          } else if (rel.rating === 'keep-apart') {
            keepApart.push(relatedActivity);
          }
        }
      }
    });

    return { mustBeClose, preferClose, keepApart };
  }, [selectedActivityForZone, activityRelationships, activities]);

  const handleActivityClick = (activity: Activity) => {
    const zone = activityZoneMap.get(activity.id);
    if (zone) return;

    // Use sizing recommendation if available
    const rec = getRecommendation(activity.id);

    let defaultWidth = 3;
    let defaultHeight = 3;

    if (rec) {
      const dims = getRecommendedDimensions(rec.recommendedSquares);
      defaultWidth = dims.width;
      defaultHeight = dims.height;
    } else {
      switch (activity.type) {
        case 'staging-lane':
          defaultWidth = 6;
          defaultHeight = 3;
          break;
        case 'work-area':
          defaultWidth = 5;
          defaultHeight = 4;
          break;
        case 'corridor':
          defaultWidth = 2;
          defaultHeight = 8;
          break;
        case 'support-area':
          defaultWidth = 3;
          defaultHeight = 3;
          break;
      }
    }

    setZoneDrawWidth(defaultWidth);
    setZoneDrawHeight(defaultHeight);
    setSelectedActivityForZone(activity.id);
    setIsDrawingZone(true);
    setZoneDrawStart(null);
  };

  const handleCancelDrawing = () => {
    setIsDrawingZone(false);
    setZoneDrawStart(null);
    setSelectedActivityForZone(null);
  };

  return (
    <div className="space-y-4">
      <div>
        {isDrawingZone && selectedActivityForZone && (
          <div className="mb-3 p-4 bg-green-100 border-4 border-green-600 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xl font-bold text-green-900 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-green-600 rounded-full animate-pulse"></span>
                  ZONE PLACEMENT ACTIVE
                </div>
                <div className="text-base text-green-800 mt-1 font-medium">
                  Set zone size below, then click on grid to place
                </div>
              </div>
              <button
                onClick={handleCancelDrawing}
                className="px-4 py-2 bg-white border-2 border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors text-sm font-bold shadow-md"
              >
                Cancel
              </button>
            </div>

            <div className="bg-white rounded-lg p-3 border-2 border-green-300 shadow-sm">
              <div className="text-sm font-bold text-gray-700 mb-2">Zone Size (grid squares)</div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-600 block mb-1 font-medium">Width</label>
                  <input
                    type="number"
                    min="1"
                    value={zoneDrawWidth}
                    onChange={(e) => setZoneDrawWidth(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded text-sm font-medium"
                  />
                </div>
                <div className="text-gray-400 mt-5 text-xl font-bold">×</div>
                <div className="flex-1">
                  <label className="text-xs text-gray-600 block mb-1 font-medium">Height</label>
                  <input
                    type="number"
                    min="1"
                    value={zoneDrawHeight}
                    onChange={(e) => setZoneDrawHeight(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded text-sm font-medium"
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600 mt-2 font-medium">
                Total: {zoneDrawWidth * zoneDrawHeight} squares ({zoneDrawWidth * zoneDrawHeight * settings.squareSize * settings.squareSize} sq ft)
              </div>

              {/* Sizing recommendation check */}
              {(() => {
                const rec = getRecommendation(selectedActivityForZone);
                if (!rec) return null;
                const currentSquares = zoneDrawWidth * zoneDrawHeight;
                if (currentSquares < rec.recommendedSquares) {
                  return (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-800">
                      ⚠ Recommended minimum is <span className="font-bold">{rec.recommendedSquares} squares</span> based on {rec.peakVolume} peak {formatUnit(settings.primaryFlowUnit)} × {rec.effectiveSqFtPerUnit.toFixed(1)} sq ft each. You're {rec.recommendedSquares - currentSquares} squares short.
                    </div>
                  );
                }
                return (
                  <div className="mt-2 p-2 bg-green-50 border border-green-300 rounded text-xs text-green-800">
                    ✓ Meets recommended minimum of {rec.recommendedSquares} squares
                  </div>
                );
              })()}

              <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                Click grid to place · Drag edges to resize · Hold & drag to move · Esc to cancel
              </div>
            </div>

            {/* Closeness Relationships */}
            {selectedActivityRelationships && (
              <div className="mt-3 bg-white rounded-lg p-3 border-2 border-purple-300 shadow-sm">
                <div className="text-sm font-bold text-purple-900 mb-2">Closeness Relationships</div>
                {selectedActivityRelationships.mustBeClose.length === 0 &&
                 selectedActivityRelationships.preferClose.length === 0 &&
                 selectedActivityRelationships.keepApart.length === 0 ? (
                  <div className="text-xs text-gray-600 italic">
                    No closeness relationships defined for this activity in Step 2E.
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {selectedActivityRelationships.mustBeClose.length > 0 && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-green-800 whitespace-nowrap">Must be close to:</span>
                        <span className="text-green-700">
                          {selectedActivityRelationships.mustBeClose.map(a => a.name).join(', ')}
                        </span>
                      </div>
                    )}
                    {selectedActivityRelationships.preferClose.length > 0 && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-green-600 whitespace-nowrap">Prefer close to:</span>
                        <span className="text-green-600">
                          {selectedActivityRelationships.preferClose.map(a => a.name).join(', ')}
                        </span>
                      </div>
                    )}
                    {selectedActivityRelationships.keepApart.length > 0 && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-red-700 whitespace-nowrap">Keep apart from:</span>
                        <span className="text-red-600">
                          {selectedActivityRelationships.keepApart.map(a => a.name).join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-purple-200 text-purple-700 italic font-medium">
                      {(() => {
                        const alreadyPlacedCount = [
                          ...selectedActivityRelationships.mustBeClose,
                          ...selectedActivityRelationships.preferClose,
                          ...selectedActivityRelationships.keepApart
                        ].filter(a => zones.some(z => z.activity_id === a.id)).length;

                        if (alreadyPlacedCount === 0) {
                          return "Related zones will glow on the grid once they are placed.";
                        } else {
                          return `Look on the grid: ${alreadyPlacedCount} related zone${alreadyPlacedCount > 1 ? 's are' : ' is'} glowing now with distance indicators!`;
                        }
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Placement priority hint */}
        {sizingRecommendations.length > 0 && zones.length === 0 && !isDrawingZone && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <span className="font-semibold">Tip:</span> Activities are sorted largest-first. Place the biggest zones first — they're the hardest to fit.
          </div>
        )}

        <div className="space-y-2">
          {sortedActivities.map(activity => {
            const zone = activityZoneMap.get(activity.id);
            const isPlaced = !!zone;
            const color = getActivityColor(activity);
            const isSelected = selectedActivityForZone === activity.id && isDrawingZone;
            const rec = getRecommendation(activity.id);

            return (
              <button
                key={activity.id}
                onClick={() => handleActivityClick(activity)}
                disabled={isPlaced || (isDrawingZone && selectedActivityForZone !== activity.id)}
                className={`w-full p-3 rounded-lg transition-all text-left ${
                  isSelected
                    ? 'border-4 border-green-600 bg-green-50 shadow-lg'
                    : isPlaced
                    ? 'border-2 border-gray-300 bg-gray-50 cursor-not-allowed opacity-60'
                    : 'border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isPlaced ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{activity.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {getActivityTypeLabel(activity.type)}
                    </div>

                    {/* Unplaced: show recommendation */}
                    {!isPlaced && rec && (
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="text-gray-700 font-medium">
                          {rec.peakVolume.toLocaleString()} peak {formatUnit(settings.primaryFlowUnit)}
                        </div>
                        <div className="text-blue-700 font-semibold bg-blue-50 px-2 py-1 rounded inline-block">
                          Recommended: {rec.recommendedSquares} squares ({Math.round(rec.floorAreaSqFt)} sq ft)
                        </div>
                      </div>
                    )}

                    {/* Unplaced staging with no recommendation (no volume data) */}
                    {!isPlaced && !rec && activity.type === 'staging-lane' && (
                      <div className="mt-2 text-xs text-gray-400 italic">
                        Enter peak volumes in Step 2D for sizing recommendation
                      </div>
                    )}

                    {isSelected && (
                      <div className="mt-2 px-2 py-1 bg-green-600 text-white text-xs font-bold rounded inline-block animate-pulse">
                        ✓ Selected — Click on grid to place
                      </div>
                    )}

                    {/* Placed: show size + sizing check */}
                    {zone && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-gray-600">
                          Size: {zone.grid_width} × {zone.grid_height} squares
                          ({zone.grid_width * zone.grid_height * settings.squareSize * settings.squareSize} sq ft)
                        </div>
                        {rec && (() => {
                          const actualSquares = zone.grid_width * zone.grid_height;
                          if (actualSquares < rec.recommendedSquares) {
                            return (
                              <div className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded">
                                ⚠ Undersized — {actualSquares} of {rec.recommendedSquares} recommended squares
                              </div>
                            );
                          }
                          return (
                            <div className="text-xs text-green-700 font-medium">
                              ✓ Meets recommended {rec.recommendedSquares} squares
                            </div>
                          );
                        })()}
                        {!rec && activity.type === 'staging-lane' && (() => {
                          const vt = volumeTiming.find(v => v.activity_id === activity.id);
                          if (!vt) return null;

                          const totalStagingSpace = zones
                            .filter(z => {
                              const act = activities.find(a => a.id === z.activity_id);
                              return act?.type === 'staging-lane';
                            })
                            .reduce((sum, z) => sum + (z.grid_width * z.grid_height), 0);

                          const zoneSpace = zone.grid_width * zone.grid_height;
                          const spacePercent = totalStagingSpace > 0 ? (zoneSpace / totalStagingSpace) * 100 : 0;
                          const volumePercent = vt.percentage;
                          const diff = Math.abs(spacePercent - volumePercent);

                          return (
                            <div className="text-xs space-y-0.5">
                              <div className="text-blue-600 font-semibold">
                                Volume: {volumePercent.toFixed(1)}% of total
                              </div>
                              <div className="text-gray-600 font-medium">
                                Space: {spacePercent.toFixed(1)}% of staging
                              </div>
                              {diff > 10 && spacePercent < volumePercent && (
                                <div className="text-orange-700 font-medium bg-orange-50 px-2 py-1 rounded">
                                  ⚠ Undersized — handles {volumePercent.toFixed(0)}% of volume but has {spacePercent.toFixed(0)}% of space
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {activity.type !== 'staging-lane' && !rec && (() => {
                          const gridDims = getGridDimensions();
                          const totalSquares = gridDims.rows * gridDims.cols;
                          const zoneSpace = zone.grid_width * zone.grid_height;
                          const spacePercent = (zoneSpace / totalSquares) * 100;

                          return (
                            <div className="text-xs text-gray-600 font-medium">
                              Space: {spacePercent.toFixed(1)}% of grid
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div
                    className="w-8 h-8 rounded flex-shrink-0"
                    style={{
                      backgroundColor: color,
                      borderColor: activity.type === 'corridor' ? '#86EFAC' : color,
                      borderWidth: isSelected ? '4px' : '2px',
                      borderStyle: activity.type === 'corridor' ? 'dashed' : 'solid',
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {activities.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            No activities yet. Add activities in Step 2C.
          </div>
        )}

      {/* Placement Feedback */}
      {placementFeedback.length > 0 && (
        <div className="space-y-2">
          {placementFeedback.map((feedback, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-lg text-xs font-medium ${
                feedback.type === 'success'
                  ? 'bg-green-50 border border-green-300 text-green-800'
                  : 'bg-orange-50 border border-orange-300 text-orange-800'
              }`}
            >
              {feedback.type === 'success' ? '✓' : '⚠'} {feedback.message}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
