import { create } from 'zustand';
import { GridSettings, ViewportState, GridCoordinate, GridDimensions, CustomObject, PlacedObject, Zone, Door, Activity, VolumeTiming, ActivityRelationship, Corridor, CorridorType } from '../types';
import { supabase } from '../lib/supabase';

export type PaintMode = 'permanent' | 'semi-fixed' | 'clear' | null;
export type SubStep = '2a' | '2b' | '2c' | '2d' | '2e' | '2f';

export interface PaintedSquare {
  row: number;
  col: number;
  type: 'permanent' | 'semi-fixed';
  label?: string;
}

interface GridStore {
  settings: GridSettings;
  viewport: ViewportState;
  customObjects: CustomObject[];
  placedObjects: PlacedObject[];
  zones: Zone[];
  doors: Door[];
  corridors: Corridor[];
  activities: Activity[];
  volumeTiming: VolumeTiming[];
  activityRelationships: ActivityRelationship[];
  selectedObject: PlacedObject | null;
  selectedZone: Zone | null;
  selectedDoor: Door | null;
  selectedCorridor: Corridor | null;
  isDrawingZone: boolean;
  zoneDrawStart: GridCoordinate | null;
  selectedActivityForZone: string | null;
  zoneDrawWidth: number;
  zoneDrawHeight: number;
  draggingZone: Zone | null;
  resizingZone: Zone | null;
  resizingZoneEdge: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null;
  isDrawingCorridor: boolean;
  corridorDrawStart: GridCoordinate | null;
  selectedCorridorType: CorridorType | null;
  doorDrawStart: GridCoordinate | null;
  doorDrawEnd: GridCoordinate | null;
  draggingDoor: Door | null;
  resizingDoor: Door | null;
  resizeEdge: 'start' | 'end' | null;
  draggingObject: CustomObject | null;
  dragPreviewPosition: GridCoordinate | null;
  repositioningObject: PlacedObject | null;
  isAddingDoor: boolean;
  sidebarOpen: boolean;
  hoveredSquare: { row: number; col: number; label: string } | null;
  settingsPanelOpen: boolean;
  stepCompletion: {
    step1: boolean;
    step2: boolean;
    step3: boolean;
    step4: boolean;
  };
  paintMode: PaintMode;
  paintedSquares: Map<string, PaintedSquare>;
  currentStep: number;
  currentSubStep: SubStep;
  safetyOverlayEnabled: boolean;
  dismissedFlags: Set<string>;
  updateSettings: (settings: Partial<GridSettings>) => void;
  setZoom: (zoom: number, centerX?: number, centerY?: number) => void;
  setPan: (panX: number, panY: number) => void;
  setSelectedSquare: (square: GridCoordinate | null) => void;
  getGridDimensions: () => GridDimensions;
  setCustomObjects: (objects: CustomObject[]) => void;
  addCustomObject: (object: CustomObject) => void;
  setPlacedObjects: (objects: PlacedObject[]) => void;
  addPlacedObject: (object: PlacedObject) => void;
  updatePlacedObject: (id: string, updates: Partial<PlacedObject>) => void;
  deletePlacedObject: (id: string) => void;
  setZones: (zones: Zone[]) => void;
  addZone: (zone: Zone) => void;
  updateZone: (id: string, updates: Partial<Zone>) => void;
  deleteZone: (id: string) => void;
  setDoors: (doors: Door[]) => void;
  addDoor: (door: Door) => void;
  updateDoor: (id: string, updates: Partial<Door>) => void;
  deleteDoor: (id: string) => void;
  setCorridors: (corridors: Corridor[]) => void;
  addCorridor: (corridor: Corridor) => void;
  updateCorridor: (id: string, updates: Partial<Corridor>) => void;
  deleteCorridor: (id: string) => void;
  setSelectedObject: (object: PlacedObject | null) => void;
  setSelectedZone: (zone: Zone | null) => void;
  setSelectedDoor: (door: Door | null) => void;
  setSelectedCorridor: (corridor: Corridor | null) => void;
  setIsDrawingCorridor: (isDrawing: boolean) => void;
  setCorridorDrawStart: (start: GridCoordinate | null) => void;
  setSelectedCorridorType: (type: CorridorType | null) => void;
  setIsDrawingZone: (isDrawing: boolean) => void;
  setZoneDrawStart: (start: GridCoordinate | null) => void;
  setSelectedActivityForZone: (activityId: string | null) => void;
  setZoneDrawWidth: (width: number) => void;
  setZoneDrawHeight: (height: number) => void;
  setDraggingZone: (zone: Zone | null) => void;
  setResizingZone: (zone: Zone | null, edge?: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null) => void;
  setDoorDrawStart: (start: GridCoordinate | null) => void;
  setDoorDrawEnd: (end: GridCoordinate | null) => void;
  setDraggingDoor: (door: Door | null) => void;
  setResizingDoor: (door: Door | null, edge: 'start' | 'end' | null) => void;
  setDraggingObject: (object: CustomObject | null) => void;
  setDragPreviewPosition: (position: GridCoordinate | null) => void;
  setRepositioningObject: (object: PlacedObject | null) => void;
  setIsAddingDoor: (isAdding: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsPanelOpen: (open: boolean) => void;
  setHoveredSquare: (square: { row: number; col: number; label: string } | null) => void;
  completeStep: (step: 'step1' | 'step2' | 'step3' | 'step4') => void;
  setPaintMode: (mode: PaintMode) => void;
  setPaintedSquares: (squares: Map<string, PaintedSquare>) => void;
  paintSquare: (row: number, col: number) => void;
  unpaintSquare: (row: number, col: number) => void;
  updateSquareLabel: (row: number, col: number, label: string) => void;
  getPaintedSquareCounts: () => { permanent: number; semFixed: number; available: number };
  loadSettings: () => Promise<void>;
  saveSettingsToDb: () => Promise<void>;
  saveStepCompletionToDb: () => Promise<void>;
  setActivities: (activities: Activity[]) => void;
  addActivity: (activity: Activity) => void;
  updateActivity: (id: string, updates: Partial<Activity>) => void;
  deleteActivity: (id: string) => void;
  loadActivities: () => Promise<void>;
  setVolumeTiming: (volumeTiming: VolumeTiming[]) => void;
  updateVolumeTiming: (activityId: string, typicalVolume: number, peakVolume: number, typicalUnitsOnFloor?: number, peakUnitsOnFloor?: number) => void;
  loadVolumeTiming: () => Promise<void>;
  setActivityRelationships: (relationships: ActivityRelationship[]) => void;
  updateRelationship: (activityAId: string, activityBId: string, rating: string, reason?: string) => void;
  loadActivityRelationships: () => Promise<void>;
  setCurrentStep: (step: number) => void;
  setCurrentSubStep: (subStep: SubStep) => void;
  canInteractWithDoors: () => boolean;
  canInteractWithZones: () => boolean;
  canInteractWithObjects: () => boolean;
  canPaintSquares: () => boolean;
  toggleSafetyOverlay: () => void;
  dismissFlag: (flagId: string) => void;
  undismissFlag: (flagId: string) => void;
  isFlagDismissed: (flagId: string) => boolean;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

export const useGridStore = create<GridStore>((set, get) => ({
  settings: {
    facilityWidth: 155,
    facilityHeight: 155,
    squareSize: 5,
    measurementSystem: 'US',
    typicalFlowUnit: 'box',
    unitFootprintSqFt: 4,
    stackingHeight: 1,
    accessFactor: 1.3,
  },
  viewport: {
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedSquare: null,
  },
  customObjects: [],
  placedObjects: [],
  zones: [],
  doors: [],
  corridors: [],
  activities: [],
  volumeTiming: [],
  activityRelationships: [],
  selectedObject: null,
  selectedZone: null,
  selectedDoor: null,
  selectedCorridor: null,
  isDrawingZone: false,
  zoneDrawStart: null,
  selectedActivityForZone: null,
  zoneDrawWidth: 3,
  zoneDrawHeight: 3,
  draggingZone: null,
  resizingZone: null,
  resizingZoneEdge: null,
  isDrawingCorridor: false,
  corridorDrawStart: null,
  selectedCorridorType: null,
  doorDrawStart: null,
  doorDrawEnd: null,
  draggingDoor: null,
  resizingDoor: null,
  resizeEdge: null,
  draggingObject: null,
  dragPreviewPosition: null,
  repositioningObject: null,
  isAddingDoor: false,
  sidebarOpen: true,
  settingsPanelOpen: true,
  hoveredSquare: null,
  stepCompletion: {
    step1: false,
    step2: false,
    step3: false,
    step4: false,
  },
  paintMode: null,
  paintedSquares: new Map(),
  currentStep: 1,
  currentSubStep: '2a',
  safetyOverlayEnabled: false,
  dismissedFlags: new Set(),

  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
      viewport: { ...state.viewport, selectedSquare: null },
    }));
    get().saveSettingsToDb();
  },

