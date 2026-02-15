import { Activity, Corridor, Door, GridDimensions, VolumeTiming, Zone, ActivityRelationship } from '../types';
import { runAllSafetyChecks, SafetyRule } from './safetyAnalysis';

export interface ScoreFactor {
  name: string;
  label: string;
  score: number;
  maxScore: number;
  display: string;
  suggestion: string;
  details: string[];
  flags?: Array<{
    id: string;
    severity: string;
    message: string;
    recommendation: string;
    isDismissed: boolean;
    pointsDeduction: number;
  }>;
  safetyRules?: SafetyRule[];
}

export interface LayoutScore {
  total: number;
  maxTotal: number;
  percentage: number;
  factors: ScoreFactor[];
  verdict: string;
}

export function calculateLayoutScore(
  zones: Zone[],
  activities: Activity[],
  settings: { squareSize: number; facilityWidth: number; facilityHeight: number },
  activityRelationships: ActivityRelationship[],
  volumeTiming: VolumeTiming[],
  doors: Door[],
  corridors: Corridor[],
  paintedSquares: Map<string, { type: 'permanent' | 'semi-fixed' }>,
  gridDims: GridDimensions,
  dismissedFlags: Set<string>
): LayoutScore {

  // Calculate all factors
  const flowDistance = calculateFlowDistanceFactor(zones, activities, volumeTiming, doors, settings);
  const closeness = calculateClosenessFactor(zones, activities, activityRelationships, settings);
  const departurePriority = calculateDeparturePriorityFactor(zones, activities, doors, settings);
  const spaceUtilization = calculateSpaceUtilizationFactor(zones, paintedSquares, gridDims, settings, corridors);
  const pathClearance = calculatePathClearanceFactor(zones, activities, corridors, doors, settings, gridDims, dismissedFlags);
  const bufferCapacity = calculateBufferCapacityFactor(zones, activities, volumeTiming, settings);
  const safety = calculateSafetyFactor(zones, corridors, doors, paintedSquares, activities, gridDims, settings.squareSize, dismissedFlags);

  const factors = [flowDistance, closeness, departurePriority, spaceUtilization, pathClearance, bufferCapacity, safety];

  const total = factors.reduce((sum, f) => sum + (f.score || 0), 0);
  const maxTotal = factors.reduce((sum, f) => sum + (f.maxScore || 0), 0);
  const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

  let verdict = '';
  if (percentage >= 90) verdict = 'Excellent — this layout is well optimized';
  else if (percentage >= 80) verdict = 'Good — minor improvements possible';
  else if (percentage >= 60) verdict = 'Fair — review the suggestions below';
  else verdict = 'Needs work — several issues to address';

  return {
    total,
    maxTotal,
    percentage,
    factors,
    verdict,
  };
}

function calculateFlowDistanceFactor(
  zones: Zone[],
  activities: Activity[],
  volumeTiming: VolumeTiming[],
  doors: Door[],
  settings: { squareSize: number }
): ScoreFactor {
  // Simplified flow distance calculation
  const workZones = zones.filter(z => activities.find(a => a.id === z.activity_id && a.type === 'work-area'));
  const stagingZones = zones.filter(z => activities.find(a => a.id === z.activity_id && a.type === 'staging-lane'));

  if (workZones.length < 2) {
    return {
      name: 'flow_distance',
      label: 'Flow Distance: How far does material travel?',
      score: 0,
      maxScore: 20,
      display: 'Insufficient work areas placed',
      suggestion: 'Place at least 2 work area zones',
      details: [],
    };
  }

  const score = Math.min(20, Math.floor(15 + stagingZones.length));

  return {
    name: 'flow_distance',
    label: 'Flow Distance: How far does material travel?',
    score,
    maxScore: 20,
    display: `${workZones.length} work areas, ${stagingZones.length} staging lanes`,
    suggestion: score < 20 ? 'Optimize zone placement to minimize travel distance' : 'Flow distance is well optimized',
    details: [],
  };
}

