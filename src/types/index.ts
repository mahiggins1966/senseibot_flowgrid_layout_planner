export interface GridCoordinate {
  row: number;
  col: number;
  label: string;
}

export interface GridSettings {
  facilityWidth: number;
  facilityHeight: number;
  squareSize: number;
  measurementSystem: MeasurementSystem;
  primaryFlowUnit?: string;
  primaryFlowUnitCustom?: string;
  secondaryFlowUnit?: string;
  secondaryFlowUnitCustom?: string;
  largestVehicleName?: string;
  largestVehicleCapacity?: number;
}

export type MeasurementSystem = 'US' | 'Metric';

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  selectedSquare: GridCoordinate | null;
}

export interface GridDimensions {
  rows: number;
  cols: number;
}

export const US_SQUARE_SIZE_OPTIONS = [
  { value: 4, label: '48" × 48" — US pallet (4 ft)' },
  { value: 5, label: '60" × 60" — US pallet + clearance (5 ft)' },
  { value: 6, label: '72" × 72" — wide clearance (6 ft)' },
  { value: 8, label: '96" × 96" — double pallet (8 ft)' },
  { value: 10, label: '120" × 120" — extra wide (10 ft)' },
] as const;

export const METRIC_SQUARE_SIZE_OPTIONS = [
  { value: 3.28084, label: '1000mm × 1000mm — EUR pallet (1.0 m)' },
  { value: 3.93701, label: '1200mm × 1200mm — EUR pallet + clearance (1.2 m)' },
  { value: 4.92126, label: '1500mm × 1500mm — wide clearance (1.5 m)' },
  { value: 6.56168, label: '2000mm × 2000mm — double pallet (2.0 m)' },
  { value: 8.2021, label: '2500mm × 2500mm — extra wide (2.5 m)' },
] as const;

export type SquareSize = typeof US_SQUARE_SIZE_OPTIONS[number]['value'] | typeof METRIC_SQUARE_SIZE_OPTIONS[number]['value'];
export type DimensionUnit = 'feet' | 'inches' | 'meters' | 'millimeters';

export interface CustomObject {
  id: string;
  name: string;
  width_inches: number;
  length_inches: number;
  height_inches: number;
  color: string;
  grid_width: number;
  grid_length: number;
  is_default: boolean;
  created_at: string;
}

export interface PlacedObject {
  id: string;
  object_name: string;
  grid_x: number;
  grid_y: number;
  grid_width: number;
  grid_height: number;
  color: string;
  rotation: number;
  created_at: string;
}

export interface Zone {
  id: string;
  name: string;
  grid_x: number;
  grid_y: number;
  grid_width: number;
  grid_height: number;
  color: string;
  group_type: 'permanent' | 'semi-fixed' | 'flexible';
  activity_id?: string;
  created_at: string;
}

export type ZoneGroupType = 'permanent' | 'semi-fixed' | 'flexible';

export type DoorType = 'hangar' | 'loading-dock' | 'personnel' | 'emergency';

export interface Door {
  id: string;
  name: string;
  grid_x: number;
  grid_y: number;
  width: number;
  type: DoorType;
  has_inbound_material: boolean;
  has_outbound_material: boolean;
  has_vehicle_access: boolean;
  is_personnel_only: boolean;
  inbound_percentage: number | null;
  outbound_percentage: number | null;
  edge: 'top' | 'bottom' | 'left' | 'right';
  created_at: string;
}

export type ActivityType = 'work-area' | 'staging-lane' | 'corridor' | 'support-area';

export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  destination_name?: string;
  destination_code?: string;
  color?: string;
  departure_time?: string;
  sort_order: number;
  created_at: string;
}

export interface VolumeTiming {
  id: string;
  activity_id: string;
  typical_volume_per_shift: number;
  peak_volume_per_shift: number;
  typical_secondary_volume_per_shift?: number;
  peak_secondary_volume_per_shift?: number;
  percentage: number;
  created_at: string;
}

export type RelationshipRating = 'must-be-close' | 'prefer-close' | 'does-not-matter' | 'keep-apart';
export type RelationshipReason =
  | 'heavy-material-flow'
  | 'sequential-process'
  | 'shared-equipment'
  | 'shared-personnel'
  | 'supervision-line-of-sight'
  | 'people-walk-between'
  | 'traffic-conflict'
  | 'noise'
  | 'safety'
  | 'contamination-risk'
  | 'different-security-zones';

export const CLOSE_REASONS: { value: RelationshipReason; label: string }[] = [
  { value: 'heavy-material-flow', label: 'Heavy material flow' },
  { value: 'sequential-process', label: 'Sequential process (one step feeds directly into the next)' },
  { value: 'shared-equipment', label: 'Shared equipment' },
  { value: 'shared-personnel', label: 'Shared personnel' },
  { value: 'supervision-line-of-sight', label: 'Supervision / line of sight' },
  { value: 'people-walk-between', label: 'People walk between them frequently' },
];

export const KEEP_APART_REASONS: { value: RelationshipReason; label: string }[] = [
  { value: 'traffic-conflict', label: 'Traffic conflict' },
  { value: 'noise', label: 'Noise' },
  { value: 'safety', label: 'Safety' },
  { value: 'contamination-risk', label: 'Contamination risk' },
  { value: 'different-security-zones', label: 'Different security zones' },
];

export interface ActivityRelationship {
  id: string;
  activity_a_id: string;
  activity_b_id: string;
  rating: RelationshipRating;
  reason?: string;
  created_at: string;
}

export type CorridorType = 'pedestrian' | 'forklift';

export interface Corridor {
  id: string;
  name: string;
  type: CorridorType;
  start_grid_x: number;
  start_grid_y: number;
  end_grid_x: number;
  end_grid_y: number;
  width: number;
  color: string;
  created_at: string;
}

export type CellType = 'pedestrian' | 'equipment' | 'staging' | 'work' | 'obstacle' | 'door' | 'empty';

export interface CellClassification {
  row: number;
  col: number;
  type: CellType;
  zoneId?: string;
  corridorId?: string;
  doorId?: string;
}

export type SafetyRuleType = 'crossing' | 'separation' | 'blind-corner' | 'speed' | 'ped-access-work' | 'ped-access-staging' | 'egress';
export type SafetySeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SafetyFlag {
  id: string;
  ruleType: SafetyRuleType;
  severity: SafetySeverity;
  gridCoordinate: string;
  finding: string;
  recommendation: string;
  affectedCells: Array<{ row: number; col: number }>;
  pointsDeduction: number;
}

export interface DismissedFlag {
  flagId: string;
  dismissedAt: string;
}
