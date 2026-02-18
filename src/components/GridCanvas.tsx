// pipeline test v1
import { useRef, useMemo, useState, useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { useGestures } from '../hooks/useGestures';
import { getGridCoordinate, getRowLabel, getColumnLabel } from '../utils/coordinates';
import { supabase } from '../lib/supabase';
import { Zone, PlacedObject, GridCoordinate, Door, DoorType, Corridor } from '../types';
import { getActivityColor, getActivityBorderColor, getCorridorColor, getCorridorBorderColor, OSHA_COLORS } from '../utils/oshaColors';
import { buildCorridorGraph, findNearestNode, findPath, routeFlowLeg, getDoorGridCenter, buildPolylinePath, buildBezierPath } from '../utils/corridorGraph';

const CELL_SIZE = 40;
const MARGIN = 40;

interface HoveredSquare {
  row: number;
  col: number;
  label: string;
}

export function GridCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const {
    settings,
    viewport,
    setSelectedSquare,
    getGridDimensions,
    zones,
    placedObjects,
    doors,
    corridors,
    activities,
    activityRelationships,
    setZones,
    setPlacedObjects,
    setDoors,
    setCorridors,
    addPlacedObject,
    updatePlacedObject,
    addZone,
    addDoor,
    addCorridor,
    isDrawingZone,
    setIsDrawingZone,
    selectedActivityForZone,
    setSelectedActivityForZone,
    zoneDrawWidth,
    zoneDrawHeight,
    resizingZone,
    resizingZoneEdge,
    setResizingZone,
    draggingZone,
    setDraggingZone,
    updateZone,
    draggingObject,
    dragPreviewPosition,
    setDragPreviewPosition,
    repositioningObject,
    setRepositioningObject,
    setSelectedObject,
    setSelectedZone,
    setSelectedDoor,
    setSelectedCorridor,
    isAddingDoor,
    setIsAddingDoor,
    doorDrawStart,
    setDoorDrawStart,
    doorDrawEnd,
    setDoorDrawEnd,
    updateDoor,
    draggingDoor,
    setDraggingDoor,
    resizingDoor,
    setResizingDoor,
    resizeEdge,
    paintMode,
    setPaintMode,
    paintedSquares,
    paintSquare: storePaintSquare,
    unpaintSquare: storeUnpaintSquare,
    setPaintedSquares,
    canInteractWithDoors,
    canInteractWithZones,
    canInteractWithObjects,
    canPaintSquares,
    isDrawingCorridor,
    setIsDrawingCorridor,
    corridorDrawStart,
    setCorridorDrawStart,
    corridorWaypoints,
    addCorridorWaypoint,
    setCorridorWaypoints,
    selectedCorridorType,
    setSelectedCorridorType,
    hoveredSquare,
    setHoveredSquare,
    updateCorridor,
    flowOverlayEnabled,
  } = useGridStore();
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [draggedObjectOriginalPos, setDraggedObjectOriginalPos] = useState<{ row: number; col: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [cursorGridPosition, setCursorGridPosition] = useState<{ row: number; col: number } | null>(null);

  const [holdTimer, setHoldTimer] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [holdTarget, setHoldTarget] = useState<{ type: 'zone' | 'object'; item: Zone | PlacedObject } | null>(null);
  const [moveStatus, setMoveStatus] = useState<{ name: string; targetCell: string } | null>(null);
  const [originalPosition, setOriginalPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [hoveredCorridor, setHoveredCorridor] = useState<string | null>(null);
  const [hoveredDoor, setHoveredDoor] = useState<string | null>(null);
  const [corridorPreviewEnd, setCorridorPreviewEnd] = useState<{ row: number; col: number } | null>(null);
  const [layoutOnlyToast, setLayoutOnlyToast] = useState(false);
  const layoutOnlyTimer = useRef<number | null>(null);

  const showLayoutOnlyToast = () => {
    if (layoutOnlyTimer.current) clearTimeout(layoutOnlyTimer.current);
    setLayoutOnlyToast(true);
    layoutOnlyTimer.current = window.setTimeout(() => setLayoutOnlyToast(false), 2500);
  };

  const dragCleanupRef = useRef<(() => void) | null>(null);

  // Helper: Convert screen coordinates to SVG grid coordinates
  // Uses SVG's built-in matrix to avoid viewBox scaling bugs
  // Reads viewport from store directly to avoid stale closures
  const screenToGrid = (clientX: number, clientY: number): { row: number; col: number; svgX: number; svgY: number } => {
    if (!svgRef.current) return { row: 0, col: 0, svgX: 0, svgY: 0 };
    const vp = useGridStore.getState().viewport;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) {
      // Fallback if CTM unavailable
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = (clientX - rect.left - vp.panX) / vp.zoom;
      const svgY = (clientY - rect.top - vp.panY) / vp.zoom;
      return { row: Math.floor((svgY - MARGIN) / CELL_SIZE), col: Math.floor((svgX - MARGIN) / CELL_SIZE), svgX, svgY };
    }
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    // svgPt is now in viewBox space; undo the viewport transform
    const gridSpaceX = (svgPt.x - vp.panX) / vp.zoom;
    const gridSpaceY = (svgPt.y - vp.panY) / vp.zoom;
    return {
      row: Math.floor((gridSpaceY - MARGIN) / CELL_SIZE),
      col: Math.floor((gridSpaceX - MARGIN) / CELL_SIZE),
      svgX: gridSpaceX,
      svgY: gridSpaceY,
    };
  };

  useGestures(svgRef);

  const gridDimensions = useMemo(() => getGridDimensions(), [settings]);

  // Calculate related zones that should glow when placing a zone
  const relatedZonesGlow = useMemo(() => {
    if (!isDrawingZone || !selectedActivityForZone) return new Map();

    const glowMap = new Map<string, { type: 'must-be-close' | 'prefer-close' | 'keep-apart'; activity: typeof activities[0] }>();

    activityRelationships.forEach(rel => {
      let relatedActivityId: string | null = null;

      if (rel.activity_a_id === selectedActivityForZone) {
        relatedActivityId = rel.activity_b_id;
      } else if (rel.activity_b_id === selectedActivityForZone) {
        relatedActivityId = rel.activity_a_id;
      }

      if (relatedActivityId && (rel.rating === 'must-be-close' || rel.rating === 'prefer-close' || rel.rating === 'keep-apart')) {
        const relatedZone = zones.find(z => z.activity_id === relatedActivityId);
        if (relatedZone) {
          const activity = activities.find(a => a.id === relatedActivityId);
          if (activity) {
            glowMap.set(relatedZone.id, { type: rel.rating as any, activity });
          }
        }
      }
    });

    return glowMap;
  }, [isDrawingZone, selectedActivityForZone, activityRelationships, zones, activities]);

  // Calculate distances from cursor to related zones
  const zoneDistances = useMemo(() => {
    if (!cursorGridPosition || relatedZonesGlow.size === 0) return new Map();

    const distances = new Map<string, number>();

    relatedZonesGlow.forEach((_, zoneId) => {
      const zone = zones.find(z => z.id === zoneId);
      if (!zone) return;

      // Calculate distance from cursor to nearest point of zone
      const zoneCenterRow = zone.grid_y + zone.grid_height / 2;
      const zoneCenterCol = zone.grid_x + zone.grid_width / 2;

      // Simple distance calculation (could be improved to edge-to-edge)
      const distance = Math.round(
        Math.sqrt(
          Math.pow(cursorGridPosition.col - zoneCenterCol, 2) +
          Math.pow(cursorGridPosition.row - zoneCenterRow, 2)
        )
      );

      distances.set(zoneId, distance);
    });

    return distances;
  }, [cursorGridPosition, relatedZonesGlow, zones]);

  const activeLayoutId = useGridStore(state => state.activeLayoutId);

  useEffect(() => {
    loadData();
    return () => {
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
        dragCleanupRef.current = null;
      }
    };
  }, [activeLayoutId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isDrawingCorridor && corridorWaypoints.length >= 2 && selectedCorridorType) {
        createCorridorFromWaypoints(corridorWaypoints, selectedCorridorType);
        return;
      }
      if (e.key === 'Escape') {
        if (dragCleanupRef.current) {
          dragCleanupRef.current();
          dragCleanupRef.current = null;
        }
        if (isDrawingCorridor) {
          setIsDrawingCorridor(false);
          setCorridorDrawStart(null);
          setCorridorWaypoints([]);
          setSelectedCorridorType(null);
        }
        if (isDrawingZone) {
          setIsDrawingZone(false);
          setSelectedActivityForZone(null);
        }
        if (paintMode) {
          setPaintMode(null);
        }
        if (isAddingDoor) {
          setIsAddingDoor(false);
          setDoorDrawStart(null);
          setDoorDrawEnd(null);
        }
        if (isDraggingObject) {
          setIsDraggingObject(false);
          setRepositioningObject(null);
          setDragPreviewPosition(null);
          setDraggedObjectOriginalPos(null);
          setDragOffset(null);
        }
        if (resizingZone) {
          setResizingZone(null, null);
          setDragOffset(null);
        }
        if (draggingZone) {
          setDraggingZone(null);
          setDragOffset(null);
          setMoveStatus(null);
          setOriginalPosition(null);
        }
        if (holdTimer) {
          clearTimeout(holdTimer);
          setHoldTimer(null);
        }
        setIsHolding(false);
        setHoldTarget(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawingZone, paintMode, isAddingDoor, isDraggingObject, isDrawingCorridor, corridorWaypoints, selectedCorridorType, setIsDrawingZone, setPaintMode, setSelectedActivityForZone, setIsAddingDoor, setDoorDrawStart, setDoorDrawEnd, setIsDrawingCorridor, setCorridorDrawStart, setCorridorWaypoints, setSelectedCorridorType, draggingZone, setDraggingZone, resizingZone, setResizingZone, setDragOffset, holdTimer]);


  const loadData = async () => {
    const { activeProjectId, activeLayoutId } = useGridStore.getState();
    const [zonesResult, objectsResult, doorsResult, corridorsResult, paintedResult] = await Promise.all([
      supabase.from('zones').select('*').eq('layout_id', activeLayoutId).order('created_at', { ascending: true }),
      supabase.from('placed_objects').select('*').eq('layout_id', activeLayoutId).order('created_at', { ascending: true }),
      supabase.from('doors').select('*').eq('project_id', activeProjectId).order('created_at', { ascending: true }),
      supabase.from('corridors').select('*').eq('layout_id', activeLayoutId).order('created_at', { ascending: true }),
      supabase.from('painted_squares').select('*').eq('project_id', activeProjectId).order('created_at', { ascending: true }),
    ]);

    if (zonesResult.data) {
      setZones(zonesResult.data as Zone[]);
    }
    if (objectsResult.data) {
      setPlacedObjects(objectsResult.data as PlacedObject[]);
    }
    if (doorsResult.data) {
      setDoors(doorsResult.data as Door[]);
    }
    if (corridorsResult.data) {
      // Auto-migrate: add points array from start/end for legacy corridors
      const migratedCorridors = (corridorsResult.data as Corridor[]).map(c => {
        if (!c.points || c.points.length === 0) {
          return { ...c, points: [{ x: c.start_grid_x, y: c.start_grid_y }, { x: c.end_grid_x, y: c.end_grid_y }] };
        }
        return c;
      });
      setCorridors(migratedCorridors);
    }
    if (paintedResult.data) {
      const paintedMap = new Map();
      paintedResult.data.forEach((square: any) => {
        const key = `${square.row}-${square.col}`;
        paintedMap.set(key, {
          row: square.row,
          col: square.col,
          type: square.type,
          label: square.label,
        });
      });
      setPaintedSquares(paintedMap);
    }
  };

  const paintSquare = async (row: number, col: number) => {
    storePaintSquare(row, col);

    if (paintMode === 'permanent' || paintMode === 'semi-fixed') {
      const { activeProjectId } = useGridStore.getState();
      await supabase.from('painted_squares').upsert({
        row,
        col,
        type: paintMode,
        project_id: activeProjectId,
      }, {
        onConflict: 'row,col'
      });
    }
  };

  const unpaintSquare = async (row: number, col: number) => {
    storeUnpaintSquare(row, col);

    const { activeProjectId: projId } = useGridStore.getState();
    await supabase.from('painted_squares').delete().match({ row, col, project_id: projId });
  };

  const getBoundaryEdge = (row: number, col: number): 'top' | 'bottom' | 'left' | 'right' | null => {
    const { rows, cols } = gridDimensions;

    if (row === 0) return 'top';
    if (row === rows - 1) return 'bottom';
    if (col === 0) return 'left';
    if (col === cols - 1) return 'right';

    return null;
  };

  const getDoorColor = (type: DoorType): string => {
    const colors = {
      'hangar': '#3B82F6',
      'loading-dock': '#F97316',
      'personnel': '#6B7280',
      'emergency': '#EF4444',
    };
    return colors[type];
  };

  const calculateDoorWidth = (start: GridCoordinate, end: GridCoordinate, edge: 'top' | 'bottom' | 'left' | 'right'): number => {
    if (edge === 'top' || edge === 'bottom') {
      return Math.abs(end.col - start.col) + 1;
    } else {
      return Math.abs(end.row - start.row) + 1;
    }
  };

  const createDoor = async (startRow: number, startCol: number, endRow: number, endCol: number, edge: 'top' | 'bottom' | 'left' | 'right') => {
    const width = calculateDoorWidth(
      { row: startRow, col: startCol, label: '' },
      { row: endRow, col: endCol, label: '' },
      edge
    );

    const gridX = Math.min(startCol, endCol);
    const gridY = Math.min(startRow, endRow);

    const { activeProjectId: pid } = useGridStore.getState();
    const { data, error } = await supabase
      .from('doors')
      .insert([{
        name: `Door ${doors.length + 1}`,
        grid_x: gridX,
        grid_y: gridY,
        width,
        type: 'personnel',
        edge,
        project_id: pid,
      }])
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating door:', error);
      return;
    }

    if (data) {
      const newDoor = data as Door;
      addDoor(newDoor);
      setSelectedDoor(newDoor);
      setIsAddingDoor(false);
      setDoorDrawStart(null);
      setDoorDrawEnd(null);
    }
  };

  const handleSquareMouseDown = (e: React.MouseEvent, row: number, col: number) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) return;

    setIsMouseDown(true);

    // CORRIDOR HANDLING - MULTI-POINT WAYPOINT DRAWING
    if (isDrawingCorridor && selectedCorridorType) {
      if (!canInteractWithZones()) return;

      const waypoints = useGridStore.getState().corridorWaypoints;

      if (waypoints.length === 0) {
        // First click — place first waypoint
        addCorridorWaypoint({ row, col });
        setCorridorDrawStart({ row, col, label: getGridCoordinate(row, col).label });
      } else {
        // Subsequent click — snap to H/V from previous waypoint
        const prev = waypoints[waypoints.length - 1];
        const deltaX = Math.abs(col - prev.col);
        const deltaY = Math.abs(row - prev.row);
        const snappedRow = deltaX >= deltaY ? prev.row : row;
        const snappedCol = deltaX >= deltaY ? col : prev.col;

        // Double-click finishes the corridor (even if snapped pos matches last point)
        if (e.detail >= 2 && waypoints.length >= 2) {
          createCorridorFromWaypoints(waypoints, selectedCorridorType);
          return;
        }

        // Skip if same as previous point
        if (snappedRow === prev.row && snappedCol === prev.col) return;

        addCorridorWaypoint({ row: snappedRow, col: snappedCol });
      }
      return;
    }

    if (isAddingDoor) {
      if (!canInteractWithDoors()) return;
      const edge = getBoundaryEdge(row, col);
      if (edge) {
        setDoorDrawStart({ row, col, label: getGridCoordinate(row, col).label });
        setDoorDrawEnd({ row, col, label: '' });
      }
      return;
    }

    if (paintMode) {
      if (!canPaintSquares()) return;
      if (paintMode === 'clear') {
        unpaintSquare(row, col);
      } else {
        paintSquare(row, col);
      }
      return;
    }

    if (isDrawingZone) {
      if (!canInteractWithZones()) return;
      createZone({ row, col, label: getGridCoordinate(row, col).label });
      return;
    }

    const coordinate = getGridCoordinate(row, col);
    setSelectedSquare(coordinate);
  };

  const handleSquareMouseUp = (e: React.MouseEvent, row: number, col: number) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) return;

    setIsMouseDown(false);

    // CORRIDOR: during waypoint drawing, mouseUp is a no-op (clicks handled in mouseDown)
    if (isDrawingCorridor) return;

    if (isAddingDoor && doorDrawStart) {
      if (!canInteractWithDoors()) return;
      const edge = getBoundaryEdge(row, col);
      if (edge && edge === getBoundaryEdge(doorDrawStart.row, doorDrawStart.col)) {
        createDoor(doorDrawStart.row, doorDrawStart.col, row, col, edge);
      } else {
        setDoorDrawStart(null);
        setDoorDrawEnd(null);
      }
      return;
    }
  };

  const createCorridorFromWaypoints = async (waypoints: Array<{ row: number; col: number }>, type: 'pedestrian' | 'forklift') => {
    if (waypoints.length < 2) return;

    const width = type === 'pedestrian' ? 1 : 2;
    const color = getCorridorColor(type);
    const defaultName = `Corridor ${corridors.length + 1}`;
    const points = waypoints.map(wp => ({ x: wp.col, y: wp.row }));
    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];

    const { activeLayoutId: lid } = useGridStore.getState();
    const { data, error } = await supabase
      .from('corridors')
      .insert({
        name: defaultName,
        type,
        start_grid_x: first.col,
        start_grid_y: first.row,
        end_grid_x: last.col,
        end_grid_y: last.row,
        width,
        color,
        layout_id: lid,
        points,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating corridor:', error);
      const fallbackCorridor: Corridor = {
        id: `temp-${Date.now()}`,
        name: defaultName,
        type,
        start_grid_x: first.col,
        start_grid_y: first.row,
        end_grid_x: last.col,
        end_grid_y: last.row,
        width,
        color,
        created_at: new Date().toISOString(),
        points,
      };
      addCorridor(fallbackCorridor);
    } else if (data) {
      addCorridor(data as Corridor);
    }

    // Reset drawing state but stay in drawing mode for next corridor
    setCorridorDrawStart(null);
    setCorridorWaypoints([]);
  };

  const createZone = async (clickPosition: GridCoordinate) => {
    const startX = clickPosition.col;
    const startY = clickPosition.row;
    const width = zoneDrawWidth;
    const height = zoneDrawHeight;

    if (startX + width > gridDimensions.cols || startY + height > gridDimensions.rows) {
      alert('Zone does not fit at this location. Try a different position or adjust the size.');
      return;
    }

    for (let r = startY; r < startY + height; r++) {
      for (let c = startX; c < startX + width; c++) {
        const key = `${r}-${c}`;
        const painted = paintedSquares.get(key);
        if (painted && painted.type === 'permanent') {
          alert('Cannot place zones on permanent (dark gray) squares. Try a different location.');
          return;
        }
      }
    }

    let zoneName = `Zone ${zones.length + 1}`;
    let zoneColor = getActivityColor('work-area');
    let activityId: string | undefined = undefined;

    if (selectedActivityForZone) {
      const activity = activities.find(a => a.id === selectedActivityForZone);
      if (activity) {
        zoneName = activity.name;
        activityId = activity.id;
        zoneColor = activity.color || getActivityColor(activity.type);
      }
    }

    const { activeLayoutId: zoneLayoutId } = useGridStore.getState();
    const { data, error } = await supabase
      .from('zones')
      .insert([{
        name: zoneName,
        grid_x: startX,
        grid_y: startY,
        grid_width: width,
        grid_height: height,
        color: zoneColor,
        group_type: 'flexible',
        label_align: 'center',
        activity_id: activityId,
        layout_id: zoneLayoutId,
      }])
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating zone:', error);
      return;
    }

    if (data) {
      const newZone = data as Zone;
      addZone(newZone);
      setSelectedZone(newZone);
      setIsDrawingZone(false);
      setSelectedActivityForZone(null);
    }
  };

  const handleSquareMouseEnter = (e: React.MouseEvent, row: number, col: number) => {
    const coordinate = getGridCoordinate(row, col);
    setHoveredSquare({ row, col, label: coordinate.label });

    // Update cursor position for distance calculations
    if (isDrawingZone && selectedActivityForZone) {
      setCursorGridPosition({ row, col });
    }

    if (draggingObject || repositioningObject) {
      setDragPreviewPosition({ row, col, label: coordinate.label });
    }

    if (isAddingDoor && doorDrawStart && isMouseDown) {
      const edge = getBoundaryEdge(row, col);
      const startEdge = getBoundaryEdge(doorDrawStart.row, doorDrawStart.col);
      if (edge === startEdge) {
        setDoorDrawEnd({ row, col, label: '' });
      }
    }

    if (paintMode && isMouseDown) {
      if (paintMode === 'clear') {
        unpaintSquare(row, col);
      } else {
        paintSquare(row, col);
      }
    }
  };

  const handleSquareMouseLeave = () => {
    setHoveredSquare(null);
    setCursorGridPosition(null);
  };


  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!svgRef.current || !dragPreviewPosition) return;

    const { row, col } = dragPreviewPosition;

    if (repositioningObject) {
      const isOutOfBounds = col < 0 || row < 0 ||
        col >= gridDimensions.cols || row >= gridDimensions.rows ||
        col + repositioningObject.grid_width > gridDimensions.cols ||
        row + repositioningObject.grid_height > gridDimensions.rows;

      const isOnPermanent = !isOutOfBounds && (() => {
        for (let r = row; r < row + repositioningObject.grid_height; r++) {
          for (let c = col; c < col + repositioningObject.grid_width; c++) {
            const key = `${r}-${c}`;
            const painted = paintedSquares.get(key);
            if (painted && painted.type === 'permanent') {
              return true;
            }
          }
        }
        return false;
      })();

      if (isOutOfBounds || isOnPermanent) {
        setRepositioningObject(null);
        setDragPreviewPosition(null);
        return;
      }

      const { data, error } = await supabase
        .from('placed_objects')
        .update({
          grid_x: col,
          grid_y: row,
        })
        .eq('id', repositioningObject.id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error repositioning object:', error);
      } else if (data) {
        updatePlacedObject(repositioningObject.id, data as PlacedObject);
      }

      setRepositioningObject(null);
      setDragPreviewPosition(null);
    } else if (draggingObject) {
      const isOutOfBounds = col < 0 || row < 0 ||
        col >= gridDimensions.cols || row >= gridDimensions.rows ||
        col + draggingObject.grid_width > gridDimensions.cols ||
        row + draggingObject.grid_length > gridDimensions.rows;

      const isOnPermanent = !isOutOfBounds && (() => {
        for (let r = row; r < row + draggingObject.grid_length; r++) {
          for (let c = col; c < col + draggingObject.grid_width; c++) {
            const key = `${r}-${c}`;
            const painted = paintedSquares.get(key);
            if (painted && painted.type === 'permanent') {
              return true;
            }
          }
        }
        return false;
      })();

      if (isOutOfBounds || isOnPermanent) {
        setDragPreviewPosition(null);
        return;
      }

      const { activeLayoutId: objLayoutId } = useGridStore.getState();
      const { data, error } = await supabase
        .from('placed_objects')
        .insert([{
          object_name: draggingObject.name,
          grid_x: col,
          grid_y: row,
          grid_width: draggingObject.grid_width,
          grid_height: draggingObject.grid_length,
          color: draggingObject.color,
          rotation: 0,
          layout_id: objLayoutId,
        }])
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error placing object:', error);
      } else if (data) {
        addPlacedObject(data as PlacedObject);
      }

      setDragPreviewPosition(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = repositioningObject ? 'move' : 'copy';

    if (!svgRef.current || (!draggingObject && !repositioningObject)) return;

    const { row, col } = screenToGrid(e.clientX, e.clientY);

    if (col >= 0 && row >= 0 && col < gridDimensions.cols && row < gridDimensions.rows) {
      setDragPreviewPosition({ row, col, label: '' });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setDragPreviewPosition(null);
    }
  };

  const handleObjectClick = (e: React.MouseEvent, object: PlacedObject) => {
    e.stopPropagation();
    if (!canInteractWithObjects()) {
      showLayoutOnlyToast();
      return;
    }
    setSelectedObject(object);
  };

  const handleObjectMouseDown = (e: React.MouseEvent, object: PlacedObject) => {
    e.stopPropagation();
    if (!canInteractWithObjects()) return;
    if (!svgRef.current) return;

    const timer = window.setTimeout(() => {
      setIsHolding(true);
      setHoldTarget({ type: 'object', item: object });
      const origPos = { x: object.grid_x, y: object.grid_y };
      setOriginalPosition(origPos);

      const startGrid = screenToGrid(e.clientX, e.clientY);

      const objectX = MARGIN + object.grid_x * CELL_SIZE;
      const objectY = MARGIN + object.grid_y * CELL_SIZE;

      const offsetX = startGrid.svgX - objectX;
      const offsetY = startGrid.svgY - objectY;

      const dragOffsetData = { x: offsetX, y: offsetY };

      setRepositioningObject(object);
      setDraggedObjectOriginalPos({ row: object.grid_y, col: object.grid_x });
      setDragPreviewPosition({ row: object.grid_y, col: object.grid_x, label: '' });
      setDragOffset(dragOffsetData);
      setIsDraggingObject(true);

      const repositioningObjectData = object;
      let currentPreview = { row: object.grid_y, col: object.grid_x, label: '' };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!svgRef.current) return;

        // Safety: if mouse button already released, force cleanup
        if (moveEvent.buttons === 0) {
          handleMouseUp();
          return;
        }

        const moveGrid = screenToGrid(moveEvent.clientX, moveEvent.clientY);

        const adjustedX = moveGrid.svgX - dragOffsetData.x;
        const adjustedY = moveGrid.svgY - dragOffsetData.y;

        const col = Math.floor((adjustedX - MARGIN) / CELL_SIZE);
        const row = Math.floor((adjustedY - MARGIN) / CELL_SIZE);

        if (col >= 0 && row >= 0 && col < gridDimensions.cols && row < gridDimensions.rows) {
          currentPreview = { row, col, label: '' };
          setDragPreviewPosition(currentPreview);
        }
      };

      const handleMouseUp = async () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        dragCleanupRef.current = null;

        if (currentPreview) {
          const { row, col } = currentPreview;

          const isOutOfBounds = col < 0 || row < 0 ||
            col >= gridDimensions.cols || row >= gridDimensions.rows ||
            col + repositioningObjectData.grid_width > gridDimensions.cols ||
            row + repositioningObjectData.grid_height > gridDimensions.rows;

          const isOnPermanent = !isOutOfBounds && (() => {
            for (let r = row; r < row + repositioningObjectData.grid_height; r++) {
              for (let c = col; c < col + repositioningObjectData.grid_width; c++) {
                const key = `${r}-${c}`;
                const painted = paintedSquares.get(key);
                if (painted && painted.type === 'permanent') {
                  return true;
                }
              }
            }
            return false;
          })();

          if (!isOutOfBounds && !isOnPermanent) {
            const { data, error } = await supabase
              .from('placed_objects')
              .update({
                grid_x: col,
                grid_y: row,
              })
              .eq('id', repositioningObjectData.id)
              .select()
              .maybeSingle();

            if (error) {
              console.error('Error repositioning object:', error);
            } else if (data) {
              updatePlacedObject(repositioningObjectData.id, data as PlacedObject);
            }
          }
        }

        setIsDraggingObject(false);
        setRepositioningObject(null);
        setDragPreviewPosition(null);
        setDraggedObjectOriginalPos(null);
        setDragOffset(null);
      };

      dragCleanupRef.current = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }, 200);

    setHoldTimer(timer);
  };

  const handleObjectMouseUp = (e: React.MouseEvent, object: PlacedObject) => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      setHoldTimer(null);
    }

    if (!isHolding && !repositioningObject) {
      setSelectedObject(object);
    }

    setIsHolding(false);
    setHoldTarget(null);
    setOriginalPosition(null);
  };

  const handleObjectDragStart = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleObjectDragEnd = () => {
    setRepositioningObject(null);
    setDragPreviewPosition(null);
  };


  const handleZoneClick = (e: React.MouseEvent, zone: Zone) => {
    e.stopPropagation();
    if (!canInteractWithZones()) {
      showLayoutOnlyToast();
      return;
    }
    if (!isDrawingZone && !draggingZone && !resizingZone) {
      setSelectedZone(zone);
    }
  };

  const gridWidth = gridDimensions.cols * CELL_SIZE;
  const gridHeight = gridDimensions.rows * CELL_SIZE;
  const totalWidth = gridWidth + MARGIN * 2;
  const totalHeight = gridHeight + MARGIN * 2;

  const spaceMetrics = useMemo(() => {
    const totalSquares = gridDimensions.rows * gridDimensions.cols;
    const totalSpaceSqFt = settings.facilityWidth * settings.facilityHeight;

    let permanentCount = 0;
    let semiFixedCount = 0;

    paintedSquares.forEach((square) => {
      if (square.type === 'permanent') permanentCount++;
      else if (square.type === 'semi-fixed') semiFixedCount++;
    });

    const doorSquares = doors.reduce((sum, door) => sum + door.width, 0);

    const occupiedSquares = permanentCount + semiFixedCount + doorSquares;
    const availableSquares = totalSquares - occupiedSquares;
    const availableSpaceSqFt = availableSquares * (settings.squareSize * settings.squareSize);

    const availablePercent = (availableSquares / totalSquares) * 100;

    return {
      totalSquares,
      totalSpaceSqFt,
      availableSquares,
      availableSpaceSqFt,
      availablePercent,
    };
  }, [gridDimensions, settings, paintedSquares, doors]);

  const squares = useMemo(() => {
    const result = [];
    for (let row = 0; row < gridDimensions.rows; row++) {
      for (let col = 0; col < gridDimensions.cols; col++) {
        result.push({ row, col });
      }
    }
    return result;
  }, [gridDimensions]);

  const isSelected = (row: number, col: number) => {
    return (
      viewport.selectedSquare?.row === row &&
      viewport.selectedSquare?.col === col
    );
  };

  const previewZone = useMemo(() => {
    if (!isDrawingZone || !hoveredSquare) return null;

    const startX = hoveredSquare.col;
    const startY = hoveredSquare.row;
    const width = zoneDrawWidth;
    const height = zoneDrawHeight;

    let isValid = true;
    let invalidReason = '';

    if (startX + width > gridDimensions.cols || startY + height > gridDimensions.rows) {
      isValid = false;
      invalidReason = 'Zone extends beyond grid boundaries';
    }

    if (isValid) {
      for (let r = startY; r < startY + height; r++) {
        for (let c = startX; c < startX + width; c++) {
          const key = `${r}-${c}`;
          const painted = paintedSquares.get(key);
          if (painted && painted.type === 'permanent') {
            isValid = false;
            invalidReason = 'Cannot place on permanent (dark gray) squares';
            break;
          }
        }
        if (!isValid) break;
      }
    }

    let previewColor = '#3B82F6';
    if (isValid && selectedActivityForZone) {
      const activity = activities.find(a => a.id === selectedActivityForZone);
      if (activity) {
        if (activity.type === 'corridor') {
          previewColor = '#FFFFFF';
        } else if (activity.color) {
          previewColor = activity.color;
        } else {
          switch (activity.type) {
            case 'work-area':
              previewColor = '#3B82F6';
              break;
            case 'support-area':
              previewColor = '#8B5CF6';
              break;
          }
        }
      }
    }

    if (!isValid) {
      previewColor = '#EF4444';
    }

    return {
      x: MARGIN + startX * CELL_SIZE,
      y: MARGIN + startY * CELL_SIZE,
      width: width * CELL_SIZE,
      height: height * CELL_SIZE,
      color: previewColor,
      isValid,
      invalidReason,
    };
  }, [isDrawingZone, hoveredSquare, zoneDrawWidth, zoneDrawHeight, gridDimensions, paintedSquares, selectedActivityForZone, activities]);

  // Helper: compute a rect for a single corridor segment between two points
  const computeSegmentRect = (p1: { row: number; col: number }, p2: { row: number; col: number }, corridorWidth: number) => {
    const isH = p1.row === p2.row;
    const minCol = Math.min(p1.col, p2.col);
    const maxCol = Math.max(p1.col, p2.col);
    const minRow = Math.min(p1.row, p2.row);
    const maxRow = Math.max(p1.row, p2.row);
    return {
      x: MARGIN + minCol * CELL_SIZE,
      y: MARGIN + minRow * CELL_SIZE,
      w: isH ? (maxCol - minCol + 1) * CELL_SIZE : corridorWidth * CELL_SIZE,
      h: isH ? corridorWidth * CELL_SIZE : (maxRow - minRow + 1) * CELL_SIZE,
    };
  };

  // Preview: next segment from last waypoint to snapped cursor
  const previewCorridorSegment = useMemo(() => {
    if (!isDrawingCorridor || !hoveredSquare || !selectedCorridorType || corridorWaypoints.length === 0) return null;

    const prev = corridorWaypoints[corridorWaypoints.length - 1];
    const deltaX = Math.abs(hoveredSquare.col - prev.col);
    const deltaY = Math.abs(hoveredSquare.row - prev.row);
    const snappedRow = deltaX >= deltaY ? prev.row : hoveredSquare.row;
    const snappedCol = deltaX >= deltaY ? hoveredSquare.col : prev.col;

    if (snappedRow === prev.row && snappedCol === prev.col) return null;

    const corridorWidth = selectedCorridorType === 'pedestrian' ? 1 : 2;
    const rect = computeSegmentRect(prev, { row: snappedRow, col: snappedCol }, corridorWidth);
    const fillColor = getCorridorColor(selectedCorridorType);
    const strokeColor = getCorridorBorderColor(selectedCorridorType);

    return { ...rect, fillColor, strokeColor, isValid: true };
  }, [isDrawingCorridor, hoveredSquare, selectedCorridorType, corridorWaypoints]);

  return (
    <div
      className="w-full h-full overflow-hidden bg-white relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Compact mode indicator pills — no animation, no redundant buttons */}
      {isDrawingZone && selectedActivityForZone && (() => {
        const activity = activities.find(a => a.id === selectedActivityForZone);
        return (
          <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900/85 backdrop-blur text-white px-4 py-2 rounded-lg shadow-md text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <span><strong>{activity?.name || 'Zone'}</strong> ({zoneDrawWidth}×{zoneDrawHeight}) — click to place · Esc to cancel</span>
          </div>
        );
      })()}

      {paintMode && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900/85 backdrop-blur text-white px-4 py-2 rounded-lg shadow-md text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
          <span><strong>{paintMode === 'permanent' ? 'Permanent' : paintMode === 'semi-fixed' ? 'Semi-Fixed' : 'Clear'}</strong> — click & drag to paint · Esc to exit</span>
        </div>
      )}

      {isDrawingCorridor && selectedCorridorType && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900/85 backdrop-blur text-white px-4 py-2 rounded-lg shadow-md text-sm flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${selectedCorridorType === 'pedestrian' ? 'bg-green-400' : 'bg-amber-400'}`} />
          <span>
            <strong>{selectedCorridorType === 'pedestrian' ? 'Pedestrian Walkway' : 'Forklift / Cart Path'}</strong>
            {' — '}
            {corridorWaypoints.length === 0
              ? 'click to place start point'
              : `${corridorWaypoints.length} point${corridorWaypoints.length > 1 ? 's' : ''} · click to add bend · double-click or Enter to finish`}
            {' · Esc to cancel'}
          </span>
        </div>
      )}

      {isAddingDoor && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900/85 backdrop-blur text-white px-4 py-2 rounded-lg shadow-md text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
          <span><strong>Door Placement</strong> — click outer edge squares · Esc to cancel</span>
        </div>
      )}

      <svg
        id="flowgrid-canvas"
        ref={svgRef}
        className={`w-full h-full ${
          paintMode ? 'cursor-pointer' : isDrawingZone ? 'cursor-crosshair' : isAddingDoor ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{
          touchAction: 'none',
          willChange: 'transform',
        }}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        <g
          transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}
          style={{ transformOrigin: '0 0' }}
        >
          {squares.map(({ row, col }) => {
            const x = MARGIN + col * CELL_SIZE;
            const y = MARGIN + row * CELL_SIZE;
            const selected = isSelected(row, col);
            const key = `${row}-${col}`;
            const paintedSquare = paintedSquares.get(key);

            let fill = 'white';
            if (selected) {
              fill = '#DBEAFE';
            } else if (paintedSquare) {
              fill = paintedSquare.type === 'permanent' ? '#4B5563' : '#9CA3AF';
            }

            return (
              <rect
                key={key}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                fill={fill}
                stroke="#E5E7EB"
                strokeWidth="1"
                className={`transition-colors hover:opacity-80 ${
                  isDrawingZone ? 'cursor-crosshair' :
                  paintMode ? 'cursor-cell' :
                  isAddingDoor ? 'cursor-crosshair' :
                  'cursor-pointer'
                }`}
                onMouseDown={(e) => handleSquareMouseDown(e, row, col)}
                onMouseUp={(e) => handleSquareMouseUp(e, row, col)}
                onMouseEnter={(e) => handleSquareMouseEnter(e, row, col)}
                onMouseLeave={handleSquareMouseLeave}
              />
            );
          })}

          {zones.map((zone) => {
            const activity = zone.activity_id ? activities.find(a => a.id === zone.activity_id) : null;
            const isCorridor = activity?.type === 'corridor';
            const strokeColor = isCorridor ? getCorridorBorderColor('pedestrian') : zone.color;
            const textColor = isCorridor ? getCorridorBorderColor('pedestrian') : zone.color;

            // Check if this zone should glow
            const glowInfo = relatedZonesGlow.get(zone.id);
            const distance = zoneDistances.get(zone.id);

            // Determine glow color based on relationship type
            let glowColor = '';
            let glowStrokeWidth = 2;
            if (glowInfo) {
              if (glowInfo.type === 'must-be-close') {
                glowColor = '#15803d'; // Dark green
                glowStrokeWidth = 4;
              } else if (glowInfo.type === 'prefer-close') {
                glowColor = '#16a34a'; // Light green
                glowStrokeWidth = 3;
              } else if (glowInfo.type === 'keep-apart') {
                glowColor = '#dc2626'; // Red
                glowStrokeWidth = 4;
              }
            }

            return (
              <g key={zone.id} onClick={(e) => handleZoneClick(e, zone)} style={{ pointerEvents: isDrawingCorridor ? 'none' : 'auto' }}>
                {/* Glow effect - outer rects with multiple layers for visibility */}
                {glowInfo && (
                  <>
                    <rect
                      x={MARGIN + zone.grid_x * CELL_SIZE - 8}
                      y={MARGIN + zone.grid_y * CELL_SIZE - 8}
                      width={zone.grid_width * CELL_SIZE + 16}
                      height={zone.grid_height * CELL_SIZE + 16}
                      fill="none"
                      stroke={glowColor}
                      strokeWidth={6}
                      opacity="0.3"
                      className="pointer-events-none animate-pulse"
                    />
                    <rect
                      x={MARGIN + zone.grid_x * CELL_SIZE - 6}
                      y={MARGIN + zone.grid_y * CELL_SIZE - 6}
                      width={zone.grid_width * CELL_SIZE + 12}
                      height={zone.grid_height * CELL_SIZE + 12}
                      fill="none"
                      stroke={glowColor}
                      strokeWidth={glowStrokeWidth}
                      opacity="0.7"
                      className="pointer-events-none"
                    />
                    <rect
                      x={MARGIN + zone.grid_x * CELL_SIZE - 3}
                      y={MARGIN + zone.grid_y * CELL_SIZE - 3}
                      width={zone.grid_width * CELL_SIZE + 6}
                      height={zone.grid_height * CELL_SIZE + 6}
                      fill="none"
                      stroke={glowColor}
                      strokeWidth={3}
                      opacity="0.9"
                      className="pointer-events-none animate-pulse"
                      style={{ animationDuration: '1.5s' }}
                    />
                  </>
                )}

                <rect
                  x={MARGIN + zone.grid_x * CELL_SIZE}
                  y={MARGIN + zone.grid_y * CELL_SIZE}
                  width={zone.grid_width * CELL_SIZE}
                  height={zone.grid_height * CELL_SIZE}
                  fill={zone.color}
                  fillOpacity={draggingZone?.id === zone.id ? "0.5" : (isCorridor ? "0.5" : "0.2")}
                  stroke={glowInfo ? glowColor : strokeColor}
                  strokeWidth={glowInfo ? glowStrokeWidth : 2}
                  strokeDasharray={isCorridor ? "5,5" : undefined}
                  className={draggingZone?.id === zone.id ? "cursor-grabbing" : "cursor-pointer"}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                  onMouseMove={(e) => {
                    if (!svgRef.current) return;
                    const { row, col } = screenToGrid(e.clientX, e.clientY);
                    if (col >= 0 && row >= 0 && col < gridDimensions.cols && row < gridDimensions.rows) {
                      const coordinate = getGridCoordinate(row, col);
                      setHoveredSquare({ row, col, label: coordinate.label });
                    }
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!canInteractWithZones()) return;
                    if (!svgRef.current) return;

                    const timer = window.setTimeout(() => {
                      setIsHolding(true);
                      setHoldTarget({ type: 'zone', item: zone });
                      const origPos = { x: zone.grid_x, y: zone.grid_y };
                      setOriginalPosition(origPos);
                      setMoveStatus({ name: zone.name, targetCell: getGridCoordinate(zone.grid_y, zone.grid_x, gridDimensions).label });

                      const startGrid = screenToGrid(e.clientX, e.clientY);

                      const dragOffsetData = {
                        x: startGrid.svgX - (MARGIN + zone.grid_x * CELL_SIZE),
                        y: startGrid.svgY - (MARGIN + zone.grid_y * CELL_SIZE),
                      };

                      setDraggingZone(zone);
                      setDragOffset(dragOffsetData);

                      const draggingZoneData = zone;

                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        if (!svgRef.current) return;

                        // Safety: if mouse button already released, force cleanup
                        if (moveEvent.buttons === 0) {
                          handleMouseUp();
                          return;
                        }

                        const moveGrid = screenToGrid(moveEvent.clientX, moveEvent.clientY);

                        const adjustedX = moveGrid.svgX - dragOffsetData.x;
                        const adjustedY = moveGrid.svgY - dragOffsetData.y;

                        const col = Math.round((adjustedX - MARGIN) / CELL_SIZE);
                        const row = Math.round((adjustedY - MARGIN) / CELL_SIZE);

                        if (col >= 0 && row >= 0 &&
                            col + draggingZoneData.grid_width <= gridDimensions.cols &&
                            row + draggingZoneData.grid_height <= gridDimensions.rows) {

                          let canPlace = true;
                          for (let r = row; r < row + draggingZoneData.grid_height; r++) {
                            for (let c = col; c < col + draggingZoneData.grid_width; c++) {
                              const key = `${r}-${c}`;
                              const painted = paintedSquares.get(key);
                              if (painted && painted.type === 'permanent') {
                                canPlace = false;
                                break;
                              }
                            }
                            if (!canPlace) break;
                          }

                          if (canPlace) {
                            updateZone(draggingZoneData.id, {
                              grid_x: col,
                              grid_y: row,
                            });
                            draggingZoneData.grid_x = col;
                            draggingZoneData.grid_y = row;
                            setMoveStatus({ name: draggingZoneData.name, targetCell: getGridCoordinate(row, col, gridDimensions).label });
                          }
                        }
                      };

                      const handleMouseUp = async () => {
                        window.removeEventListener('mousemove', handleMouseMove);
                        window.removeEventListener('mouseup', handleMouseUp);
                        dragCleanupRef.current = null;

                        if (draggingZoneData.grid_x !== origPos.x || draggingZoneData.grid_y !== origPos.y) {
                          let canPlace = true;
                          const { grid_x: col, grid_y: row, grid_width, grid_height } = draggingZoneData;

                          if (col < 0 || row < 0 || col + grid_width > gridDimensions.cols || row + grid_height > gridDimensions.rows) {
                            canPlace = false;
                          } else {
                            for (let r = row; r < row + grid_height; r++) {
                              for (let c = col; c < col + grid_width; c++) {
                                const key = `${r}-${c}`;
                                const painted = paintedSquares.get(key);
                                if (painted && painted.type === 'permanent') {
                                  canPlace = false;
                                  break;
                                }
                              }
                              if (!canPlace) break;
                            }
                          }

                          if (canPlace) {
                            await supabase
                              .from('zones')
                              .update({
                                grid_x: draggingZoneData.grid_x,
                                grid_y: draggingZoneData.grid_y,
                              })
                              .eq('id', draggingZoneData.id);
                          } else {
                            updateZone(draggingZoneData.id, {
                              grid_x: origPos.x,
                              grid_y: origPos.y,
                            });
                          }
                        }

                        setDraggingZone(null);
                        setDragOffset(null);
                        setMoveStatus(null);
                        setOriginalPosition(null);
                        setIsHolding(false);
                        setHoldTarget(null);
                      };

                      dragCleanupRef.current = () => {
                        window.removeEventListener('mousemove', handleMouseMove);
                        window.removeEventListener('mouseup', handleMouseUp);
                      };

                      window.addEventListener('mousemove', handleMouseMove);
                      window.addEventListener('mouseup', handleMouseUp);
                    }, 200);

                    setHoldTimer(timer);
                  }}
                  onMouseUp={(e) => {
                    if (holdTimer) {
                      clearTimeout(holdTimer);
                      setHoldTimer(null);
                    }

                    if (!isHolding && !draggingZone) {
                      handleZoneClick(e, zone);
                    }

                    setIsHolding(false);
                    setHoldTarget(null);
                    setMoveStatus(null);
                    setOriginalPosition(null);
                  }}
                />
                {/* Zone label — positioned by label_align, skipped if hidden */}
                {(zone.label_align || 'center') !== 'hidden' && (() => {
                  const zonePixelX = MARGIN + zone.grid_x * CELL_SIZE;
                  const zonePixelY = MARGIN + zone.grid_y * CELL_SIZE;
                  const zonePixelW = zone.grid_width * CELL_SIZE;
                  const zonePixelH = zone.grid_height * CELL_SIZE;
                  const labelX = zonePixelX + zonePixelW / 2;
                  const align = zone.label_align || 'center';
                  const labelY = align === 'top'
                    ? zonePixelY + 12
                    : align === 'bottom'
                      ? zonePixelY + zonePixelH - 6
                      : zonePixelY + zonePixelH / 2;
                  const baseline = align === 'top' ? 'hanging' : align === 'bottom' ? 'auto' : 'middle';
                  return (
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline={baseline}
                      fontSize="12"
                      fontWeight="bold"
                      fill={textColor}
                      className="select-none pointer-events-none"
                    >
                      {zone.name}
                    </text>
                  );
                })()}

                {/* Hover tooltip — always shows name above zone */}
                {hoveredZone === zone.id && !isDrawingZone && !draggingZone && (() => {
                  const tooltipX = MARGIN + zone.grid_x * CELL_SIZE + (zone.grid_width * CELL_SIZE) / 2;
                  const tooltipY = MARGIN + zone.grid_y * CELL_SIZE - 8;
                  const textLen = zone.name.length * 8.5 + 20;
                  return (
                    <g className="pointer-events-none">
                      <rect
                        x={tooltipX - textLen / 2}
                        y={tooltipY - 22}
                        width={textLen}
                        height={26}
                        rx="5"
                        fill="#1F2937"
                        opacity="0.9"
                      />
                      <text
                        x={tooltipX}
                        y={tooltipY - 9}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="14"
                        fontWeight="600"
                        fill="white"
                        className="select-none"
                      >
                        {zone.name}
                      </text>
                    </g>
                  );
                })()}

                {/* Distance label for glowing zones */}
                {glowInfo && distance !== undefined && (
                  <g>
                    <rect
                      x={MARGIN + zone.grid_x * CELL_SIZE + (zone.grid_width * CELL_SIZE) / 2 - 40}
                      y={MARGIN + zone.grid_y * CELL_SIZE - 24}
                      width="80"
                      height="20"
                      fill={glowColor}
                      rx="4"
                      opacity="0.9"
                      className="pointer-events-none"
                    />
                    <text
                      x={MARGIN + zone.grid_x * CELL_SIZE + (zone.grid_width * CELL_SIZE) / 2}
                      y={MARGIN + zone.grid_y * CELL_SIZE - 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="white"
                      className="select-none pointer-events-none"
                    >
                      {distance} square{distance !== 1 ? 's' : ''} away
                    </text>
                  </g>
                )}

                {/* Resize handles - only visible on hover */}
                {hoveredZone === zone.id && !isDrawingZone && !draggingZone && !resizingZone && (() => {
                  const zoneX = MARGIN + zone.grid_x * CELL_SIZE;
                  const zoneY = MARGIN + zone.grid_y * CELL_SIZE;
                  const zoneWidth = zone.grid_width * CELL_SIZE;
                  const zoneHeight = zone.grid_height * CELL_SIZE;
                  const handleSize = 8;

                  const handleStyle = {
                    fill: 'white',
                    stroke: '#1F2937',
                    strokeWidth: 2,
                  };

                  // For resize handles, we need to track the edge positions in grid coordinates
                  const handles = [
                    // Corner handles
                    { x: zoneX - handleSize / 2, y: zoneY - handleSize / 2, edgeCol: zone.grid_x, edgeRow: zone.grid_y, cursor: 'nw-resize', edge: 'top-left' },
                    { x: zoneX + zoneWidth - handleSize / 2, y: zoneY - handleSize / 2, edgeCol: zone.grid_x + zone.grid_width, edgeRow: zone.grid_y, cursor: 'ne-resize', edge: 'top-right' },
                    { x: zoneX - handleSize / 2, y: zoneY + zoneHeight - handleSize / 2, edgeCol: zone.grid_x, edgeRow: zone.grid_y + zone.grid_height, cursor: 'sw-resize', edge: 'bottom-left' },
                    { x: zoneX + zoneWidth - handleSize / 2, y: zoneY + zoneHeight - handleSize / 2, edgeCol: zone.grid_x + zone.grid_width, edgeRow: zone.grid_y + zone.grid_height, cursor: 'se-resize', edge: 'bottom-right' },
                    // Edge handles
                    { x: zoneX + zoneWidth / 2 - handleSize / 2, y: zoneY - handleSize / 2, edgeCol: zone.grid_x + zone.grid_width / 2, edgeRow: zone.grid_y, cursor: 'n-resize', edge: 'top' },
                    { x: zoneX + zoneWidth / 2 - handleSize / 2, y: zoneY + zoneHeight - handleSize / 2, edgeCol: zone.grid_x + zone.grid_width / 2, edgeRow: zone.grid_y + zone.grid_height, cursor: 's-resize', edge: 'bottom' },
                    { x: zoneX - handleSize / 2, y: zoneY + zoneHeight / 2 - handleSize / 2, edgeCol: zone.grid_x, edgeRow: zone.grid_y + zone.grid_height / 2, cursor: 'w-resize', edge: 'left' },
                    { x: zoneX + zoneWidth - handleSize / 2, y: zoneY + zoneHeight / 2 - handleSize / 2, edgeCol: zone.grid_x + zone.grid_width, edgeRow: zone.grid_y + zone.grid_height / 2, cursor: 'e-resize', edge: 'right' },
                  ];

                  return (
                    <g>
                      {handles.map((handle, idx) => (
                        <rect
                          key={`handle-${idx}`}
                          x={handle.x}
                          y={handle.y}
                          width={handleSize}
                          height={handleSize}
                          {...handleStyle}
                          style={{ cursor: handle.cursor }}
                          onMouseEnter={() => setHoveredZone(zone.id)}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();

                            if (!canInteractWithZones()) return;
                            if (!svgRef.current) return;

                            // Capture initial mouse position in SVG coordinates
                            const startGrid = screenToGrid(e.clientX, e.clientY);

                            // Calculate offset from mouse to the edge position in SVG coordinates
                            const edgeSvgX = MARGIN + handle.edgeCol * CELL_SIZE;
                            const edgeSvgY = MARGIN + handle.edgeRow * CELL_SIZE;

                            const offsetX = startGrid.svgX - edgeSvgX;
                            const offsetY = startGrid.svgY - edgeSvgY;

                            const dragOffsetData = { x: offsetX, y: offsetY };
                            setDragOffset(dragOffsetData);
                            setResizingZone(zone, handle.edge as any);

                            const resizingZoneData = zone;
                            const resizingEdge = handle.edge as any;

                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              if (!svgRef.current) return;

                              // Safety: if mouse button already released, force cleanup
                              if (moveEvent.buttons === 0) {
                                handleMouseUp();
                                return;
                              }

                              const moveGrid = screenToGrid(moveEvent.clientX, moveEvent.clientY);

                              const adjustedX = moveGrid.svgX - dragOffsetData.x;
                              const adjustedY = moveGrid.svgY - dragOffsetData.y;

                              const col = Math.round((adjustedX - MARGIN) / CELL_SIZE);
                              const row = Math.round((adjustedY - MARGIN) / CELL_SIZE);

                              if (col < 0 || row < 0 || col > gridDimensions.cols || row > gridDimensions.rows) return;

                              let newX = resizingZoneData.grid_x;
                              let newY = resizingZoneData.grid_y;
                              let newWidth = resizingZoneData.grid_width;
                              let newHeight = resizingZoneData.grid_height;

                              switch (resizingEdge) {
                                case 'top':
                                  newY = Math.min(row, resizingZoneData.grid_y + resizingZoneData.grid_height - 1);
                                  newHeight = (resizingZoneData.grid_y + resizingZoneData.grid_height) - newY;
                                  break;
                                case 'bottom':
                                  newHeight = Math.max(1, row - resizingZoneData.grid_y);
                                  break;
                                case 'left':
                                  newX = Math.min(col, resizingZoneData.grid_x + resizingZoneData.grid_width - 1);
                                  newWidth = (resizingZoneData.grid_x + resizingZoneData.grid_width) - newX;
                                  break;
                                case 'right':
                                  newWidth = Math.max(1, col - resizingZoneData.grid_x);
                                  break;
                                case 'top-left':
                                  newX = Math.min(col, resizingZoneData.grid_x + resizingZoneData.grid_width - 1);
                                  newY = Math.min(row, resizingZoneData.grid_y + resizingZoneData.grid_height - 1);
                                  newWidth = (resizingZoneData.grid_x + resizingZoneData.grid_width) - newX;
                                  newHeight = (resizingZoneData.grid_y + resizingZoneData.grid_height) - newY;
                                  break;
                                case 'top-right':
                                  newY = Math.min(row, resizingZoneData.grid_y + resizingZoneData.grid_height - 1);
                                  newWidth = Math.max(1, col - resizingZoneData.grid_x);
                                  newHeight = (resizingZoneData.grid_y + resizingZoneData.grid_height) - newY;
                                  break;
                                case 'bottom-left':
                                  newX = Math.min(col, resizingZoneData.grid_x + resizingZoneData.grid_width - 1);
                                  newWidth = (resizingZoneData.grid_x + resizingZoneData.grid_width) - newX;
                                  newHeight = Math.max(1, row - resizingZoneData.grid_y);
                                  break;
                                case 'bottom-right':
                                  newWidth = Math.max(1, col - resizingZoneData.grid_x);
                                  newHeight = Math.max(1, row - resizingZoneData.grid_y);
                                  break;
                              }

                              if (newWidth > 0 && newHeight > 0) {
                                let canResize = true;
                                for (let r = newY; r < newY + newHeight; r++) {
                                  for (let c = newX; c < newX + newWidth; c++) {
                                    const key = `${r}-${c}`;
                                    const painted = paintedSquares.get(key);
                                    if (painted && painted.type === 'permanent') {
                                      canResize = false;
                                      break;
                                    }
                                  }
                                  if (!canResize) break;
                                }

                                if (canResize) {
                                  updateZone(resizingZoneData.id, {
                                    grid_x: newX,
                                    grid_y: newY,
                                    grid_width: newWidth,
                                    grid_height: newHeight,
                                  });
                                  resizingZoneData.grid_x = newX;
                                  resizingZoneData.grid_y = newY;
                                  resizingZoneData.grid_width = newWidth;
                                  resizingZoneData.grid_height = newHeight;
                                }
                              }
                            };

                            const handleMouseUp = async () => {
                              window.removeEventListener('mousemove', handleMouseMove);
                              window.removeEventListener('mouseup', handleMouseUp);
                              dragCleanupRef.current = null;

                              await supabase
                                .from('zones')
                                .update({
                                  grid_x: resizingZoneData.grid_x,
                                  grid_y: resizingZoneData.grid_y,
                                  grid_width: resizingZoneData.grid_width,
                                  grid_height: resizingZoneData.grid_height,
                                })
                                .eq('id', resizingZoneData.id);

                              setResizingZone(null, null);
                              setDragOffset(null);
                            };

                            dragCleanupRef.current = () => {
                              window.removeEventListener('mousemove', handleMouseMove);
                              window.removeEventListener('mouseup', handleMouseUp);
                            };

                            window.addEventListener('mousemove', handleMouseMove);
                            window.addEventListener('mouseup', handleMouseUp);
                          }}
                        />
                      ))}
                    </g>
                  );
                })()}

                {originalPosition && draggingZone?.id === zone.id && (
                  <rect
                    x={MARGIN + originalPosition.x * CELL_SIZE}
                    y={MARGIN + originalPosition.y * CELL_SIZE}
                    width={zone.grid_width * CELL_SIZE}
                    height={zone.grid_height * CELL_SIZE}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}

          {previewZone && (
            <>
              <rect
                x={previewZone.x}
                y={previewZone.y}
                width={previewZone.width}
                height={previewZone.height}
                fill={previewZone.color}
                fillOpacity={previewZone.isValid ? "0.4" : "0.3"}
                stroke={previewZone.color}
                strokeWidth="5"
                strokeDasharray="12,6"
                className="pointer-events-none"
              />
              {!previewZone.isValid && previewZone.invalidReason && (
                <text
                  x={previewZone.x + previewZone.width / 2}
                  y={previewZone.y + previewZone.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#DC2626"
                  fontSize="16"
                  fontWeight="bold"
                  className="pointer-events-none"
                >
                  ✗ INVALID
                </text>
              )}
            </>
          )}

          {dragPreviewPosition && (draggingObject || repositioningObject) && (() => {
            const width = (draggingObject?.grid_width || repositioningObject?.grid_width || 1);
            const height = (draggingObject?.grid_length || repositioningObject?.grid_height || 1);
            const color = draggingObject?.color || repositioningObject?.color || '#3B82F6';
            const name = draggingObject?.name || repositioningObject?.object_name || '';

            const isOutOfBounds = dragPreviewPosition.col < 0 || dragPreviewPosition.row < 0 ||
              dragPreviewPosition.col >= gridDimensions.cols || dragPreviewPosition.row >= gridDimensions.rows ||
              dragPreviewPosition.col + width > gridDimensions.cols ||
              dragPreviewPosition.row + height > gridDimensions.rows;

            const isOnPermanent = !isOutOfBounds && (() => {
              for (let r = dragPreviewPosition.row; r < dragPreviewPosition.row + height; r++) {
                for (let c = dragPreviewPosition.col; c < dragPreviewPosition.col + width; c++) {
                  const key = `${r}-${c}`;
                  const painted = paintedSquares.get(key);
                  if (painted && painted.type === 'permanent') {
                    return true;
                  }
                }
              }
              return false;
            })();

            const isInvalid = isOutOfBounds || isOnPermanent;
            const previewColor = isInvalid ? '#EF4444' : color;
            const strokeColor = isInvalid ? '#DC2626' : '#10B981';

            return (
              <g className="pointer-events-none">
                <rect
                  x={MARGIN + dragPreviewPosition.col * CELL_SIZE}
                  y={MARGIN + dragPreviewPosition.row * CELL_SIZE}
                  width={width * CELL_SIZE}
                  height={height * CELL_SIZE}
                  fill={previewColor}
                  stroke={strokeColor}
                  strokeWidth="3"
                  strokeDasharray="6 3"
                  opacity="0.6"
                />
                <rect
                  x={MARGIN + dragPreviewPosition.col * CELL_SIZE}
                  y={MARGIN + dragPreviewPosition.row * CELL_SIZE}
                  width={width * CELL_SIZE}
                  height={height * CELL_SIZE}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1"
                  opacity="0.8"
                />
                <text
                  x={MARGIN + dragPreviewPosition.col * CELL_SIZE + (width * CELL_SIZE) / 2}
                  y={MARGIN + dragPreviewPosition.row * CELL_SIZE + (height * CELL_SIZE) / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="white"
                  className="select-none"
                >
                  {name}
                </text>
              </g>
            );
          })()}

          {placedObjects.map((object) => {
            const isBeingRepositioned = repositioningObject?.id === object.id;
            return (
              <g
                key={object.id}
                onClick={(e) => handleObjectClick(e, object)}
                style={{
                  opacity: isBeingRepositioned ? 0.3 : 1,
                  cursor: 'move',
                  pointerEvents: isDrawingCorridor ? 'none' : 'auto',
                }}
              >
                <rect
                  x={MARGIN + object.grid_x * CELL_SIZE}
                  y={MARGIN + object.grid_y * CELL_SIZE}
                  width={object.grid_width * CELL_SIZE}
                  height={object.grid_height * CELL_SIZE}
                  fill={object.color}
                  stroke="#374151"
                  strokeWidth="2"
                  opacity="0.9"
                  onMouseMove={(e) => {
                    if (!svgRef.current) return;
                    const { row, col } = screenToGrid(e.clientX, e.clientY);
                    if (col >= 0 && row >= 0 && col < gridDimensions.cols && row < gridDimensions.rows) {
                      const coordinate = getGridCoordinate(row, col);
                      setHoveredSquare({ row, col, label: coordinate.label });
                    }
                  }}
                  onMouseDown={(e) => handleObjectMouseDown(e, object)}
                  onMouseUp={(e) => handleObjectMouseUp(e, object)}
                  onDragStart={handleObjectDragStart}
                  className={repositioningObject?.id === object.id ? "cursor-grabbing" : "cursor-pointer"}
                />
                {/* Hover tooltip — name badge above object */}
                {hoveredSquare && !isDraggingObject && (() => {
                  const objLeft = object.grid_x;
                  const objRight = object.grid_x + object.grid_width - 1;
                  const objTop = object.grid_y;
                  const objBottom = object.grid_y + object.grid_height - 1;
                  const isHovered = hoveredSquare.row >= objTop && hoveredSquare.row <= objBottom &&
                    hoveredSquare.col >= objLeft && hoveredSquare.col <= objRight;
                  if (!isHovered) return null;
                  const tooltipX = MARGIN + object.grid_x * CELL_SIZE + (object.grid_width * CELL_SIZE) / 2;
                  const tooltipY = MARGIN + object.grid_y * CELL_SIZE - 8;
                  const textLen = object.object_name.length * 8.5 + 20;
                  return (
                    <g className="pointer-events-none">
                      <rect
                        x={tooltipX - textLen / 2}
                        y={tooltipY - 22}
                        width={textLen}
                        height={26}
                        rx="5"
                        fill="#1F2937"
                        opacity="0.9"
                      />
                      <text
                        x={tooltipX}
                        y={tooltipY - 9}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="14"
                        fontWeight="600"
                        fill="white"
                        className="select-none"
                      >
                        {object.object_name}
                      </text>
                    </g>
                  );
                })()}

                {originalPosition && repositioningObject?.id === object.id && (
                  <rect
                    x={MARGIN + originalPosition.x * CELL_SIZE}
                    y={MARGIN + originalPosition.y * CELL_SIZE}
                    width={object.grid_width * CELL_SIZE}
                    height={object.grid_height * CELL_SIZE}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}

          {corridors.map((corridor) => {
            // Use points array (guaranteed by auto-migration on load)
            const pts = corridor.points && corridor.points.length >= 2
              ? corridor.points
              : [{ x: corridor.start_grid_x, y: corridor.start_grid_y }, { x: corridor.end_grid_x, y: corridor.end_grid_y }];

            // Build segments
            const segments: Array<{ x: number; y: number; w: number; h: number; isH: boolean }> = [];
            for (let si = 0; si < pts.length - 1; si++) {
              const p1 = { row: pts[si].y, col: pts[si].x };
              const p2 = { row: pts[si + 1].y, col: pts[si + 1].x };
              const isH = p1.row === p2.row;
              const minC = Math.min(p1.col, p2.col);
              const maxC = Math.max(p1.col, p2.col);
              const minR = Math.min(p1.row, p2.row);
              const maxR = Math.max(p1.row, p2.row);
              segments.push({
                x: MARGIN + minC * CELL_SIZE,
                y: MARGIN + minR * CELL_SIZE,
                w: isH ? (maxC - minC + 1) * CELL_SIZE : corridor.width * CELL_SIZE,
                h: isH ? corridor.width * CELL_SIZE : (maxR - minR + 1) * CELL_SIZE,
                isH,
              });
            }

            const fillColor = getCorridorColor(corridor.type);
            const strokeColor = getCorridorBorderColor(corridor.type);
            const textColor = getCorridorBorderColor(corridor.type);

            return (
              <g key={corridor.id} onClick={(e) => {
                if (isDrawingCorridor) return;
                e.stopPropagation();
                if (!canInteractWithZones()) {
                  showLayoutOnlyToast();
                  return;
                }
                setSelectedCorridor(corridor);
              }} style={{ pointerEvents: isDrawingCorridor ? 'none' : 'auto' }}>
                  {segments.map((seg, si) => (
                  <rect
                    key={`seg-${si}`}
                    x={seg.x}
                    y={seg.y}
                    width={seg.w}
                    height={seg.h}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth="2"
                    opacity="0.5"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredCorridor(corridor.id)}
                    onMouseLeave={() => setHoveredCorridor(null)}
                    onMouseMove={(e) => {
                      if (!svgRef.current) return;
                      const { row, col } = screenToGrid(e.clientX, e.clientY);
                      if (col >= 0 && row >= 0 && col < gridDimensions.cols && row < gridDimensions.rows) {
                        const coordinate = getGridCoordinate(row, col);
                        setHoveredSquare({ row, col, label: coordinate.label });
                      }
                    }}
                  />
                ))}
                {/* Icon on every segment */}
                {segments.map((seg, si) => {
                  const cx = seg.x + seg.w / 2;
                  const cy = seg.y + seg.h / 2;
                  return corridor.type === 'pedestrian' ? (
                    <g key={`icon-${si}`} transform={`translate(${cx - 8}, ${cy - 10})`} className="pointer-events-none" opacity="0.7">
                      <circle cx="8" cy="3" r="2.5" fill={textColor} />
                      <path d="M5 7.5 L8 13 L6 20 M11 7.5 L8 13 L10 20 M4 10 L8 9 L12 10" stroke={textColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </g>
                  ) : (
                    <g key={`icon-${si}`} transform={`translate(${cx - 16}, ${cy - 14})`} className="pointer-events-none" opacity="0.7">
                      <rect x="6" y="6" width="14" height="14" rx="2" fill={textColor} opacity="0.25" />
                      <rect x="6" y="6" width="14" height="14" rx="2" stroke={textColor} strokeWidth="1.8" fill="none" />
                      <line x1="8" y1="6" x2="8" y2="2" stroke={textColor} strokeWidth="1.8" strokeLinecap="round" />
                      <line x1="18" y1="6" x2="18" y2="2" stroke={textColor} strokeWidth="1.8" strokeLinecap="round" />
                      <line x1="7" y1="2" x2="19" y2="2" stroke={textColor} strokeWidth="1.8" strokeLinecap="round" />
                      <line x1="24" y1="4" x2="24" y2="20" stroke={textColor} strokeWidth="2.2" strokeLinecap="round" />
                      <line x1="24" y1="18" x2="32" y2="18" stroke={textColor} strokeWidth="2" strokeLinecap="round" />
                      <line x1="24" y1="22" x2="32" y2="22" stroke={textColor} strokeWidth="2" strokeLinecap="round" />
                      <circle cx="9" cy="23" r="2.8" fill={textColor} />
                      <circle cx="17" cy="23" r="2.8" fill={textColor} />
                      <circle cx="10" cy="13" r="1.5" stroke={textColor} strokeWidth="1.2" fill="none" />
                    </g>
                  );
                })}


              </g>
            );
          })}

          {/* In-progress waypoint segments (confirmed clicks) */}
          {isDrawingCorridor && corridorWaypoints.length >= 2 && selectedCorridorType && (() => {
            const cw = selectedCorridorType === 'pedestrian' ? 1 : 2;
            const fc = getCorridorColor(selectedCorridorType);
            const sc = getCorridorBorderColor(selectedCorridorType);
            return corridorWaypoints.slice(0, -1).map((wp, wi) => {
              const next = corridorWaypoints[wi + 1];
              const rect = computeSegmentRect(wp, next, cw);
              return <rect key={`wp-${wi}`} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={fc} stroke={sc} strokeWidth="3" opacity="0.6" className="pointer-events-none" />;
            });
          })()}

          {/* Preview segment from last waypoint to cursor */}
          {previewCorridorSegment && (
            <rect
              x={previewCorridorSegment.x}
              y={previewCorridorSegment.y}
              width={previewCorridorSegment.w}
              height={previewCorridorSegment.h}
              fill={previewCorridorSegment.fillColor}
              stroke={previewCorridorSegment.strokeColor}
              strokeWidth="3"
              strokeDasharray="6,4"
              opacity="0.5"
              className="pointer-events-none"
            />
          )}

          {/* Waypoint dots */}
          {isDrawingCorridor && corridorWaypoints.map((wp, wi) => (
            <circle
              key={`dot-${wi}`}
              cx={MARGIN + wp.col * CELL_SIZE + CELL_SIZE / 2}
              cy={MARGIN + wp.row * CELL_SIZE + CELL_SIZE / 2}
              r="4"
              fill="white"
              stroke="#1F2937"
              strokeWidth="2"
              className="pointer-events-none"
            />
          ))}

          {doorDrawStart && doorDrawEnd && (
            (() => {
              const edge = getBoundaryEdge(doorDrawStart.row, doorDrawStart.col);
              if (!edge) return null;

              const previewWidth = calculateDoorWidth(doorDrawStart, doorDrawEnd, edge);
              const gridX = Math.min(doorDrawStart.col, doorDrawEnd.col);
              const gridY = Math.min(doorDrawStart.row, doorDrawEnd.row);

              let x = MARGIN + gridX * CELL_SIZE;
              let y = MARGIN + gridY * CELL_SIZE;
              let width = CELL_SIZE;
              let height = CELL_SIZE;

              if (edge === 'top' || edge === 'bottom') {
                width = previewWidth * CELL_SIZE;
              } else {
                height = previewWidth * CELL_SIZE;
              }

              return (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill="#3B82F6"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeDasharray="4"
                  opacity="0.5"
                  className="pointer-events-none"
                />
              );
            })()
          )}

          {doors.map((door) => {
            let x = MARGIN + door.grid_x * CELL_SIZE;
            let y = MARGIN + door.grid_y * CELL_SIZE;
            let width = CELL_SIZE;
            let height = CELL_SIZE;
            let textX = x + (door.width * CELL_SIZE) / 2;
            let textY = y + CELL_SIZE / 2;
            let textAnchor: 'start' | 'middle' | 'end' = 'middle';
            let labelOffsetX = 0;
            let labelOffsetY = 0;

            if (door.edge === 'top' || door.edge === 'bottom') {
              width = door.width * CELL_SIZE;
              labelOffsetY = door.edge === 'top' ? -15 : CELL_SIZE + 15;
            } else {
              height = door.width * CELL_SIZE;
              textY = y + (door.width * CELL_SIZE) / 2;
              labelOffsetX = door.edge === 'left' ? -15 : CELL_SIZE + 15;
              textAnchor = door.edge === 'left' ? 'end' : 'start';
            }

            const doorColor = getDoorColor(door.type);

            // Tooltip position — always above the door
            const tooltipCenterX = (door.edge === 'top' || door.edge === 'bottom')
              ? x + width / 2
              : x + width / 2;
            const tooltipAnchorY = (door.edge === 'top')
              ? y - 8
              : (door.edge === 'bottom')
                ? y - 8
                : y - 8;

            return (
              <g key={door.id} style={{ pointerEvents: isDrawingCorridor ? 'none' : 'auto' }}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={doorColor}
                  stroke={doorColor}
                  strokeWidth="2"
                  opacity="0.7"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredDoor(door.id)}
                  onMouseLeave={() => setHoveredDoor(null)}
                  onMouseMove={(e) => {
                    if (!svgRef.current) return;
                    const { row, col } = screenToGrid(e.clientX, e.clientY);
                    if (col >= 0 && row >= 0 && col < gridDimensions.cols && row < gridDimensions.rows) {
                      const coordinate = getGridCoordinate(row, col);
                      setHoveredSquare({ row, col, label: coordinate.label });
                    }
                  }}
                />
                {/* Hover tooltip */}
                {hoveredDoor === door.id && (() => {
                  const textLen = door.name.length * 8.5 + 20;
                  return (
                    <g className="pointer-events-none">
                      <rect
                        x={tooltipCenterX - textLen / 2}
                        y={tooltipAnchorY - 22}
                        width={textLen}
                        height={26}
                        rx="5"
                        fill="#1F2937"
                        opacity="0.9"
                      />
                      <text
                        x={tooltipCenterX}
                        y={tooltipAnchorY - 9}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="14"
                        fontWeight="600"
                        fill="white"
                        className="select-none"
                      >
                        {door.name}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {/* ===== MATERIAL FLOW OVERLAY ===== */}
          {flowOverlayEnabled && (() => {
            // 1. Get activities with sequence_order, sorted
            const sequencedActivities = activities
              .filter((a: any) => a.sequence_order != null && a.sequence_order > 0)
              .sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0));

            if (sequencedActivities.length < 2) return null;

            // 2. Group activities by sequence_order
            const groupMap = new Map<number, Array<{ activity: any; x: number; y: number; zones: any[] }>>();
            for (const act of sequencedActivities) {
              const actZones = zones.filter((z: any) => z.activity_id === act.id);
              if (actZones.length === 0) continue;
              let cx = 0, cy = 0;
              for (const z of actZones) {
                cx += MARGIN + z.grid_x * CELL_SIZE + (z.grid_width * CELL_SIZE) / 2;
                cy += MARGIN + z.grid_y * CELL_SIZE + (z.grid_height * CELL_SIZE) / 2;
              }
              const node = { activity: act, x: cx / actZones.length, y: cy / actZones.length, zones: actZones };
              const seq = act.sequence_order as number;
              if (!groupMap.has(seq)) groupMap.set(seq, []);
              groupMap.get(seq)!.push(node);
            }

            // 3. Build group centroids — one point per sequence step
            const sortedSeqs = Array.from(groupMap.keys()).sort((a, b) => a - b);
            const groupCentroids = sortedSeqs.map(seq => {
              const nodes = groupMap.get(seq)!;
              const allZones = nodes.flatMap(n => n.zones);
              let cx = 0, cy = 0;
              for (const n of nodes) { cx += n.x; cy += n.y; }
              return { seq, x: cx / nodes.length, y: cy / nodes.length, nodes, allZones };
            });

            if (groupCentroids.length < 2) return null;

            // 4. Build flow segments between group centroids
            const processSegments: Array<{ from: typeof groupCentroids[0]; to: typeof groupCentroids[0] }> = [];
            for (let i = 0; i < groupCentroids.length - 1; i++) {
              processSegments.push({ from: groupCentroids[i], to: groupCentroids[i + 1] });
            }

            // 5. Identify inbound and outbound doors
            const inboundDoors = doors.filter((d: any) => d.has_inbound_material && (d.inbound_percentage ?? 0) > 0);
            const outboundDoors = doors.filter((d: any) => d.has_outbound_material && (d.outbound_percentage ?? 0) > 0);

            const firstGroup = groupCentroids[0];
            const lastGroup = groupCentroids[groupCentroids.length - 1];

            // 6. Build corridor graph ONCE for all routing
            const graph = buildCorridorGraph(corridors);
            const hasCorridorGraph = graph.nodes.size > 0;

            console.log('[Flow] Corridor graph:', graph.nodes.size, 'nodes,', graph.edges.length / 2, 'edges');
            if (hasCorridorGraph) {
              for (const [key, node] of graph.nodes) {
                console.log('[Flow]   Node:', key, '→ grid col:', node.x, 'row:', node.y);
              }
            }

            // Helper: convert pixel center back to grid col/row
            const pxToGrid = (px: { x: number; y: number }) => ({
              col: Math.floor((px.x - MARGIN) / CELL_SIZE),
              row: Math.floor((px.y - MARGIN) / CELL_SIZE),
            });

            // Helper: route a flow leg through corridors or fall back to Bézier
            const routeLeg = (fromPx: { x: number; y: number }, toPx: { x: number; y: number }, label?: string): string => {
              if (!hasCorridorGraph) {
                console.log('[Flow]', label || '', '→ no corridor graph, using Bézier');
                return buildBezierPath(fromPx.x, fromPx.y, toPx.x, toPx.y);
              }

              const fromGrid = pxToGrid(fromPx);
              const toGrid = pxToGrid(toPx);

              // Snap to nearest corridor nodes
              const snapFrom = findNearestNode(graph, fromGrid.col, fromGrid.row);
              const snapTo = findNearestNode(graph, toGrid.col, toGrid.row);

              console.log('[Flow]', label || '', '→ from grid:', fromGrid, 'to grid:', toGrid,
                'snapFrom:', snapFrom?.key, 'dist:', snapFrom?.distance,
                'snapTo:', snapTo?.key, 'dist:', snapTo?.distance);

              if (!snapFrom || !snapTo) {
                console.log('[Flow]', label || '', '→ snap failed, using Bézier');
                return buildBezierPath(fromPx.x, fromPx.y, toPx.x, toPx.y);
              }

              // Don't route if snap distance is too far (> 20 squares)
              if (snapFrom.distance > 20 || snapTo.distance > 20) {
                console.log('[Flow]', label || '', '→ snap too far, using Bézier');
                return buildBezierPath(fromPx.x, fromPx.y, toPx.x, toPx.y);
              }

              const gridPath = findPath(graph, snapFrom.key, snapTo.key);
              console.log('[Flow]', label || '', '→ path:', gridPath);

              if (!gridPath || gridPath.length < 1) {
                console.log('[Flow]', label || '', '→ no path found, using Bézier');
                return buildBezierPath(fromPx.x, fromPx.y, toPx.x, toPx.y);
              }

              // Build pixel polyline: source → corridor waypoints → destination
              const pixelPath: Array<{ x: number; y: number }> = [fromPx];
              for (const pt of gridPath) {
                pixelPath.push({
                  x: MARGIN + pt.x * CELL_SIZE + CELL_SIZE / 2,
                  y: MARGIN + pt.y * CELL_SIZE + CELL_SIZE / 2,
                });
              }
              pixelPath.push(toPx);

              console.log('[Flow]', label || '', '→ ROUTED through', gridPath.length, 'corridor waypoints');
              return buildPolylinePath(pixelPath);
            };

            // Helper: get door pixel center position
            const doorPixelCenter = (door: any) => {
              const gc = getDoorGridCenter(door);
              return {
                x: MARGIN + gc.x * CELL_SIZE + CELL_SIZE / 2,
                y: MARGIN + gc.y * CELL_SIZE + CELL_SIZE / 2,
              };
            };

            // Build all flow paths: inbound legs, process legs, outbound legs
            const allFlowPaths: Array<{ pathD: string; type: 'inbound' | 'process' | 'outbound'; label?: string }> = [];

            // Inbound: door → first sequence step (route through corridors)
            for (const door of inboundDoors) {
              const dp = doorPixelCenter(door);
              const pathD = routeLeg(dp, { x: firstGroup.x, y: firstGroup.y }, `INBOUND ${door.name} ${door.inbound_percentage}%`);
              const pct = door.inbound_percentage ?? 0;
              allFlowPaths.push({ pathD, type: 'inbound', label: `${pct}%` });
            }

            // Process: step-to-step (direct Bézier between adjacent zones)
            for (let pi = 0; pi < processSegments.length; pi++) {
              const seg = processSegments[pi];
              const pathD = buildBezierPath(seg.from.x, seg.from.y, seg.to.x, seg.to.y);
              allFlowPaths.push({ pathD, type: 'process' });
            }

            // Collect all individual zone nodes for badges
            const allNodes = groupCentroids.flatMap(g => g.nodes);

            // Color scheme: inbound = blue, process = slate, outbound = orange
            const flowColor = (type: string) => type === 'inbound' ? '#2563EB' : type === 'outbound' ? '#EA580C' : '#475569';
            const flowHalo = (type: string) => type === 'inbound' ? '#93C5FD' : type === 'outbound' ? '#FED7AA' : 'white';

            return (
              <g className="flow-overlay" style={{ pointerEvents: 'none' }}>
                {/* Arrowhead markers for each flow type */}
                <defs>
                  <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" opacity="0.8" />
                  </marker>
                  <marker id="flow-arrow-in" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563EB" opacity="0.8" />
                  </marker>
                  <marker id="flow-arrow-out" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#EA580C" opacity="0.8" />
                  </marker>
                  <style>{`
                    @keyframes flowDash {
                      to { stroke-dashoffset: -24; }
                    }
                  `}</style>
                </defs>

                {/* All flow arrows */}
                {allFlowPaths.map((fp, idx) => {
                  const markerSuffix = fp.type === 'inbound' ? '-in' : fp.type === 'outbound' ? '-out' : '';
                  const strokeW = fp.type === 'process' ? 2 : 2.5;
                  return (
                    <g key={`flow-${idx}`}>
                      {/* White halo for contrast */}
                      <path d={fp.pathD} fill="none" stroke={flowHalo(fp.type)} strokeWidth={strokeW + 3} opacity="0.5" strokeLinecap="round" strokeLinejoin="round" />
                      {/* Animated dashed line */}
                      <path
                        d={fp.pathD}
                        fill="none"
                        stroke={flowColor(fp.type)}
                        strokeWidth={strokeW}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="8,4"
                        markerEnd={`url(#flow-arrow${markerSuffix})`}
                        opacity="0.8"
                        style={{ animation: 'flowDash 1.5s linear infinite' }}
                      />
                    </g>
                  );
                })}

                {/* Percentage labels on inbound/outbound legs */}
                {allFlowPaths.filter(fp => fp.label).map((fp, idx) => {
                  // Parse first two coordinates from pathD to place label near start
                  const coords = fp.pathD.match(/[\d.]+/g);
                  if (!coords || coords.length < 4) return null;
                  const x1 = parseFloat(coords[0]);
                  const y1 = parseFloat(coords[1]);
                  const x2 = parseFloat(coords[2]);
                  const y2 = parseFloat(coords[3]);
                  // Place label 30% along the first segment
                  const lx = x1 + (x2 - x1) * 0.3;
                  const ly = y1 + (y2 - y1) * 0.3;
                  const color = flowColor(fp.type);
                  const textLen = (fp.label?.length || 0) * 7 + 12;
                  return (
                    <g key={`label-${idx}`}>
                      <rect x={lx - textLen / 2} y={ly - 10} width={textLen} height={20} rx="4" fill="white" opacity="0.9" />
                      <rect x={lx - textLen / 2} y={ly - 10} width={textLen} height={20} rx="4" fill="none" stroke={color} strokeWidth="1.5" opacity="0.8" />
                      <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill={color}>
                        {fp.label}
                      </text>
                    </g>
                  );
                })}

                {/* Circled sequence numbers — one badge per zone */}
                {allNodes.map((node, idx) => (
                  <g key={`seq-${idx}`}>
                    <circle
                      cx={node.x}
                      cy={node.y - (node.zones[0]?.grid_height || 2) * CELL_SIZE / 2 - 14}
                      r="11"
                      fill="#1E293B"
                      opacity="0.85"
                    />
                    <text
                      x={node.x}
                      y={node.y - (node.zones[0]?.grid_height || 2) * CELL_SIZE / 2 - 14}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="11"
                      fontWeight="700"
                      fill="white"
                    >
                      {node.activity.sequence_order}
                    </text>
                  </g>
                ))}

                {/* Door flow badges — show inbound/outbound role on each tagged door */}
                {[...inboundDoors, ...outboundDoors].filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i).map((door: any) => {
                  const dp = doorPixelCenter(door);
                  const isIn = door.has_inbound_material && (door.inbound_percentage ?? 0) > 0;
                  const isOut = door.has_outbound_material && (door.outbound_percentage ?? 0) > 0;
                  const label = isIn && isOut ? 'IN/OUT' : isIn ? 'IN' : 'OUT';
                  const badgeColor = isIn && isOut ? '#7C3AED' : isIn ? '#2563EB' : '#EA580C';
                  const badgeW = label.length * 8 + 12;
                  // Offset badge outward from the door edge
                  const offsetX = door.edge === 'left' ? -badgeW / 2 - 8 : door.edge === 'right' ? badgeW / 2 + 8 : 0;
                  const offsetY = door.edge === 'top' ? -20 : door.edge === 'bottom' ? 20 : 0;
                  return (
                    <g key={`door-badge-${door.id}`}>
                      <rect x={dp.x + offsetX - badgeW / 2} y={dp.y + offsetY - 9} width={badgeW} height={18} rx="4" fill={badgeColor} opacity="0.9" />
                      <text x={dp.x + offsetX} y={dp.y + offsetY} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill="white">
                        {label}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {Array.from({ length: gridDimensions.cols + 1 }).map((_, i) => (
            <line
              key={`v-${i}`}
              x1={MARGIN + i * CELL_SIZE}
              y1={MARGIN}
              x2={MARGIN + i * CELL_SIZE}
              y2={MARGIN + gridHeight}
              stroke="#E5E7EB"
              strokeWidth="1"
            />
          ))}

          {Array.from({ length: gridDimensions.rows + 1 }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1={MARGIN}
              y1={MARGIN + i * CELL_SIZE}
              x2={MARGIN + gridWidth}
              y2={MARGIN + i * CELL_SIZE}
              stroke="#E5E7EB"
              strokeWidth="1"
            />
          ))}

          {Array.from({ length: gridDimensions.cols }).map((_, i) => {
            const isHighlighted = hoveredSquare?.col === i;
            return (
              <text
                key={`col-${i}`}
                x={MARGIN + i * CELL_SIZE + CELL_SIZE / 2}
                y={MARGIN - 12}
                textAnchor="middle"
                fontSize="14"
                fill={isHighlighted ? '#1F2937' : '#9CA3AF'}
                fontWeight={isHighlighted ? 'bold' : 'normal'}
                className="select-none pointer-events-none transition-all"
              >
                {getColumnLabel(i)}
              </text>
            );
          })}

          {Array.from({ length: gridDimensions.rows }).map((_, i) => {
            const isHighlighted = hoveredSquare?.row === i;
            return (
              <text
                key={`row-${i}`}
                x={MARGIN - 12}
                y={MARGIN + i * CELL_SIZE + CELL_SIZE / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="14"
                fill={isHighlighted ? '#1F2937' : '#9CA3AF'}
                fontWeight={isHighlighted ? 'bold' : 'normal'}
                className="select-none pointer-events-none transition-all"
              >
                {getRowLabel(i)}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Layout-only toast */}
      {layoutOnlyToast && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900/90 backdrop-blur text-white px-5 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          You can only change this in the <strong>Layout</strong> step
        </div>
      )}
    </div>
  );
}