  setZoom: (zoom, centerX, centerY) => {
    set((state) => {
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

      if (centerX !== undefined && centerY !== undefined) {
        const zoomRatio = clampedZoom / state.viewport.zoom;
        const newPanX = centerX - (centerX - state.viewport.panX) * zoomRatio;
        const newPanY = centerY - (centerY - state.viewport.panY) * zoomRatio;

        return {
          viewport: {
            ...state.viewport,
            zoom: clampedZoom,
            panX: newPanX,
            panY: newPanY,
          },
        };
      }

      return {
        viewport: { ...state.viewport, zoom: clampedZoom },
      };
    });
  },

  setPan: (panX, panY) => {
    set((state) => ({
      viewport: { ...state.viewport, panX, panY },
    }));
  },

  setSelectedSquare: (square) => {
    set((state) => ({
      viewport: { ...state.viewport, selectedSquare: square },
    }));
  },

  getGridDimensions: () => {
    const { settings } = get();
    return {
      rows: Math.ceil(settings.facilityHeight / settings.squareSize),
      cols: Math.ceil(settings.facilityWidth / settings.squareSize),
    };
  },

  setCustomObjects: (objects) => set({ customObjects: objects }),

  addCustomObject: (object) => set((state) => ({
    customObjects: [...state.customObjects, object],
  })),

