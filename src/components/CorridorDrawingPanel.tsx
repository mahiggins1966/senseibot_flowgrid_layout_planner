import React, { useState, useEffect, useRef } from 'react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { Trash2, Edit2, Check } from 'lucide-react';

export default function CorridorDrawingPanel() {
  const {
    isDrawingCorridor,
    selectedCorridorType,
    setIsDrawingCorridor,
    setSelectedCorridorType,
    setCorridorDrawStart,
    setCorridorWaypoints,
    corridors,
    deleteCorridor,
    setSelectedCorridor,
    selectedCorridor,
    settings,
    updateCorridor,
  } = useGridStore();

  const [editingCorridorId, setEditingCorridorId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [lastCorridorCount, setLastCorridorCount] = useState(corridors.length);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCorridorId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCorridorId]);

  useEffect(() => {
    if (corridors.length > lastCorridorCount) {
      const newCorridor = corridors[corridors.length - 1];
      setEditingCorridorId(newCorridor.id);
      setEditingName(newCorridor.name);
    }
    setLastCorridorCount(corridors.length);
  }, [corridors.length]);

  const handlePedestrianClick = () => {
    if (isDrawingCorridor && selectedCorridorType === 'pedestrian') {
      setIsDrawingCorridor(false);
      setSelectedCorridorType(null);
      setCorridorDrawStart(null);
      setCorridorWaypoints([]);
    } else {
      setIsDrawingCorridor(true);
      setSelectedCorridorType('pedestrian');
      setCorridorDrawStart(null);
      setCorridorWaypoints([]);
    }
  };

  const handleForkliftClick = () => {
    if (isDrawingCorridor && selectedCorridorType === 'forklift') {
      setIsDrawingCorridor(false);
      setSelectedCorridorType(null);
      setCorridorDrawStart(null);
      setCorridorWaypoints([]);
    } else {
      setIsDrawingCorridor(true);
      setSelectedCorridorType('forklift');
      setCorridorDrawStart(null);
      setCorridorWaypoints([]);
    }
  };

  const handleDeleteCorridor = async (id: string) => {
    const { error } = await supabase
      .from('corridors')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting corridor:', error);
    } else {
      deleteCorridor(id);
    }
  };

  const handleStartEdit = (corridor: typeof corridors[0]) => {
    setEditingCorridorId(corridor.id);
    setEditingName(corridor.name);
  };

  const handleSaveEdit = async () => {
    if (!editingCorridorId || !editingName.trim()) {
      setEditingCorridorId(null);
      return;
    }

    const { error } = await supabase
      .from('corridors')
      .update({ name: editingName.trim() })
      .eq('id', editingCorridorId);

    if (error) {
      console.error('Error updating corridor:', error);
    } else {
      updateCorridor(editingCorridorId, { name: editingName.trim() });
    }

    setEditingCorridorId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingCorridorId(null);
    setEditingName('');
  };

  const calculateCorridorLength = (corridor: typeof corridors[0]) => {
    const pts = corridor.points && corridor.points.length >= 2
      ? corridor.points
      : [{ x: corridor.start_grid_x, y: corridor.start_grid_y }, { x: corridor.end_grid_x, y: corridor.end_grid_y }];
    let totalSquares = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = Math.abs(pts[i + 1].x - pts[i].x);
      const dy = Math.abs(pts[i + 1].y - pts[i].y);
      totalSquares += Math.max(dx, dy) + (i === 0 ? 1 : 0);
    }
    return totalSquares * settings.squareSize;
  };

  const pedestrianCorridors = corridors.filter(c => c.type === 'pedestrian');
  const forkliftCorridors = corridors.filter(c => c.type === 'forklift');

  const totalPedestrianLength = pedestrianCorridors.reduce(
    (sum, c) => sum + calculateCorridorLength(c),
    0
  );

  const totalForkliftLength = forkliftCorridors.reduce(
    (sum, c) => sum + calculateCorridorLength(c),
    0
  );

  const handleStopDrawing = () => {
    setIsDrawingCorridor(false);
    setSelectedCorridorType(null);
    setCorridorDrawStart(null);
    setCorridorWaypoints([]);
  };

  return (
    <div>
      <button
        onClick={handlePedestrianClick}
        style={{
          display: 'block',
          width: '100%',
          padding: '12px',
          marginBottom: '8px',
          backgroundColor: isDrawingCorridor && selectedCorridorType === 'pedestrian' ? '#22C55E' : '#86EFAC',
          border: '2px solid #333',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '14px',
          transition: 'all 0.2s',
        }}
      >
        {isDrawingCorridor && selectedCorridorType === 'pedestrian' ? '✓ ' : ''}
        Pedestrian Walkway (1 square wide)
      </button>
      <button
        onClick={handleForkliftClick}
        style={{
          display: 'block',
          width: '100%',
          padding: '12px',
          backgroundColor: isDrawingCorridor && selectedCorridorType === 'forklift' ? '#F97316' : '#FDBA74',
          border: '2px solid #333',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '14px',
          transition: 'all 0.2s',
        }}
      >
        {isDrawingCorridor && selectedCorridorType === 'forklift' ? '✓ ' : ''}
        Forklift / Cart Path (2 squares wide)
      </button>

      {isDrawingCorridor && (
        <button
          onClick={handleStopDrawing}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px',
            marginTop: '8px',
            backgroundColor: '#EF4444',
            border: '2px solid #333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            color: 'white',
            transition: 'all 0.2s',
          }}
        >
          Stop Drawing
        </button>
      )}

      <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', marginBottom: '16px' }}>
        Click a button, then click on the grid to place waypoints. Add bends by clicking corners. Double-click or press Enter to finish. Press Escape to cancel.
      </p>

      {corridors.length > 0 && (
        <>
          <div style={{
            backgroundColor: '#F3F4F6',
            padding: '8px',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '13px',
            fontWeight: 'bold',
          }}>
            Summary: {corridors.length} corridor{corridors.length !== 1 ? 's' : ''}
            {pedestrianCorridors.length > 0 && (
              <> | Pedestrian: {totalPedestrianLength} ft</>
            )}
            {forkliftCorridors.length > 0 && (
              <> | Forklift: {totalForkliftLength} ft</>
            )}
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {corridors.map((corridor) => {
              const length = calculateCorridorLength(corridor);
              const isSelected = selectedCorridor?.id === corridor.id;
              const isEditing = editingCorridorId === corridor.id;

              return (
                <div
                  key={corridor.id}
                  onClick={() => !isEditing && setSelectedCorridor(corridor)}
                  style={{
                    padding: '8px',
                    marginBottom: '6px',
                    backgroundColor: isSelected ? '#DBEAFE' : 'white',
                    border: `2px solid ${isSelected ? '#3B82F6' : '#E5E7EB'}`,
                    borderRadius: '4px',
                    cursor: isEditing ? 'default' : 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit();
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          border: '2px solid #3B82F6',
                          borderRadius: '4px',
                          outline: 'none',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>
                        {corridor.name}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                      {corridor.type === 'pedestrian' ? 'Pedestrian' : 'Forklift'} • {length} ft
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdit();
                          }}
                          style={{
                            padding: '4px',
                            backgroundColor: '#D1FAE5',
                            border: '1px solid #10B981',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Save name"
                        >
                          <Check size={14} color="#10B981" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(corridor);
                          }}
                          style={{
                            padding: '4px',
                            backgroundColor: '#E0E7FF',
                            border: '1px solid #6366F1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Rename corridor"
                        >
                          <Edit2 size={14} color="#6366F1" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCorridor(corridor.id);
                          }}
                          style={{
                            padding: '4px',
                            backgroundColor: '#FEE2E2',
                            border: '1px solid #DC2626',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Delete corridor"
                        >
                          <Trash2 size={14} color="#DC2626" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
