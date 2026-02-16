import { useState, useEffect, useMemo } from 'react';
import { DoorOpen, Trash2, X, AlertCircle } from 'lucide-react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { Door, DoorType } from '../types';

const DOOR_TYPE_OPTIONS: { value: DoorType; label: string; color: string }[] = [
  { value: 'hangar', label: 'Hangar/Vehicle Door', color: '#3B82F6' },
  { value: 'loading-dock', label: 'Loading Dock', color: '#F97316' },
  { value: 'personnel', label: 'Personnel Door', color: '#6B7280' },
  { value: 'emergency', label: 'Emergency Exit', color: '#EF4444' },
];

export function DoorControls() {
  const {
    doors,
    setDoors,
    addDoor,
    updateDoor,
    deleteDoor,
    selectedDoor,
    setSelectedDoor,
    isAddingDoor,
    setIsAddingDoor,
    settings,
    canInteractWithDoors,
  } = useGridStore();

  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    loadDoors();
  }, []);

  const loadDoors = async () => {
    const { activeProjectId } = useGridStore.getState();
    const { data, error } = await supabase
      .from('doors')
      .select('*')
      .eq('project_id', activeProjectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading doors:', error);
      return;
    }

    if (data) {
      setDoors(data as Door[]);
    }
  };

  const volumeTotals = useMemo(() => {
    const inboundTotal = doors.reduce((sum, door) => {
      return sum + (door.has_inbound_material && door.inbound_percentage ? door.inbound_percentage : 0);
    }, 0);

    const outboundTotal = doors.reduce((sum, door) => {
      return sum + (door.has_outbound_material && door.outbound_percentage ? door.outbound_percentage : 0);
    }, 0);

    return { inboundTotal, outboundTotal };
  }, [doors]);

  const handleAddDoor = () => {
    if (!canInteractWithDoors()) return;
    setIsAddingDoor(true);
    setSelectedDoor(null);
  };

  const handleCancelAddDoor = () => {
    if (!canInteractWithDoors()) return;
    setIsAddingDoor(false);
  };

  const handleDeleteDoor = async (door: Door) => {
    if (!canInteractWithDoors()) return;
    const { error } = await supabase
      .from('doors')
      .delete()
      .eq('id', door.id);

    if (error) {
      console.error('Error deleting door:', error);
      return;
    }

    deleteDoor(door.id);
    if (selectedDoor?.id === door.id) {
      setSelectedDoor(null);
    }
  };

  const handleUpdateType = async (door: Door, type: DoorType) => {
    if (!canInteractWithDoors()) return;
    const { error } = await supabase
      .from('doors')
      .update({ type })
      .eq('id', door.id);

    if (error) {
      console.error('Error updating door type:', error);
      return;
    }

    updateDoor(door.id, { type });
  };

  const handleUpdateUsage = async (door: Door, field: keyof Door, value: boolean | number | null) => {
    if (!canInteractWithDoors()) return;
    const { error } = await supabase
      .from('doors')
      .update({ [field]: value })
      .eq('id', door.id);

    if (error) {
      console.error('Error updating door usage:', error);
      return;
    }

    updateDoor(door.id, { [field]: value });
  };

  const handleStartEditName = (door: Door) => {
    setEditingName(door.id);
    setTempName(door.name);
  };

  const handleSaveName = async (door: Door) => {
    if (!canInteractWithDoors()) return;
    const newName = tempName.trim() || `Door ${doors.indexOf(door) + 1}`;

    const { error } = await supabase
      .from('doors')
      .update({ name: newName })
      .eq('id', door.id);

    if (error) {
      console.error('Error updating door name:', error);
      return;
    }

    updateDoor(door.id, { name: newName });
    setEditingName(null);
  };

  const handleCancelEditName = () => {
    setEditingName(null);
    setTempName('');
  };

  const getDoorWidthDisplay = (door: Door) => {
    const widthInFeet = door.width * settings.squareSize;
    if (settings.measurementSystem === 'US') {
      return `${door.width} squares (${Math.round(widthInFeet)} ft)`;
    } else {
      const widthInMeters = widthInFeet * 0.3048;
      return `${door.width} squares (${widthInMeters.toFixed(1)} m)`;
    }
  };

  const getTotalSummary = () => {
    if (doors.length === 0) return null;

    const summaryParts = doors.map(door => {
      const widthInFeet = door.width * settings.squareSize;
      if (settings.measurementSystem === 'US') {
        return `${door.name} ${Math.round(widthInFeet)}ft`;
      } else {
        const widthInMeters = widthInFeet * 0.3048;
        return `${door.name} ${widthInMeters.toFixed(1)}m`;
      }
    });

    return `Openings: ${doors.length} marked (${summaryParts.join(', ')})`;
  };

  const getDoorTypeColor = (type: DoorType) => {
    return DOOR_TYPE_OPTIONS.find(opt => opt.value === type)?.color || '#6B7280';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Mark Doors and Openings</h3>
        <span className="text-sm text-gray-600">
          Doors: {doors.length} marked
        </span>
      </div>

      <p className="text-sm text-gray-600">
        Mark where material enters and exits the facility. Click and drag along the outer edge to create a door opening.
      </p>

      <button
        onClick={isAddingDoor ? handleCancelAddDoor : handleAddDoor}
        className={`w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
          isAddingDoor
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isAddingDoor ? (
          <>
            <X className="w-4 h-4" />
            Cancel Adding Door
          </>
        ) : (
          <>
            <DoorOpen className="w-4 h-4" />
            Add Door/Opening
          </>
        )}
      </button>

      {isAddingDoor && (
        <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-md p-3">
          <p><strong>Click and drag</strong> along the outer edge of the facility to set the door width.</p>
        </div>
      )}

      {getTotalSummary() && (
        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-3">
          {getTotalSummary()}
        </div>
      )}

      {doors.length > 0 && doors.some(d => d.has_inbound_material || d.has_outbound_material) && (
        <div className="space-y-2 text-xs">
          <div className={`flex items-center justify-between p-2 rounded border ${
            Math.abs(volumeTotals.inboundTotal - 100) < 0.01 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
          }`}>
            <span className="font-medium">Inbound Volume:</span>
            <span className={Math.abs(volumeTotals.inboundTotal - 100) < 0.01 ? 'text-green-700' : 'text-orange-700'}>
              {volumeTotals.inboundTotal.toFixed(1)}% assigned {Math.abs(volumeTotals.inboundTotal - 100) >= 0.01 && `(${(100 - volumeTotals.inboundTotal).toFixed(1)}% unassigned)`}
            </span>
          </div>
          <div className={`flex items-center justify-between p-2 rounded border ${
            Math.abs(volumeTotals.outboundTotal - 100) < 0.01 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
          }`}>
            <span className="font-medium">Outbound Volume:</span>
            <span className={Math.abs(volumeTotals.outboundTotal - 100) < 0.01 ? 'text-green-700' : 'text-orange-700'}>
              {volumeTotals.outboundTotal.toFixed(1)}% assigned {Math.abs(volumeTotals.outboundTotal - 100) >= 0.01 && `(${(100 - volumeTotals.outboundTotal).toFixed(1)}% unassigned)`}
            </span>
          </div>
        </div>
      )}

      {doors.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          <h4 className="text-sm font-medium text-gray-700">Doors</h4>
          {doors.map((door) => (
            <div
              key={door.id}
              className={`p-3 rounded-lg border transition-colors ${
                selectedDoor?.id === door.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => setSelectedDoor(door)}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {editingName === door.id ? (
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={() => handleSaveName(door)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName(door);
                        if (e.key === 'Escape') handleCancelEditName();
                      }}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditName(door);
                      }}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 text-left"
                    >
                      {door.name}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDoor(door);
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-gray-600 font-medium">
                  {getDoorWidthDisplay(door)}
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Type</label>
                  <select
                    value={door.type}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleUpdateType(door, e.target.value as DoorType);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      borderLeft: `4px solid ${getDoorTypeColor(door.type)}`
                    }}
                  >
                    {DOOR_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 font-medium mb-2">Door Usage</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={door.has_inbound_material}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleUpdateUsage(door, 'has_inbound_material', e.target.checked);
                          if (!e.target.checked) {
                            handleUpdateUsage(door, 'inbound_percentage', null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      <span className="text-xs text-gray-700">Inbound material (cargo/material enters)</span>
                    </label>

                    {door.has_inbound_material && (
                      <div className="ml-5 flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={door.inbound_percentage ?? ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            const val = e.target.value === '' ? null : parseFloat(e.target.value);
                            handleUpdateUsage(door, 'inbound_percentage', val);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="0"
                          className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-600">% of total inbound</span>
                      </div>
                    )}

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={door.has_outbound_material}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleUpdateUsage(door, 'has_outbound_material', e.target.checked);
                          if (!e.target.checked) {
                            handleUpdateUsage(door, 'outbound_percentage', null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      <span className="text-xs text-gray-700">Outbound material (cargo/material exits)</span>
                    </label>

                    {door.has_outbound_material && (
                      <div className="ml-5 flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={door.outbound_percentage ?? ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            const val = e.target.value === '' ? null : parseFloat(e.target.value);
                            handleUpdateUsage(door, 'outbound_percentage', val);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="0"
                          className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-600">% of total outbound</span>
                      </div>
                    )}

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={door.has_vehicle_access}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleUpdateUsage(door, 'has_vehicle_access', e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      <span className="text-xs text-gray-700">Vehicles / aircraft (trucks, forklifts, aircraft access)</span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={door.is_personnel_only}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleUpdateUsage(door, 'is_personnel_only', e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      <span className="text-xs text-gray-700">Personnel only (no material flow)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