  setPlacedObjects: (objects) => set({ placedObjects: objects }),

  addPlacedObject: (object) => set((state) => ({
    placedObjects: [...state.placedObjects, object],
  })),

  updatePlacedObject: (id, updates) => set((state) => ({
    placedObjects: state.placedObjects.map((obj) =>
      obj.id === id ? { ...obj, ...updates } : obj
    ),
  })),

  deletePlacedObject: (id) => set((state) => ({
    placedObjects: state.placedObjects.filter((obj) => obj.id !== id),
    selectedObject: state.selectedObject?.id === id ? null : state.selectedObject,
  })),

  setZones: (zones) => set({ zones }),

  addZone: (zone) => set((state) => ({
    zones: [...state.zones, zone],
  })),

  updateZone: (id, updates) => set((state) => ({
    zones: state.zones.map((zone) =>
      zone.id === id ? { ...zone, ...updates } : zone
    ),
  })),

  deleteZone: (id) => set((state) => ({
    zones: state.zones.filter((zone) => zone.id !== id),
    selectedZone: state.selectedZone?.id === id ? null : state.selectedZone,
  })),

  setDoors: (doors) => set({ doors }),

  addDoor: (door) => set((state) => ({
    doors: [...state.doors, door],
  })),

  updateDoor: (id, updates) => set((state) => ({
    doors: state.doors.map((door) =>
      door.id === id ? { ...door, ...updates } : door
    ),
  })),

  deleteDoor: (id) => set((state) => ({
    doors: state.doors.filter((door) => door.id !== id),
    selectedDoor: state.selectedDoor?.id === id ? null : state.selectedDoor,
  })),

