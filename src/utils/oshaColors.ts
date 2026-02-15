// OSHA/ANSI workplace safety standard colors

export const OSHA_COLORS = {
  // Corridor colors
  PEDESTRIAN_WALKWAY: '#FFD700', // Yellow
  FORKLIFT_PATH: '#FFFFFF', // White

  // Zone colors
  STAGING_LANE: '#2563EB', // Blue
  WORK_AREA: '#16A34A', // Green
  SUPPORT_AREA: '#7C3AED', // Purple

  // Special areas
  EMERGENCY_RESTRICTED: '#DC2626', // Red

  // Infrastructure
  PERMANENT_OBSTACLE: '#374151', // Dark gray
  DOOR: '#92400E', // Brown/tan
  EMPTY: '#F3F4F6', // Light gray

  // Border colors (darker shades for contrast)
  PEDESTRIAN_BORDER: '#D97706', // Darker yellow
  FORKLIFT_BORDER: '#6B7280', // Dark gray
  STAGING_BORDER: '#1E40AF', // Darker blue
  WORK_BORDER: '#15803D', // Darker green
  SUPPORT_BORDER: '#5B21B6', // Darker purple
  EMERGENCY_BORDER: '#991B1B', // Darker red
};

export const OSHA_LEGEND = [
  { color: OSHA_COLORS.PEDESTRIAN_WALKWAY, label: 'Pedestrian walkway', border: OSHA_COLORS.PEDESTRIAN_BORDER },
  { color: OSHA_COLORS.FORKLIFT_PATH, label: 'Equipment traffic lane', border: OSHA_COLORS.FORKLIFT_BORDER },
  { color: OSHA_COLORS.STAGING_LANE, label: 'Staging / storage', border: OSHA_COLORS.STAGING_BORDER },
  { color: OSHA_COLORS.WORK_AREA, label: 'Work area', border: OSHA_COLORS.WORK_BORDER },
  { color: OSHA_COLORS.SUPPORT_AREA, label: 'Support area', border: OSHA_COLORS.SUPPORT_BORDER },
  { color: OSHA_COLORS.EMERGENCY_RESTRICTED, label: 'Restricted / emergency', border: OSHA_COLORS.EMERGENCY_BORDER },
  { color: OSHA_COLORS.PERMANENT_OBSTACLE, label: 'Fixed obstacle', border: '#1F2937' },
];

export function getActivityColor(activityType: string): string {
  switch (activityType) {
    case 'work-area':
      return OSHA_COLORS.WORK_AREA;
    case 'staging-lane':
      return OSHA_COLORS.STAGING_LANE;
    case 'support-area':
      return OSHA_COLORS.SUPPORT_AREA;
    case 'corridor':
      return OSHA_COLORS.PEDESTRIAN_WALKWAY;
    default:
      return OSHA_COLORS.WORK_AREA;
  }
}

export function getActivityBorderColor(activityType: string): string {
  switch (activityType) {
    case 'work-area':
      return OSHA_COLORS.WORK_BORDER;
    case 'staging-lane':
      return OSHA_COLORS.STAGING_BORDER;
    case 'support-area':
      return OSHA_COLORS.SUPPORT_BORDER;
    case 'corridor':
      return OSHA_COLORS.PEDESTRIAN_BORDER;
    default:
      return OSHA_COLORS.WORK_BORDER;
  }
}

export function getCorridorColor(corridorType: 'pedestrian' | 'forklift'): string {
  return corridorType === 'pedestrian' ? OSHA_COLORS.PEDESTRIAN_WALKWAY : OSHA_COLORS.FORKLIFT_PATH;
}

export function getCorridorBorderColor(corridorType: 'pedestrian' | 'forklift'): string {
  return corridorType === 'pedestrian' ? OSHA_COLORS.PEDESTRIAN_BORDER : OSHA_COLORS.FORKLIFT_BORDER;
}