function calculateClosenessFactor(
  zones: Zone[],
  activities: Activity[],
  relationships: ActivityRelationship[],
  settings: { squareSize: number }
): ScoreFactor {
  const details: string[] = [];
  let score = 20;
  let violations = 0;

  relationships.forEach(rel => {
    const zoneA = zones.find(z => z.activity_id === rel.activity_a_id);
    const zoneB = zones.find(z => z.activity_id === rel.activity_b_id);

    if (!zoneA || !zoneB) return;

    const actA = activities.find(a => a.id === rel.activity_a_id);
    const actB = activities.find(a => a.id === rel.activity_b_id);

    const distance = calculateZoneDistance(zoneA, zoneB);

    if (rel.rating === 'must-be-close' && distance > 5) {
      score -= 3;
      violations++;
      details.push(`${actA?.name} and ${actB?.name} must be close (${distance} squares apart)`);
    } else if (rel.rating === 'prefer-close' && distance > 8) {
      score -= 1;
      details.push(`${actA?.name} and ${actB?.name} prefer close (${distance} squares apart)`);
    } else if (rel.rating === 'keep-apart' && distance < 10) {
      score -= 2;
      violations++;
      details.push(`${actA?.name} and ${actB?.name} should be kept apart (only ${distance} squares apart)`);
    }
  });

  return {
    name: 'closeness',
    label: 'Closeness Compliance: Are related zones near each other?',
    score: Math.max(0, score),
    maxScore: 20,
    display: violations > 0 ? `${violations} relationship violation(s)` : 'All relationships satisfied',
    suggestion: violations > 0 ? 'Adjust zone placement to satisfy closeness relationships' : 'Closeness relationships are well satisfied',
    details,
  };
}

function calculateDeparturePriorityFactor(
  zones: Zone[],
  activities: Activity[],
  doors: Door[],
  settings: { squareSize: number }
): ScoreFactor {
  const stagingZones = zones.filter(z => activities.find(a => a.id === z.activity_id && a.type === 'staging-lane'));
  const sortedActivities = activities
    .filter(a => a.type === 'staging-lane' && a.departure_time)
    .sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || ''));

  if (stagingZones.length < 2 || sortedActivities.length < 2) {
    return {
      name: 'departure_priority',
      label: 'Departure Priority: Are early-departure lanes near exits?',
      score: 15,
      maxScore: 15,
      display: 'Not enough staging lanes with departure times',
      suggestion: 'Set departure times in Step 2C',
      details: [],
    };
  }

  // Calculate distance from each staging zone to nearest door with outbound access
  const exitDoors = doors.filter(d => d.has_outbound_material || d.has_vehicle_access);

  if (exitDoors.length === 0) {
    return {
      name: 'departure_priority',
      label: 'Departure Priority: Are early-departure lanes near exits?',
      score: 10,
      maxScore: 15,
      display: 'No exit doors configured',
      suggestion: 'Mark doors with outbound material or vehicle access',
      details: ['⚠ Configure at least one door with outbound material flow or vehicle access to evaluate departure priority'],
    };
  }

  interface ZoneDistance {
    zone: Zone;
    activity: Activity;
    distance: number;
    nearestDoorId: string;
  }

  const zoneDistances: ZoneDistance[] = stagingZones
    .map(zone => {
      const activity = activities.find(a => a.id === zone.activity_id);
      if (!activity || !activity.departure_time) return null;

      // Find nearest exit door
      let minDistance = Infinity;
      let nearestDoorId = '';

      exitDoors.forEach(door => {
        const doorCenterX = door.grid_x;
        const doorCenterY = door.grid_y;
        const zoneCenterX = zone.grid_x + zone.grid_width / 2;
        const zoneCenterY = zone.grid_y + zone.grid_height / 2;

        const distance = Math.abs(doorCenterX - zoneCenterX) + Math.abs(doorCenterY - zoneCenterY);
        if (distance < minDistance) {
          minDistance = distance;
          nearestDoorId = door.id;
        }
      });

      return {
        zone,
        activity,
        distance: minDistance,
        nearestDoorId,
      };
    })
    .filter(Boolean) as ZoneDistance[];

  // Sort by departure time
  zoneDistances.sort((a, b) => (a.activity.departure_time || '').localeCompare(b.activity.departure_time || ''));

  const details: string[] = [];
  let score = 15;
  let violations = 0;

  // Check if early departures are closer than late departures
  for (let i = 0; i < zoneDistances.length - 1; i++) {
    const earlierLane = zoneDistances[i];
    const laterLane = zoneDistances[i + 1];

    if (earlierLane.distance > laterLane.distance + 3) {
      score -= 2;
      violations++;
      details.push(
        `⚠ ${earlierLane.activity.name} (departs ${earlierLane.activity.departure_time}) is ${Math.round(earlierLane.distance)} squares from exit, but ${laterLane.activity.name} (departs ${laterLane.activity.departure_time}) is only ${Math.round(laterLane.distance)} squares away. Swap their positions.`
      );
    }
  }

  // Show distances for all staging lanes
  if (violations === 0) {
    zoneDistances.forEach(zd => {
      details.push(`✓ ${zd.activity.name} (departs ${zd.activity.departure_time}): ${Math.round(zd.distance)} squares from nearest exit`);
    });
  }

  return {
    name: 'departure_priority',
    label: 'Departure Priority: Are early-departure lanes near exits?',
    score: Math.max(0, score),
    maxScore: 15,
    display: violations > 0 ? `${violations} positioning issue(s)` : 'Departure sequence is optimized',
    suggestion: violations > 0 ? 'Reposition staging lanes so earlier departures are closer to exits' : 'Early-departure lanes are well positioned near exits',
    details,
  };
}