  setCorridors: (corridors) => set({ corridors }),

  addCorridor: (corridor) => set((state) => ({
    corridors: [...state.corridors, corridor],
  })),

  updateCorridor: (id, updates) => set((state) => ({
    corridors: state.corridors.map((corridor) =>
      corridor.id === id ? { ...corridor, ...updates } : corridor
    ),
  })),

  deleteCorridor: (id) => set((state) => ({
    corridors: state.corridors.filter((corridor) => corridor.id !== id),
    selectedCorridor: state.selectedCorridor?.id === id ? null : state.selectedCorridor,
  })),

  setSelectedObject: (object) => set({
    selectedObject: object,
    selectedZone: null,
    selectedDoor: null,
    selectedCorridor: null,
  }),

  setSelectedZone: (zone) => set({
    selectedZone: zone,
    selectedObject: null,
    selectedDoor: null,
    selectedCorridor: null,
  }),

  setSelectedDoor: (door) => set({
    selectedDoor: door,
    selectedObject: null,
    selectedZone: null,
    selectedCorridor: null,
  }),

  setSelectedCorridor: (corridor) => set({
    selectedCorridor: corridor,
    selectedObject: null,
    selectedZone: null,
    selectedDoor: null,
  }),

  setIsDrawingCorridor: (isDrawing) => set({ isDrawingCorridor: isDrawing }),

  setCorridorDrawStart: (start) => set({ corridorDrawStart: start }),

  setSelectedCorridorType: (type) => set({ selectedCorridorType: type }),

  setIsDrawingZone: (isDrawing) => set({ isDrawingZone: isDrawing }),

  setIsAddingDoor: (isAdding) => set({ isAddingDoor: isAdding }),

  setZoneDrawStart: (start) => set({ zoneDrawStart: start }),

  setSelectedActivityForZone: (activityId) => set({ selectedActivityForZone: activityId }),

  setZoneDrawWidth: (width) => set({ zoneDrawWidth: width }),

  setZoneDrawHeight: (height) => set({ zoneDrawHeight: height }),

  setDraggingZone: (zone) => set({ draggingZone: zone }),

  setResizingZone: (zone, edge) => set({ resizingZone: zone, resizingZoneEdge: edge || null }),

  setDoorDrawStart: (start) => set({ doorDrawStart: start }),

  setDoorDrawEnd: (end) => set({ doorDrawEnd: end }),

  setDraggingDoor: (door) => set({ draggingDoor: door }),

  setResizingDoor: (door, edge) => set({ resizingDoor: door, resizeEdge: edge }),

  setDraggingObject: (object) => set({ draggingObject: object }),

  setDragPreviewPosition: (position) => set({ dragPreviewPosition: position }),

  setRepositioningObject: (object) => set({ repositioningObject: object }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setSettingsPanelOpen: (open) => set({ settingsPanelOpen: open }),

  setHoveredSquare: (square) => set({ hoveredSquare: square }),

  completeStep: (step) => {
    set((state) => ({
      stepCompletion: { ...state.stepCompletion, [step]: true },
    }));
    get().saveStepCompletionToDb();
  },

  setPaintMode: (mode) => set({ paintMode: mode }),

  setPaintedSquares: (squares) => set({ paintedSquares: squares }),

  paintSquare: (row, col) => set((state) => {
    const key = `${row}-${col}`;
    const newMap = new Map(state.paintedSquares);

    if (state.paintMode === 'permanent' || state.paintMode === 'semi-fixed') {
      newMap.set(key, { row, col, type: state.paintMode });
    }

    return { paintedSquares: newMap };
  }),

  unpaintSquare: (row, col) => set((state) => {
    const key = `${row}-${col}`;
    const newMap = new Map(state.paintedSquares);
    newMap.delete(key);
    return { paintedSquares: newMap };
  }),

  updateSquareLabel: (row, col, label) => set((state) => {
    const key = `${row}-${col}`;
    const newMap = new Map(state.paintedSquares);
    const existing = newMap.get(key);

    if (existing) {
      newMap.set(key, { ...existing, label });
    }

    return { paintedSquares: newMap };
  }),

  getPaintedSquareCounts: () => {
    const state = get();
    const dimensions = state.getGridDimensions();
    const totalSquares = dimensions.rows * dimensions.cols;

    let permanent = 0;
    let semFixed = 0;

    state.paintedSquares.forEach((square) => {
      if (square.type === 'permanent') permanent++;
      else if (square.type === 'semi-fixed') semFixed++;
    });

    return {
      permanent,
      semFixed,
      available: totalSquares - permanent - semFixed,
    };
  },

  loadSettings: async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error loading settings:', error);
      return;
    }

