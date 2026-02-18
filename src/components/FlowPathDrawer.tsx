import { useState } from 'react';
import { ChevronDown, ChevronUp, Route, RotateCcw } from 'lucide-react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { Door } from '../types';

export function FlowPathDrawer() {
  const {
    doors,
    updateDoor,
    isDrawingFlowPath,
    flowPathDoorId,
    flowPathDirection,
    startDrawingFlowPath,
    cancelDrawingFlowPath,
    isDrawingCorridor,
    setIsDrawingCorridor,
    setCorridorDrawStart,
    setCorridorWaypoints,
    setSelectedCorridorType,
  } = useGridStore();

  const [isOpen, setIsOpen] = useState(true);

  const materialDoors = doors.filter(d => d.has_inbound_material || d.has_outbound_material);
  const inboundDoors = materialDoors.filter(d => d.has_inbound_material);
  const outboundDoors = materialDoors.filter(d => d.has_outbound_material);

  const handleDrawFlowPath = (door: Door, direction: 'inbound' | 'outbound') => {
    // Cancel corridor drawing if active
    if (isDrawingCorridor) {
      setIsDrawingCorridor(false);
      setCorridorDrawStart(null);
      setCorridorWaypoints([]);
      setSelectedCorridorType(null);
    }
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

  if (materialDoors.length === 0) return null;

  const totalPaths = inboundDoors.length + outboundDoors.length;
  const drawnPaths = inboundDoors.filter(d => d.inbound_flow_points).length +
    outboundDoors.filter(d => d.outbound_flow_points).length;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg"
      >
        <h3 className="font-semibold text-gray-900">Inbound / Outbound Paths</h3>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            {drawnPaths}/{totalPaths} drawn
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 px-1">
            Draw the route material takes from each door to the first work area (inbound) or from the last work area out to a door (outbound). Click waypoints on the grid, double-click or Enter to finish.
          </p>

          {/* Inbound doors */}
          {inboundDoors.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide px-1">
                Inbound
              </div>
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
            </div>
          )}

          {/* Outbound doors */}
          {outboundDoors.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide px-1">
                Outbound
              </div>
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
        </div>
      )}
    </div>
  );
}