function calculateSpaceUtilizationFactor(
  zones: Zone[],
  paintedSquares: Map<string, { type: 'permanent' | 'semi-fixed' }>,
  gridDims: GridDimensions,
  settings: { squareSize: number },
  corridors: Corridor[]
): ScoreFactor {
  const totalSquares = gridDims.rows * gridDims.cols;
  let permanentCount = 0;
  paintedSquares.forEach(sq => {
    if (sq.type === 'permanent') permanentCount++;
  });

  // Calculate corridor squares
  let corridorSquares = 0;
  corridors.forEach(corridor => {
    const length = Math.abs(corridor.end_grid_x - corridor.start_grid_x) + Math.abs(corridor.end_grid_y - corridor.start_grid_y) + 1;
    corridorSquares += length * corridor.width;
  });

  const zoneSquares = zones.reduce((sum, z) => sum + z.grid_width * z.grid_height, 0);
  const availableSquares = totalSquares - permanentCount - corridorSquares;
  const utilizationPercent = availableSquares > 0 ? (zoneSquares / availableSquares) * 100 : 0;

  const details: string[] = [];
  if (corridorSquares > 0) {
    details.push(`ℹ ${corridorSquares} squares used for corridors (${Math.round((corridorSquares / totalSquares) * 100)}% of total floor)`);
  }
  if (permanentCount > 0) {
    details.push(`ℹ ${permanentCount} squares are permanent obstacles (${Math.round((permanentCount / totalSquares) * 100)}% of total floor)`);
  }
  details.push(`ℹ ${availableSquares} squares available for work areas and staging after pathways`);

  let score = 15;
  if (utilizationPercent < 40) score = 5;
  else if (utilizationPercent < 60) score = 10;
  else if (utilizationPercent < 80) score = 13;
  else if (utilizationPercent > 95) score = 10;

  return {
    name: 'space_utilization',
    label: 'Space Utilization: Is available space well used?',
    score,
    maxScore: 15,
    display: `${Math.round(utilizationPercent)}% of available space assigned`,
    suggestion: utilizationPercent < 60 ? 'Assign more work areas and staging lanes' : utilizationPercent > 95 ? 'Consider if space is too cramped' : 'Space utilization is balanced',
    details,
  };
}

