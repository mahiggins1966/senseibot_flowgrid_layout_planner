import { useState } from 'react';
import { ChevronDown, ChevronUp, Route, RotateCcw } from 'lucide-react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { Door } from '../types';

export function CorridorDrawer() {
  const {
    corridors,
    doors,
    isDrawingCorridor,
    setIsDrawingCorridor,
    selectedCorridorType,
    setSelectedCorridorType,
    setCorridorDrawStart,
    setCorridorWaypoints,
    settings,
    isDrawingFlowPath,
    flowPathDoorId,
    flowPathDirection,
    startDrawingFlowPath,
    cancelDrawingFlowPath,
    updateDoor,
  } = useGridStore();

  const [isOpen, setIsOpen] = useState(true);

  // --- Corridor handlers ---
  const handleCorridorTypeClick = (type: 'pedestrian' | 'forklift') => {
    if (isDrawingCorridor && selectedCorridorType === type) {
      setIsDrawingCorridor(false);
      setCorridorDrawStart(null);
      setCorridorWaypoints([]);
      setSelectedCorridorType(null);
    } else {
      setSelectedCorridorType(type);
      setIsDrawingCorridor(true);
      setCorridorDrawStart(null);
      setCorridorWaypoints([]);
    }
  };

  const handleCancelDrawing = () => {
    setIsDrawingCorridor(false);
    setCorridorDrawStart(null);
    setCorridorWaypoints([]);
    setSelectedCorridorType(null);
  };

  // --- Flow path handlers ---
  const materialDoors = doors.filter(d => d.has_inbound_material || d.has_outbound_material);
  const inboundDoors = materialDoors.filter(d => d.has_inbound_material);
  const outboundDoors = materialDoors.filter(d => d.has_outbound_material);

  const handleDrawFlowPath = (door: Door, direction: 'inbound' | 'outbound') => {
    // Cancel corridor drawing if active
    if (isDrawingCorridor) handleCancelDrawing();
    if (isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === direction) {
      cancelDrawingFlowPath();
      return;
    }
    startDrawingFlowPath(door.id, direction);
  };

  const handleClearFlowPath = async (door: Door, direction: 'inbound' | 'outbound') => {
    const field = direction === 'inbound' ? 'inbound_flow_points' : 'outbound_flow_points';
    const { error } = await supabase
      .from('doors')
      .update({ [field]: null })
      .eq('id', door.id);
    if (!error) {
      updateDoor(door.id, { [field]: null } as any);
    }
  };

  // --- Corridor stats ---
  const pedestrianCorridors = corridors.filter(c => c.type === 'pedestrian');
  const forkliftCorridors = corridors.filter(c => c.type === 'forklift');

  const totalPedestrianLength = pedestrianCorridors.reduce((sum, c) => {
    if (c.points && c.points.length >= 2) {
      let len = 0;
      for (let i = 0; i < c.points.length - 1; i++) {
        len += Math.abs(c.points[i + 1].x - c.points[i].x) + Math.abs(c.points[i + 1].y - c.points[i].y);
      }
      return sum + Math.max(len, 1);
    }
    const length = Math.max(
      Math.abs(c.end_grid_x - c.start_grid_x),
      Math.abs(c.end_grid_y - c.start_grid_y)
    ) + 1;
    return sum + length;
  }, 0);

  const totalForkliftLength = forkliftCorridors.reduce((sum, c) => {
    if (c.points && c.points.length >= 2) {
      let len = 0;
      for (let i = 0; i < c.points.length - 1; i++) {
        len += Math.abs(c.points[i + 1].x - c.points[i].x) + Math.abs(c.points[i + 1].y - c.points[i].y);
      }
      return sum + Math.max(len, 1);
    }
    const length = Math.max(
      Math.abs(c.end_grid_x - c.start_grid_x),
      Math.abs(c.end_grid_y - c.start_grid_y)
    ) + 1;
    return sum + length;
  }, 0);

  const pedestrianFeet = totalPedestrianLength * settings.squareSize;
  const forkliftFeet = totalForkliftLength * settings.squareSize;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg"
      >
        <h3 className="font-semibold text-gray-900">Draw Corridors and Paths</h3>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            {corridors.length} {corridors.length === 1 ? 'path' : 'paths'}
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </div>
      </button>

      {isOpen && (
        <>
          {/* ===== MATERIAL FLOW PATHS — above corridor buttons ===== */}
          {materialDoors.length > 0 && (
            <div className="space-y-2 pb-3 border-b border-gray-200">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide px-1">
                Material Flow Paths
              </div>
              <p className="text-xs text-gray-500 px-1">
                Draw the route material takes from doors to work areas. Click waypoints, double-click to finish.
              </p>

              {inboundDoors.map(door => (
                <div key={`in-${door.id}`} className="flex items-center gap-2 px-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{door.name}</div>
                    <div className="text-[10px] text-gray-500">{door.inbound_percentage ?? 0}% inbound</div>
                  </div>
                  <button
                    onClick={() => handleDrawFlowPath(door, 'inbound')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap ${
                      isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === 'inbound'
                        ? 'bg-blue-600 text-white'
                        : door.inbound_flow_points
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    <Route className="w-3 h-3" />
                    {isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === 'inbound'
                      ? 'Cancel'
                      : door.inbound_flow_points ? '✓ Redraw' : 'Draw Inbound'}
                  </button>
                  {door.inbound_flow_points && (
                    <button
                      onClick={() => handleClearFlowPath(door, 'inbound')}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Clear path"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {outboundDoors.map(door => (
                <div key={`out-${door.id}`} className="flex items-center gap-2 px-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{door.name}</div>
                    <div className="text-[10px] text-gray-500">{door.outbound_percentage ?? 0}% outbound</div>
                  </div>
                  <button
                    onClick={() => handleDrawFlowPath(door, 'outbound')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap ${
                      isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === 'outbound'
                        ? 'bg-orange-600 text-white'
                        : door.outbound_flow_points
                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    <Route className="w-3 h-3" />
                    {isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === 'outbound'
                      ? 'Cancel'
                      : door.outbound_flow_points ? '✓ Redraw' : 'Draw Outbound'}
                  </button>
                  {door.outbound_flow_points && (
                    <button
                      onClick={() => handleClearFlowPath(door, 'outbound')}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Clear path"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ===== ACTIVE DRAWING STATUS ===== */}
          {isDrawingCorridor && selectedCorridorType && (
            <div className="mb-3 p-3 bg-amber-50 border-2 border-amber-400 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-amber-600 rounded-full animate-pulse"></span>
                  Drawing: {selectedCorridorType === 'pedestrian' ? 'Pedestrian Walkway' : 'Forklift / Cart Path'}
                </div>
                <button
                  onClick={handleCancelDrawing}
                  className="px-3 py-1 bg-white border border-amber-400 text-amber-700 rounded hover:bg-amber-50 transition-colors text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
              <div className="text-xs text-amber-800">
                Click to place waypoints. Add bends by clicking corners. Double-click or press Enter to finish. Press Escape to cancel.
              </div>
            </div>
          )}

          {/* ===== CORRIDOR TYPE BUTTONS ===== */}
          <div className="space-y-3">
            <button
              onClick={() => handleCorridorTypeClick('pedestrian')}
              className={`w-full p-3 rounded-lg transition-all text-left ${
                isDrawingCorridor && selectedCorridorType === 'pedestrian'
                  ? 'border-4 border-green-600 bg-green-50 shadow-lg'
                  : 'border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Pedestrian Walkway (1 square wide)</div>
                </div>
                <div
                  className="w-12 h-8 rounded border-2 border-dashed"
                  style={{ backgroundColor: 'white', borderColor: '#86EFAC' }}
                />
              </div>
            </button>

            <button
              onClick={() => handleCorridorTypeClick('forklift')}
              className={`w-full p-3 rounded-lg transition-all text-left ${
                isDrawingCorridor && selectedCorridorType === 'forklift'
                  ? 'border-4 border-orange-600 bg-orange-50 shadow-lg'
                  : 'border-2 border-gray-300 hover:border-orange-500 hover:bg-orange-50 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Forklift / Cart Path (2 squares wide)</div>
                </div>
                <div
                  className="w-12 h-8 rounded border-2 border-dashed"
                  style={{ backgroundColor: 'white', borderColor: '#FFA96A' }}
                />
              </div>
            </button>
          </div>

          {/* ===== INSTRUCTIONS ===== */}
          <p className="text-xs text-gray-500 px-1">
            Click a button, then click on the grid to place waypoints. Add bends by clicking corners. Double-click or press Enter to finish. Press Escape to cancel.
          </p>

          {/* ===== SUMMARY STATS ===== */}
          <div className="text-sm font-semibold text-gray-900 px-1">
            Summary: {corridors.length} corridors | Pedestrian: {pedestrianFeet} ft | Forklift: {forkliftFeet} ft
          </div>

          {/* ===== CORRIDOR LIST ===== */}
          {corridors.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {corridors.map((corridor) => {
                let lengthSquares = 0;
                if (corridor.points && corridor.points.length >= 2) {
                  for (let i = 0; i < corridor.points.length - 1; i++) {
                    lengthSquares += Math.abs(corridor.points[i + 1].x - corridor.points[i].x) + Math.abs(corridor.points[i + 1].y - corridor.points[i].y);
                  }
                } else {
                  lengthSquares = Math.max(
                    Math.abs(corridor.end_grid_x - corridor.start_grid_x),
                    Math.abs(corridor.end_grid_y - corridor.start_grid_y)
                  ) + 1;
                }
                const lengthFeet = lengthSquares * settings.squareSize;
                const typeLabel = corridor.type === 'pedestrian' ? 'Pedestrian' : 'Forklift';

                return (
                  <div key={corridor.id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg text-xs">
                    <div>
                      <div className="font-medium text-gray-900">{corridor.name}</div>
                      <div className="text-gray-500">{typeLabel} · {lengthFeet} ft</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
