import { useRef, useMemo, useState, useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { useGestures } from '../hooks/useGestures';
import { getGridCoordinate, getRowLabel, getColumnLabel } from '../utils/coordinates';
import { supabase } from '../lib/supabase';
import { Zone, PlacedObject, GridCoordinate, Door, DoorType, Corridor } from '../types';
import { getActivityColor, getActivityBorderColor, getCorridorColor, getCorridorBorderColor, OSHA_COLORS } from '../utils/oshaColors';

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
    selectedCorridorType,
    setSelectedCorridorType,
    hoveredSquare,
    setHoveredSquare,
    updateCorridor,
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
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dragCleanupRef.current) {
          dragCleanupRef.current();
          dragCleanupRef.current = null;
        }
        if (isDrawingCorridor) {
          setIsDrawingCorridor(false);
          setCorridorDrawStart(null);
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

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isDrawingZone, paintMode, isAddingDoor, isDraggingObject, isDrawingCorridor, setIsDrawingZone, setPaintMode, setSelectedActivityForZone, setIsAddingDoor, setDoorDrawStart, setDoorDrawEnd, setIsDrawingCorridor, setCorridorDrawStart, setSelectedCorridorType, draggingZone, setDraggingZone, resizingZone, setResizingZone, setDragOffset, holdTimer]);


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
      setCorridors(corridorsResult.data as Corridor[]);
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

    // CORRIDOR HANDLING - MUST BE FIRST
    if (isDrawingCorridor && selectedCorridorType) {
      if (!canInteractWithZones()) return;

      if (!corridorDrawStart) {
        setCorridorDrawStart({ row, col, label: getGridCoordinate(row, col).label });
      } else {
        if (previewCorridor && previewCorridor.isValid) {
          createCorridor(corridorDrawStart, { row, col, label: getGridCoordinate(row, col).label }, selectedCorridorType);
        }
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

  const createCorridor = async (start: GridCoordinate, end: GridCoordinate, type: 'pedestrian' | 'forklift') => {
    const width = type === 'pedestrian' ? 1 : 2;
    const color = getCorridorColor(type);
    const defaultName = `Corridor ${corridors.length + 1}`;

    const { activeLayoutId: lid } = useGridStore.getState();
    const { data, error } = await supabase
      .from('corridors')
      .insert({
        name: defaultName,
        type,
        start_grid_x: start.col,
        start_grid_y: start.row,
        end_grid_x: end.col,
        end_grid_y: end.row,
        width,
        color,
        layout_id: lid,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating corridor:', error);

      // Fallback: Add to local state even if database fails
      const fallbackCorridor: Corridor = {
        id: `temp-${Date.now()}`,
        name: defaultName,
        type,
        start_grid_x: start.col,
        start_grid_y: start.row,
        end_grid_x: end.col,
        end_grid_y: end.row,
        width,
        color,
        created_at: new Date().toISOString(),
      };
      addCorridor(fallbackCorridor);
      setCorridorDrawStart(null);
      return;
    }

    if (data) {
      addCorridor(data as Corridor);
      setCorridorDrawStart(null);
    }
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
    if (!canInteractWithObjects()) return;
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
    if (!canInteractWithZones()) return;
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

  const previewCorridor = useMemo(() => {
    if (!isDrawingCorridor || !corridorDrawStart || !hoveredSquare || !selectedCorridorType) return null;

    const startCol = corridorDrawStart.col;
    const startRow = corridorDrawStart.row;
    const endCol = hoveredSquare.col;
    const endRow = hoveredSquare.row;

    const deltaX = Math.abs(endCol - startCol);
    const deltaY = Math.abs(endRow - startRow);

    let isHorizontal = deltaX > deltaY;
    let actualEndCol = endCol;
    let actualEndRow = endRow;

    if (isHorizontal) {
      actualEndRow = startRow;
    } else {
      actualEndCol = startCol;
    }

    const minCol = Math.min(startCol, actualEndCol);
    const maxCol = Math.max(startCol, actualEndCol);
    const minRow = Math.min(startRow, actualEndRow);
    const maxRow = Math.max(startRow, actualEndRow);

    const width = selectedCorridorType === 'pedestrian' ? 1 : 2;
    const fillColor = getCorridorColor(selectedCorridorType);
    const strokeColor = getCorridorBorderColor(selectedCorridorType);

    let isValid = true;
    let invalidReason = '';

    if (isHorizontal) {
      if (maxCol >= gridDimensions.cols || minRow + width > gridDimensions.rows) {
        isValid = false;
        invalidReason = 'Corridor extends beyond grid boundaries';
      }
    } else {
      if (maxRow >= gridDimensions.rows || minCol + width > gridDimensions.cols) {
        isValid = false;
        invalidReason = 'Corridor extends beyond grid boundaries';
      }
    }

    if (isValid) {
      if (isHorizontal) {
        for (let c = minCol; c <= maxCol; c++) {
          for (let r = minRow; r < minRow + width; r++) {
            const key = `${r}-${c}`;
            const painted = paintedSquares.get(key);
            if (painted && painted.type === 'permanent') {
              isValid = false;
              invalidReason = 'Cannot cross permanent (dark gray) squares';
              break;
            }
          }
          if (!isValid) break;
        }
      } else {
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c < minCol + width; c++) {
            const key = `${r}-${c}`;
            const painted = paintedSquares.get(key);
            if (painted && painted.type === 'permanent') {
              isValid = false;
              invalidReason = 'Cannot cross permanent (dark gray) squares';
              break;
            }
          }
          if (!isValid) break;
        }
      }
    }

    if (isHorizontal) {
      return {
        x: MARGIN + minCol * CELL_SIZE,
        y: MARGIN + minRow * CELL_SIZE,
        width: (maxCol - minCol + 1) * CELL_SIZE,
        height: width * CELL_SIZE,
        fillColor: isValid ? fillColor : '#EF4444',
        strokeColor: isValid ? strokeColor : '#DC2626',
        isValid,
        invalidReason,
        startCol: minCol,
        startRow: minRow,
        endCol: maxCol,
        endRow: minRow,
      };
    } else {
      return {
        x: MARGIN + minCol * CELL_SIZE,
        y: MARGIN + minRow * CELL_SIZE,
        width: width * CELL_SIZE,
        height: (maxRow - minRow + 1) * CELL_SIZE,
        fillColor: isValid ? fillColor : '#EF4444',
        strokeColor: isValid ? strokeColor : '#DC2626',
        isValid,
        invalidReason,
        startCol: minCol,
        startRow: minRow,
        endCol: minCol,
        endRow: maxRow,
      };
    }
  }, [isDrawingCorridor, corridorDrawStart, hoveredSquare, selectedCorridorType, gridDimensions, paintedSquares]);

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
            {!corridorDrawStart ? 'click start point' : 'click end point'}
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
              <g key={zone.id} onClick={(e) => handleZoneClick(e, zone)}>
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
                  cursor: 'move'
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
            const minCol = Math.min(corridor.start_grid_x, corridor.end_grid_x);
            const maxCol = Math.max(corridor.start_grid_x, corridor.end_grid_x);
            const minRow = Math.min(corridor.start_grid_y, corridor.end_grid_y);
            const maxRow = Math.max(corridor.start_grid_y, corridor.end_grid_y);

            const isHorizontal = corridor.start_grid_y === corridor.end_grid_y;

            const x = MARGIN + minCol * CELL_SIZE;
            const y = MARGIN + minRow * CELL_SIZE;
            const width = isHorizontal ? (maxCol - minCol + 1) * CELL_SIZE : corridor.width * CELL_SIZE;
            const height = isHorizontal ? corridor.width * CELL_SIZE : (maxRow - minRow + 1) * CELL_SIZE;

            const centerX = x + width / 2;
            const centerY = y + height / 2;

            const fillColor = getCorridorColor(corridor.type);
            const strokeColor = getCorridorBorderColor(corridor.type);
            const textColor = getCorridorBorderColor(corridor.type);

            return (
              <g key={corridor.id} onClick={(e) => {
                e.stopPropagation();
                setSelectedCorridor(corridor);
              }}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
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
                {/* Icon instead of text label */}
                {corridor.type === 'pedestrian' ? (
                  /* Walking person silhouette */
                  <g transform={`translate(${centerX - 8}, ${centerY - 10})`} className="pointer-events-none" opacity="0.7">
                    <circle cx="8" cy="3" r="2.5" fill={textColor} />
                    <path d="M5 7.5 L8 13 L6 20 M11 7.5 L8 13 L10 20 M4 10 L8 9 L12 10" stroke={textColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </g>
                ) : (
                  /* Forklift — cab with roll cage, mast, forks, wheels */
                  <g transform={`translate(${centerX - 16}, ${centerY - 14})`} className="pointer-events-none" opacity="0.7">
                    {/* Cab body */}
                    <rect x="6" y="6" width="14" height="14" rx="2" fill={textColor} opacity="0.25" />
                    <rect x="6" y="6" width="14" height="14" rx="2" stroke={textColor} strokeWidth="1.8" fill="none" />
                    {/* Roll cage / roof */}
                    <line x1="8" y1="6" x2="8" y2="2" stroke={textColor} strokeWidth="1.8" strokeLinecap="round" />
                    <line x1="18" y1="6" x2="18" y2="2" stroke={textColor} strokeWidth="1.8" strokeLinecap="round" />
                    <line x1="7" y1="2" x2="19" y2="2" stroke={textColor} strokeWidth="1.8" strokeLinecap="round" />
                    {/* Mast (vertical bar in front) */}
                    <line x1="24" y1="4" x2="24" y2="20" stroke={textColor} strokeWidth="2.2" strokeLinecap="round" />
                    {/* Forks (two horizontal prongs) */}
                    <line x1="24" y1="18" x2="32" y2="18" stroke={textColor} strokeWidth="2" strokeLinecap="round" />
                    <line x1="24" y1="22" x2="32" y2="22" stroke={textColor} strokeWidth="2" strokeLinecap="round" />
                    {/* Wheels */}
                    <circle cx="9" cy="23" r="2.8" fill={textColor} />
                    <circle cx="17" cy="23" r="2.8" fill={textColor} />
                    {/* Steering wheel hint */}
                    <circle cx="10" cy="13" r="1.5" stroke={textColor} strokeWidth="1.2" fill="none" />
                  </g>
                )}

                {/* Resize handles — visible on hover */}
                {hoveredCorridor === corridor.id && !isDrawingCorridor && !isDrawingZone && (() => {
                  const handleSize = 8;
                  const handleStyle = { fill: 'white', stroke: '#1F2937', strokeWidth: 2 };

                  // Two endpoint handles along the corridor's main axis
                  const handles = isHorizontal
                    ? [
                        // Left end
                        { hx: x - handleSize / 2, hy: y + height / 2 - handleSize / 2, cursor: 'ew-resize', end: 'min' as const },
                        // Right end
                        { hx: x + width - handleSize / 2, hy: y + height / 2 - handleSize / 2, cursor: 'ew-resize', end: 'max' as const },
                      ]
                    : [
                        // Top end
                        { hx: x + width / 2 - handleSize / 2, hy: y - handleSize / 2, cursor: 'ns-resize', end: 'min' as const },
                        // Bottom end
                        { hx: x + width / 2 - handleSize / 2, hy: y + height - handleSize / 2, cursor: 'ns-resize', end: 'max' as const },
                      ];

                  return (
                    <g>
                      {handles.map((h, idx) => (
                        <rect
                          key={`ch-${idx}`}
                          x={h.hx}
                          y={h.hy}
                          width={handleSize}
                          height={handleSize}
                          {...handleStyle}
                          style={{ cursor: h.cursor }}
                          onMouseEnter={() => setHoveredCorridor(corridor.id)}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (!canInteractWithZones()) return;
                            if (!svgRef.current) return;

                            const startGrid = screenToGrid(e.clientX, e.clientY);

                            // Determine which grid coord this handle controls
                            const edgeSvgVal = isHorizontal
                              ? MARGIN + (h.end === 'min' ? minCol : maxCol + 1) * CELL_SIZE
                              : MARGIN + (h.end === 'min' ? minRow : maxRow + 1) * CELL_SIZE;

                            const offsetVal = isHorizontal
                              ? startGrid.svgX - edgeSvgVal
                              : startGrid.svgY - edgeSvgVal;

                            // Snapshot original values so we can revert if needed
                            const origStartX = corridor.start_grid_x;
                            const origStartY = corridor.start_grid_y;
                            const origEndX = corridor.end_grid_x;
                            const origEndY = corridor.end_grid_y;

                            // Track mutable copy
                            const live = { start_grid_x: origStartX, start_grid_y: origStartY, end_grid_x: origEndX, end_grid_y: origEndY };

                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              if (!svgRef.current) return;
                              if (moveEvent.buttons === 0) { handleMouseUp(); return; }

                              const moveGrid = screenToGrid(moveEvent.clientX, moveEvent.clientY);

                              if (isHorizontal) {
                                const adjustedX = moveGrid.svgX - offsetVal;
                                let col = Math.round((adjustedX - MARGIN) / CELL_SIZE);

                                if (h.end === 'min') {
                                  // Dragging the left end — don't pass the other end
                                  const otherCol = Math.max(origStartX, origEndX);
                                  col = Math.max(0, Math.min(col, otherCol));
                                  // Update whichever original point was the min
                                  if (origStartX <= origEndX) {
                                    live.start_grid_x = col;
                                  } else {
                                    live.end_grid_x = col;
                                  }
                                } else {
                                  // Dragging the right end
                                  const otherCol = Math.min(origStartX, origEndX);
                                  col = Math.min(gridDimensions.cols - 1, Math.max(col - 1, otherCol));
                                  if (origStartX >= origEndX) {
                                    live.start_grid_x = col;
                                  } else {
                                    live.end_grid_x = col;
                                  }
                                }
                              } else {
                                const adjustedY = moveGrid.svgY - offsetVal;
                                let row = Math.round((adjustedY - MARGIN) / CELL_SIZE);

                                if (h.end === 'min') {
                                  const otherRow = Math.max(origStartY, origEndY);
                                  row = Math.max(0, Math.min(row, otherRow));
                                  if (origStartY <= origEndY) {
                                    live.start_grid_y = row;
                                  } else {
                                    live.end_grid_y = row;
                                  }
                                } else {
                                  const otherRow = Math.min(origStartY, origEndY);
                                  row = Math.min(gridDimensions.rows - 1, Math.max(row - 1, otherRow));
                                  if (origStartY >= origEndY) {
                                    live.start_grid_y = row;
                                  } else {
                                    live.end_grid_y = row;
                                  }
                                }
                              }

                              updateCorridor(corridor.id, { ...live });
                            };

                            const handleMouseUp = async () => {
                              window.removeEventListener('mousemove', handleMouseMove);
                              window.removeEventListener('mouseup', handleMouseUp);
                              dragCleanupRef.current = null;

                              // Persist the current state from the store
                              const current = useGridStore.getState().corridors.find(c => c.id === corridor.id);
                              if (current) {
                                await supabase
                                  .from('corridors')
                                  .update({
                                    start_grid_x: current.start_grid_x,
                                    start_grid_y: current.start_grid_y,
                                    end_grid_x: current.end_grid_x,
                                    end_grid_y: current.end_grid_y,
                                  })
                                  .eq('id', corridor.id);
                              }
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
              </g>
            );
          })}

          {previewCorridor && (
            <>
              <rect
                x={previewCorridor.x}
                y={previewCorridor.y}
                width={previewCorridor.width}
                height={previewCorridor.height}
                fill={previewCorridor.fillColor}
                stroke={previewCorridor.strokeColor}
                strokeWidth="3"
                opacity={previewCorridor.isValid ? 0.6 : 0.4}
                className="pointer-events-none"
              />
              {!previewCorridor.isValid && previewCorridor.invalidReason && (
                <text
                  x={previewCorridor.x + previewCorridor.width / 2}
                  y={previewCorridor.y + previewCorridor.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#DC2626"
                  fontSize="14"
                  fontWeight="bold"
                  className="pointer-events-none"
                >
                  ✗ INVALID
                </text>
              )}
            </>
          )}

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
              <g key={door.id}>
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
                y={MARGIN - 10}
                textAnchor="middle"
                fontSize="10"
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
                x={MARGIN - 10}
                y={MARGIN + i * CELL_SIZE + CELL_SIZE / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
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

    </div>
  );
}