function calculatePathClearanceFactor(
  zones: Zone[],
  activities: Activity[],
  corridors: Corridor[],
  doors: Door[],
  settings: { squareSize: number },
  gridDims: GridDimensions,
  dismissedFlags: Set<string>
): ScoreFactor {
  const details: string[] = [];
  const flags: Array<{
    id: string;
    severity: string;
    message: string;
    recommendation: string;
    isDismissed: boolean;
    pointsDeduction: number;
  }> = [];
  let score = 15;

  // Check corridor widths
  const forkliftCorridors = corridors.filter(c => c.type === 'forklift');
  forkliftCorridors.forEach(corridor => {
    if (corridor.width < 2) {
      const flagId = `path-narrow-corridor-${corridor.id}`;
      const isDismissed = dismissedFlags.has(flagId);

      flags.push({
        id: flagId,
        severity: 'MEDIUM',
        message: `Forklift path is only ${corridor.width} square wide (${corridor.width * settings.squareSize} ft)`,
        recommendation: 'Minimum for forklift traffic is 2 squares (10 ft). Widen this corridor if forklifts will use it.',
        isDismissed,
        pointsDeduction: 2,
      });

      if (!isDismissed) {
        score -= 2;
      }
    }
  });

  // Check staging lane connections - now dismissable
  const stagingZones = zones.filter(z => activities.find(a => a.id === z.activity_id && a.type === 'staging-lane'));
  stagingZones.forEach(zone => {
    const activity = activities.find(a => a.id === zone.activity_id);
    const hasForkliftConnection = corridors.some(c => c.type === 'forklift' && zonesOverlap(zone, c, gridDims));

    if (!hasForkliftConnection) {
      const flagId = `path-no-forklift-${zone.id}`;
      const isDismissed = dismissedFlags.has(flagId);

      flags.push({
        id: flagId,
        severity: 'LOW',
        message: `${activity?.name} has no forklift corridor connected`,
        recommendation: 'If cargo moves here by forklift, add a forklift corridor. If it moves by hand cart or pallet jack, a pedestrian walkway is sufficient (you can dismiss this).',
        isDismissed,
        pointsDeduction: 1,
      });

      if (!isDismissed) {
        score -= 1;
      }
    }
  });

  // Sort flags by severity: HIGH > MEDIUM > LOW
  const severityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  flags.sort((a, b) => {
    const orderA = severityOrder[a.severity] ?? 999;
    const orderB = severityOrder[b.severity] ?? 999;
    return orderA - orderB;
  });

  const activeFlags = flags.filter(f => !f.isDismissed);

  return {
    name: 'path_clearance',
    label: 'Path Clearance: Are corridors wide enough and connected?',
    score: Math.max(0, score),
    maxScore: 15,
    display: activeFlags.length > 0 ? `${activeFlags.length} clearance issue(s)` : 'All paths are clear',
    suggestion: activeFlags.length > 0 ? 'Review corridor widths and connections (dismiss if they don\'t apply)' : 'Path clearance is good',
    details,
    flags,
  };
}

function calculateBufferCapacityFactor(
  zones: Zone[],
  activities: Activity[],
  volumeTiming: VolumeTiming[],
  settings: { squareSize: number }
): ScoreFactor {
  const stagingZones = zones.filter(z => activities.find(a => a.id === z.activity_id && a.type === 'staging-lane'));

  if (stagingZones.length === 0) {
    return {
      name: 'buffer_capacity',
      label: 'Buffer Capacity: Can staging lanes handle peak volume?',
      score: 15,
      maxScore: 15,
      display: 'No staging lanes placed',
      suggestion: 'Place staging lanes to evaluate capacity',
      details: [],
    };
  }

  const details: string[] = [];
  let score = 15;

  stagingZones.forEach(zone => {
    const vt = volumeTiming.find(v => v.activity_id === zone.activity_id);
    const activity = activities.find(a => a.id === zone.activity_id);

    if (vt && vt.percentage > 0) {
      const zoneSquares = zone.grid_width * zone.grid_height;
      const totalStagingSquares = stagingZones.reduce((sum, z) => sum + z.grid_width * z.grid_height, 0);
      const spacePercent = (zoneSquares / totalStagingSquares) * 100;

      if (spacePercent < vt.percentage * 0.8) {
        score -= 2;
        details.push(`⚠ ${activity?.name} is undersized for its volume (${Math.round(spacePercent)}% of space, ${Math.round(vt.percentage)}% of volume)`);
      }
    }
  });

  return {
    name: 'buffer_capacity',
    label: 'Buffer Capacity: Can staging lanes handle peak volume?',
    score: Math.max(0, score),
    maxScore: 15,
    display: details.length > 0 ? `${details.length} capacity issue(s)` : 'Buffer capacity is adequate',
    suggestion: details.length > 0 ? 'Resize staging lanes to match volume proportions' : 'Buffer capacity is well sized',
    details,
  };
}

