import { useState, useEffect } from 'react';
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

  // Ensure doors are loaded and flow paths are applied from layout
  useEffect(() => {
    const loadDoorsAndFlowPaths = async () => {
      const { activeProjectId, activeLayoutId } = useGridStore.getState();
      
      // Load doors if needed
      let currentDoors = useGridStore.getState().doors;
      if (currentDoors.length === 0 && activeProjectId) {
        const { data, error } = await supabase
          .from('doors')
          .select('*')
          .eq('project_id', activeProjectId)
          .order('created_at', { ascending: true });
        if (!error && data) {
          currentDoors = data as Door[];
          useGridStore.getState().setDoors(currentDoors);
        }
      }

      // Load layout-specific flow paths and apply to doors in memory
      if (activeLayoutId && currentDoors.length > 0) {
        const { data: layoutData } = await supabase
          .from('layouts')
          .select('flow_paths')
          .eq('id', activeLayoutId)
          .single();

        const flowPaths = layoutData?.flow_paths || {};
        
        for (const door of currentDoors) {
          const inboundKey = `${door.id}_inbound`;
          const outboundKey = `${door.id}_outbound`;
          const inboundPoints = flowPaths[inboundKey] || null;
          const outboundPoints = flowPaths[outboundKey] || null;
          
          // Only update if different from current
          if (JSON.stringify(door.inbound_flow_points) !== JSON.stringify(inboundPoints) ||
              JSON.stringify(door.outbound_flow_points) !== JSON.stringify(outboundPoints)) {
            useGridStore.getState().updateDoor(door.id, {
              inbound_flow_points: inboundPoints,
              outbound_flow_points: outboundPoints,
            } as any);
          }
        }
      }
    };

    loadDoorsAndFlowPaths();
  }, []);

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
    const { activeLayoutId } = useGridStore.getState();
    if (!activeLayoutId) return;

    // Read current flow_paths from layout
    const { data: layoutData } = await supabase
      .from('layouts')
      .select('flow_paths')
      .eq('id', activeLayoutId)
      .single();

    const flowPaths = layoutData?.flow_paths || {};
    const key = `${door.id}_${direction}`;
    delete flowPaths[key];

    // Save back to layout
    const { error } = await supabase
      .from('layouts')
      .update({ flow_paths: flowPaths })
      .eq('id', activeLayoutId);

    if (!error) {
      const field = direction === 'inbound' ? 'inbound_flow_points' : 'outbound_flow_points';
      updateDoor(door.id, { [field]: null } as any);
    }
  };

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
