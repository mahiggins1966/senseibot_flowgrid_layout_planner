import { useState } from 'react';
import { ChevronDown, ChevronUp, Route, RotateCcw, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
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
  } = useGridStore();

  const [isOpen, setIsOpen] = useState(true);

  // Doors that have inbound or outbound material checked
  const materialDoors = doors.filter(d => d.has_inbound_material || d.has_outbound_material);

  const handleDrawFlowPath = (door: Door, direction: 'inbound' | 'outbound') => {
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

  const inboundDoors = materialDoors.filter(d => d.has_inbound_material);
  const outboundDoors = materialDoors.filter(d => d.has_outbound_material);
  const drawnCount = materialDoors.filter(d =>
    (d.has_inbound_material && d.inbound_flow_points) ||
    (d.has_outbound_material && d.outbound_flow_points)
  ).length;
  const totalPaths = inboundDoors.length + outboundDoors.length;
  const drawnPaths = inboundDoors.filter(d => d.inbound_flow_points).length +
    outboundDoors.filter(d => d.outbound_flow_points).length;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg"
      >
        <h3 className="font-semibold text-gray-900">Material Flow Paths</h3>
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
          <p className="text-xs text-gray-600 px-1">
            Draw the path material takes from each door to the first work area (inbound) or from the last work area out a door (outbound). Click waypoints on the grid, double-click to finish.
          </p>

          {/* Inbound doors */}
          {inboundDoors.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide px-1 flex items-center gap-1.5">
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Inbound
              </div>
              {inboundDoors.map(door => (
                <div
                  key={`in-${door.id}`}
                  className={`p-3 rounded-lg border transition-colors ${
                    isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === 'inbound'
                      ? 'border-blue-500 bg-blue-50'
                      : door.inbound_flow_points
                        ? 'border-blue-200 bg-blue-50/50'
                        : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{door.name}</div>
                      <div className="text-xs text-gray-500">{door.inbound_percentage ?? 0}% of inbound volume</div>
                    </div>
                    {door.inbound_flow_points && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        ✓ drawn
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDrawFlowPath(door, 'inbound')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === 'inbound'
                          ? 'bg-blue-600 text-white'
                          : door.inbound_flow_points
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <Route className="w-3.5 h-3.5" />
                      {isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === 'inbound'
                        ? 'Cancel Drawing'
                        : door.inbound_flow_points ? 'Redraw Path' : 'Draw Inbound Path'}
                    </button>
                    {door.inbound_flow_points && (
                      <button
                        onClick={() => handleClearFlowPath(door, 'inbound')}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Outbound doors */}
          {outboundDoors.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide px-1 flex items-center gap-1.5">
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                Outbound
              </div>
              {outboundDoors.map(door => (
                <div
                  key={`out-${door.id}`}
                  className={`p-3 rounded-lg border transition-colors ${
                    isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === 'outbound'
                      ? 'border-orange-500 bg-orange-50'
                      : door.outbound_flow_points
                        ? 'border-orange-200 bg-orange-50/50'
                        : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{door.name}</div>
                      <div className="text-xs text-gray-500">{door.outbound_percentage ?? 0}% of outbound volume</div>
                    </div>
                    {door.outbound_flow_points && (
                      <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                        ✓ drawn
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDrawFlowPath(door, 'outbound')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === 'outbound'
                          ? 'bg-orange-600 text-white'
                          : door.outbound_flow_points
                            ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                      }`}
                    >
                      <Route className="w-3.5 h-3.5" />
                      {isDrawingFlowPath && flowPathDoorId === door.id && flowPathDirection === 'outbound'
                        ? 'Cancel Drawing'
                        : door.outbound_flow_points ? 'Redraw Path' : 'Draw Outbound Path'}
                    </button>
                    {door.outbound_flow_points && (
                      <button
                        onClick={() => handleClearFlowPath(door, 'outbound')}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