function calculateSafetyFactor(
  zones: Zone[],
  corridors: Corridor[],
  doors: Door[],
  paintedSquares: Map<string, { type: 'permanent' | 'semi-fixed' }>,
  activities: Activity[],
  gridDims: GridDimensions,
  squareSize: number,
  dismissedFlags: Set<string>
): ScoreFactor {
  const safetyRules = runAllSafetyChecks(gridDims, zones, corridors, doors, paintedSquares, activities);

  const maxScore = 15;
  const totalScore = safetyRules.reduce((sum, rule) => sum + (rule.score || 0), 0);

  const goodCount = safetyRules.filter(r => r.status === 'good').length;
  const warningCount = safetyRules.filter(r => r.status === 'warning').length;
  const criticalCount = safetyRules.filter(r => r.status === 'critical').length;

  let display = '';
  if (criticalCount > 0) {
    display = `${criticalCount} critical, ${warningCount} warning`;
  } else if (warningCount > 0) {
    display = `${warningCount} warning, ${goodCount} good`;
  } else {
    display = 'All safety checks passed';
  }

  return {
    name: 'safety',
    label: 'Safety: Are people and equipment safe?',
    score: Math.max(0, Math.min(maxScore, totalScore || 0)),
    maxScore,
    display,
    suggestion: criticalCount > 0
      ? 'Address critical safety issues first'
      : warningCount > 0
        ? 'Review warnings and consider improvements'
        : 'Safety design is excellent',
    details: [],
    safetyRules,
  };
}

function calculateZoneDistance(zone1: Zone, zone2: Zone): number {
  const zone1Right = zone1.grid_x + zone1.grid_width;
  const zone1Bottom = zone1.grid_y + zone1.grid_height;
  const zone2Right = zone2.grid_x + zone2.grid_width;
  const zone2Bottom = zone2.grid_y + zone2.grid_height;

  let dx = 0;
  if (zone1Right <= zone2.grid_x) {
    dx = zone2.grid_x - zone1Right;
  } else if (zone2Right <= zone1.grid_x) {
    dx = zone1.grid_x - zone2Right;
  }

  let dy = 0;
  if (zone1Bottom <= zone2.grid_y) {
    dy = zone2.grid_y - zone1Bottom;
  } else if (zone2Bottom <= zone1.grid_y) {
    dy = zone1.grid_y - zone2Bottom;
  }

  return dx + dy;
}

function zonesOverlap(zone: Zone, corridor: Corridor, gridDims: GridDimensions): boolean {
  const minCol = Math.min(corridor.start_grid_x, corridor.end_grid_x);
  const maxCol = Math.max(corridor.start_grid_x, corridor.end_grid_x);
  const minRow = Math.min(corridor.start_grid_y, corridor.end_grid_y);
  const maxRow = Math.max(corridor.start_grid_y, corridor.end_grid_y);

  const isHorizontal = corridor.start_grid_y === corridor.end_grid_y;

  const corridorRight = isHorizontal ? maxCol + 1 : minCol + corridor.width;
  const corridorBottom = isHorizontal ? minRow + corridor.width : maxRow + 1;

  const zoneRight = zone.grid_x + zone.grid_width;
  const zoneBottom = zone.grid_y + zone.grid_height;

  return !(
    zoneRight <= minCol ||
    zone.grid_x >= corridorRight ||
    zoneBottom <= minRow ||
    zone.grid_y >= corridorBottom
  );
}