    if (data) {
      set({
        settings: {
          facilityWidth: data.facility_width,
          facilityHeight: data.facility_height,
          squareSize: data.square_size,
          measurementSystem: data.measurement_system,
          primaryFlowUnit: data.primary_flow_unit,
          primaryFlowUnitCustom: data.primary_flow_unit_custom,
          largestVehicleName: data.largest_vehicle_name,
          largestVehicleCapacity: data.largest_vehicle_capacity,
          typicalFlowUnit: data.typical_flow_unit,
          unitFootprintSqFt: data.unit_footprint_sqft,
          stackingHeight: data.stacking_height,
          accessFactor: data.access_factor,
        },
        stepCompletion: {
          step1: data.step1_completed,
          step2: data.step2_completed,
          step3: data.step3_completed,
          step4: data.step4_completed,
        },
      });
    }
  },

  saveSettingsToDb: async () => {
    const state = get();

    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .maybeSingle();

    const settingsData = {
      facility_width: state.settings.facilityWidth,
      facility_height: state.settings.facilityHeight,
      square_size: state.settings.squareSize,
      measurement_system: state.settings.measurementSystem,
      primary_flow_unit: state.settings.primaryFlowUnit,
      primary_flow_unit_custom: state.settings.primaryFlowUnitCustom,
      largest_vehicle_name: state.settings.largestVehicleName,
      largest_vehicle_capacity: state.settings.largestVehicleCapacity,
      typical_flow_unit: state.settings.typicalFlowUnit,
      unit_footprint_sqft: state.settings.unitFootprintSqFt,
      stacking_height: state.settings.stackingHeight,
      access_factor: state.settings.accessFactor,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabase
        .from('app_settings')
        .update(settingsData)
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating settings:', error);
      }
    } else {
      const { error } = await supabase
        .from('app_settings')
        .insert([settingsData]);

      if (error) {
        console.error('Error inserting settings:', error);
      }
    }
  },

  saveStepCompletionToDb: async () => {
    const state = get();

    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .maybeSingle();

    const completionData = {
      step1_completed: state.stepCompletion.step1,
      step2_completed: state.stepCompletion.step2,
      step3_completed: state.stepCompletion.step3,
      step4_completed: state.stepCompletion.step4,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabase
        .from('app_settings')
        .update(completionData)
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating step completion:', error);
      }
    }
  },

  setActivities: (activities) => set({ activities }),

  addActivity: (activity) => set((state) => ({
    activities: [...state.activities, activity],
  })),

  updateActivity: (id, updates) => set((state) => ({
    activities: state.activities.map((activity) =>
      activity.id === id ? { ...activity, ...updates } : activity
    ),
  })),

  deleteActivity: (id) => set((state) => ({
    activities: state.activities.filter((activity) => activity.id !== id),
  })),

  loadActivities: async () => {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading activities:', error);
      return;
    }

    if (data) {
      set({ activities: data });
    }
  },

  setVolumeTiming: (volumeTiming) => set({ volumeTiming }),

  updateVolumeTiming: async (activityId, typicalVolume, peakVolume, typicalUnitsOnFloor, peakUnitsOnFloor) => {
    const { data: existing } = await supabase
      .from('volume_timing')
      .select('*')
      .eq('activity_id', activityId)
      .maybeSingle();

    const updateData: any = {
      typical_volume_per_shift: typicalVolume,
      peak_volume_per_shift: peakVolume,
      percentage: 0,
    };

    if (typicalUnitsOnFloor !== undefined) {
      updateData.typical_units_on_floor = typicalUnitsOnFloor;
    }

    if (peakUnitsOnFloor !== undefined) {
      updateData.peak_units_on_floor = peakUnitsOnFloor;
    }

    if (existing) {
      const { error } = await supabase
        .from('volume_timing')
        .update(updateData)
        .eq('activity_id', activityId);

      if (error) {
        console.error('Error updating volume timing:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('volume_timing')
        .insert([{
          activity_id: activityId,
          ...updateData,
        }]);

      if (error) {
        console.error('Error inserting volume timing:', error);
        return;
      }
    }

    await get().loadVolumeTiming();

    const state = get();
    const totalVolume = state.volumeTiming.reduce((sum, vt) => sum + vt.typical_volume_per_shift, 0);

    if (totalVolume > 0) {
      for (const vt of state.volumeTiming) {
        const percentage = (vt.typical_volume_per_shift / totalVolume) * 100;
        await supabase
          .from('volume_timing')
          .update({ percentage })
          .eq('activity_id', vt.activity_id);
      }
    }

    await get().loadVolumeTiming();
  },

  loadVolumeTiming: async () => {
    const { data, error } = await supabase
      .from('volume_timing')
      .select('*');

    if (error) {
      console.error('Error loading volume timing:', error);
      return;
    }

    if (data) {
      set({ volumeTiming: data });
    }
  },

  setActivityRelationships: (relationships) => set({ activityRelationships: relationships }),

  updateRelationship: async (activityAId, activityBId, rating, reason) => {
    const { data: existing } = await supabase
      .from('activity_relationships')
      .select('*')
      .eq('activity_a_id', activityAId)
      .eq('activity_b_id', activityBId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('activity_relationships')
        .update({
          rating,
          reason,
        })
        .eq('activity_a_id', activityAId)
        .eq('activity_b_id', activityBId);

      if (error) {
        console.error('Error updating relationship:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('activity_relationships')
        .insert([{
          activity_a_id: activityAId,
          activity_b_id: activityBId,
          rating,
          reason,
        }]);

      if (error) {
        console.error('Error inserting relationship:', error);
        return;
      }
    }

    get().loadActivityRelationships();
  },

  loadActivityRelationships: async () => {
    const { data, error } = await supabase
      .from('activity_relationships')
      .select('*');

    if (error) {
      console.error('Error loading activity relationships:', error);
      return;
    }

    if (data) {
      set({ activityRelationships: data });
    }
  },

  setCurrentStep: (step) => set({ currentStep: step }),

  setCurrentSubStep: (subStep) => set({ currentSubStep: subStep }),

  canInteractWithDoors: () => {
    const state = get();
    return state.currentStep === 2 && state.currentSubStep === '2a';
  },

  canInteractWithZones: () => {
    const state = get();
    return state.currentStep === 2 && state.currentSubStep === '2f';
  },

  canInteractWithObjects: () => {
    const state = get();
    return state.currentStep === 2 && state.currentSubStep === '2f';
  },

  canPaintSquares: () => {
    const state = get();
    return state.currentStep === 2 && state.currentSubStep === '2b';
  },

  toggleSafetyOverlay: () => set((state) => ({ safetyOverlayEnabled: !state.safetyOverlayEnabled })),

  dismissFlag: (flagId) => set((state) => {
    const newDismissed = new Set(state.dismissedFlags);
    newDismissed.add(flagId);
    return { dismissedFlags: newDismissed };
  }),

  undismissFlag: (flagId) => set((state) => {
    const newDismissed = new Set(state.dismissedFlags);
    newDismissed.delete(flagId);
    return { dismissedFlags: newDismissed };
  }),

  isFlagDismissed: (flagId) => {
    const state = get();
    return state.dismissedFlags.has(flagId);
  },
}));
