import {
  Activity,
  CellClassification,
  CellType,
  Corridor,
  Door,
  GridDimensions,
  Zone,
} from '../types';
import { getGridCoordinate } from './coordinates';

export interface SafetyRule {
  rule: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'critical';
  message: string;
  locations: string[];
}

export function classifyGridCells(
  gridDims: GridDimensions,
  zones: Zone[],
  corridors: Corridor[],
  doors: Door[],
  paintedSquares: Map<string, { type: 'permanent' | 'semi-fixed' }>,
  activities: Activity[]
): Map<string, CellClassification> {
  const cellMap = new Map<string, CellClassification>();

  for (let row = 0; row < gridDims.rows; row++) {
    for (let col = 0; col < gridDims.cols; col++) {
      const key = `${row}-${col}`;
      let cellType: CellType = 'empty';
      let zoneId: string | undefined;
      let corridorId: string | undefined;
      let doorId: string | undefined;

      const painted = paintedSquares.get(key);
      if (painted && painted.type === 'permanent') {
        cellType = 'obstacle';
      }

      const door = doors.find(d => {
        if (d.edge === 'top' || d.edge === 'bottom') {
          return row === d.grid_y && col >= d.grid_x && col < d.grid_x + d.width;
        } else {
          return col === d.grid_x && row >= d.grid_y && row < d.grid_y + d.width;
        }
      });

      if (door) {
        cellType = 'door';
        doorId = door.id;
      }

      const corridor = corridors.find(c => {
        const minCol = Math.min(c.start_grid_x, c.end_grid_x);
        const maxCol = Math.max(c.start_grid_x, c.end_grid_x);
        const minRow = Math.min(c.start_grid_y, c.end_grid_y);
        const maxRow = Math.max(c.start_grid_y, c.end_grid_y);
        const isHorizontal = c.start_grid_y === c.end_grid_y;

        if (isHorizontal) {
          return row >= minRow && row < minRow + c.width && col >= minCol && col <= maxCol;
        } else {
          return col >= minCol && col < minCol + c.width && row >= minRow && row <= maxRow;
        }
      });

      if (corridor) {
        cellType = corridor.type === 'pedestrian' ? 'pedestrian' : 'equipment';
        corridorId = corridor.id;
      }

      const zone = zones.find(z =>
        col >= z.grid_x &&
        col < z.grid_x + z.grid_width &&
        row >= z.grid_y &&
        row < z.grid_y + z.grid_height
      );

      if (zone) {
        zoneId = zone.id;
        const activity = activities.find(a => a.id === zone.activity_id);
        if (activity) {
          if (activity.type === 'staging-lane') {
            cellType = 'staging';
          } else if (activity.type === 'work-area') {
            cellType = 'work';
          }
        }
      }

      cellMap.set(key, {
        row,
        col,
        type: cellType,
        zoneId,
        corridorId,
        doorId,
      });
    }
  }

  return cellMap;
}

function findPath(
  cellMap: Map<string, CellClassification>,
  gridDims: GridDimensions,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  allowedTypes: CellType[]
): Array<{ row: number; col: number }> | null {
  const queue: Array<{ row: number; col: number; path: Array<{ row: number; col: number }> }> = [];
  const visited = new Set<string>();

  queue.push({ row: startRow, col: startCol, path: [{ row: startRow, col: startCol }] });
  visited.add(`${startRow}-${startCol}`);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.row === endRow && current.col === endCol) {
      return current.path;
    }

    const neighbors = [
      { row: current.row - 1, col: current.col },
      { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 },
      { row: current.row, col: current.col + 1 },
    ];

    for (const neighbor of neighbors) {
      if (neighbor.row < 0 || neighbor.row >= gridDims.rows || neighbor.col < 0 || neighbor.col >= gridDims.cols) {
        continue;
      }

      const key = `${neighbor.row}-${neighbor.col}`;
      if (visited.has(key)) continue;

      const cell = cellMap.get(key);
      if (cell && (allowedTypes.includes(cell.type) || (neighbor.row === endRow && neighbor.col === endCol))) {
        visited.add(key);
        queue.push({
          row: neighbor.row,
          col: neighbor.col,
          path: [...current.path, { row: neighbor.row, col: neighbor.col }],
        });
      }
    }
  }

  return null;
}

function pathCrossesEquipmentZone(
  path: Array<{ row: number; col: number }>,
  cellMap: Map<string, CellClassification>
): boolean {
  for (const cell of path) {
    const key = `${cell.row}-${cell.col}`;
    const classification = cellMap.get(key);
    if (classification && classification.type === 'equipment') {
      return true;
    }
  }
  return false;
}

// RULE 1: Traffic Separation (3 points)
function checkTrafficSeparation(
  cellMap: Map<string, CellClassification>,
  corridors: Corridor[],
  gridDims: GridDimensions
): SafetyRule {
  const vehicleCorridors = corridors.filter(c => c.type === 'forklift');
  const pedestrianCorridors = corridors.filter(c => c.type === 'pedestrian');

  if (vehicleCorridors.length === 0) {
    return {
      rule: 'Traffic Separation',
      score: 3,
      maxScore: 3,
      status: 'good',
      message: 'No vehicle corridors present. All traffic is pedestrian.',
      locations: [],
    };
  }

  if (pedestrianCorridors.length === 0) {
    return {
      rule: 'Traffic Separation',
      score: 0,
      maxScore: 3,
      status: 'critical',
      message: `${vehicleCorridors.length} vehicle corridor(s) present but no pedestrian walkways. Workers may need to walk in forklift paths.`,
      locations: [],
    };
  }

  let vehicleCellsWithPedAccess = 0;
  let totalVehicleCells = 0;

  vehicleCorridors.forEach(vCorridor => {
    const minCol = Math.min(vCorridor.start_grid_x, vCorridor.end_grid_x);
    const maxCol = Math.max(vCorridor.start_grid_x, vCorridor.end_grid_x);
    const minRow = Math.min(vCorridor.start_grid_y, vCorridor.end_grid_y);
    const maxRow = Math.max(vCorridor.start_grid_y, vCorridor.end_grid_y);
    const isHorizontal = vCorridor.start_grid_y === vCorridor.end_grid_y;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (isHorizontal && row >= minRow + vCorridor.width) continue;
        if (!isHorizontal && col >= minCol + vCorridor.width) continue;

        totalVehicleCells++;

        const neighbors = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
        ];

        let hasAdjacentPedestrian = false;
        for (const n of neighbors) {
          const key = `${n.row}-${n.col}`;
          const cell = cellMap.get(key);
          if (cell && cell.type === 'pedestrian') {
            hasAdjacentPedestrian = true;
            break;
          }
        }

        if (hasAdjacentPedestrian) {
          vehicleCellsWithPedAccess++;
        }
      }
    }
  });

  const percentWithAccess = totalVehicleCells > 0 ? (vehicleCellsWithPedAccess / totalVehicleCells) : 0;

  let score = 0;
  let status: 'good' | 'warning' | 'critical' = 'critical';
  let message = 'Vehicle corridors evaluated.';

  if (percentWithAccess >= 0.8) {
    score = 3;
    status = 'good';
    message = 'All vehicle corridors have adjacent pedestrian walkways. Good traffic separation.';
  } else if (percentWithAccess >= 0.5) {
    score = 2;
    status = 'warning';
    message = `Most vehicle corridors (${Math.round(percentWithAccess * 100)}%) have adjacent pedestrian walkways, but some sections lack pedestrian alternatives.`;
  } else if (percentWithAccess > 0) {
    score = 1;
    status = 'warning';
    message = `Only ${Math.round(percentWithAccess * 100)}% of vehicle corridor length has adjacent pedestrian walkways. Workers may need to walk in forklift paths.`;
  } else {
    score = 0;
    status = 'critical';
    message = 'Vehicle corridors have no adjacent pedestrian walkways. Consider adding walkways alongside forklift paths.';
  }

  return {
    rule: 'Traffic Separation',
    score: Math.max(0, Math.min(3, score || 0)),
    maxScore: 3,
    status,
    message: message || 'Traffic separation evaluated.',
    locations: [],
  };
}

// RULE 2: Crossing Points (2 points)
function checkCrossingPoints(
  cellMap: Map<string, CellClassification>,
  gridDims: GridDimensions
): SafetyRule {
  const crossings: string[] = [];

  cellMap.forEach((cell) => {
    if (cell.type === 'pedestrian') {
      const neighbors = [
        { row: cell.row - 1, col: cell.col, dir: 'up' },
        { row: cell.row + 1, col: cell.col, dir: 'down' },
        { row: cell.row, col: cell.col - 1, dir: 'left' },
        { row: cell.row, col: cell.col + 1, dir: 'right' },
      ];

      for (const n of neighbors) {
        const nKey = `${n.row}-${n.col}`;
        const nCell = cellMap.get(nKey);
        if (nCell && nCell.type === 'equipment') {
          const coord = getGridCoordinate(cell.row, cell.col);
          if (!crossings.includes(coord.label)) {
            crossings.push(coord.label);
          }
        }
      }
    }
  });

  let score = 2;
  let status: 'good' | 'warning' | 'critical' = 'good';
  let message = 'No crossing points between pedestrian and vehicle paths. Excellent separation.';

  if (crossings.length === 0) {
    score = 2;
    status = 'good';
    message = 'No crossing points between pedestrian and vehicle paths. Excellent separation.';
  } else if (crossings.length <= 2) {
    score = 2;
    status = 'good';
    message = `${crossings.length} crossing point(s) detected. Mark these with floor tape and signage.`;
  } else if (crossings.length <= 4) {
    score = 1;
    status = 'warning';
    message = `${crossings.length} crossing points detected. Consider rerouting to reduce crossings.`;
  } else {
    score = 0;
    status = 'critical';
    message = `${crossings.length} crossing points detected. Too many crossings increase collision risk. Reroute paths to reduce crossings.`;
  }

  return {
    rule: 'Crossing Points',
    score: Math.max(0, Math.min(2, score || 0)),
    maxScore: 2,
    status,
    message: message || 'Crossing points evaluated.',
    locations: crossings.slice(0, 10),
  };
}

// RULE 3: Emergency Egress (3 points)
function checkEmergencyEgress(
  cellMap: Map<string, CellClassification>,
  zones: Zone[],
  doors: Door[],
  activities: Activity[],
  gridDims: GridDimensions
): SafetyRule {
  if (doors.length === 0) {
    return {
      rule: 'Emergency Egress',
      score: 0,
      maxScore: 3,
      status: 'critical',
      message: 'No doors configured. Add doors to evaluate emergency egress.',
      locations: [],
    };
  }

  const workZones = zones.filter(z => {
    const activity = activities.find(a => a.id === z.activity_id);
    return activity && activity.type === 'work-area';
  });

  if (workZones.length === 0) {
    return {
      rule: 'Emergency Egress',
      score: 3,
      maxScore: 3,
      status: 'good',
      message: 'No work areas to evaluate.',
      locations: [],
    };
  }

  let zonesWithAccess = 0;
  const zonesWithoutAccess: string[] = [];

  workZones.forEach(zone => {
    const zoneCenterRow = zone.grid_y + Math.floor(zone.grid_height / 2);
    const zoneCenterCol = zone.grid_x + Math.floor(zone.grid_width / 2);
    let hasAccess = false;

    for (const door of doors) {
      const doorCells: Array<{ row: number; col: number }> = [];
      if (door.edge === 'top' || door.edge === 'bottom') {
        for (let i = 0; i < door.width; i++) {
          doorCells.push({ row: door.grid_y, col: door.grid_x + i });
        }
      } else {
        for (let i = 0; i < door.width; i++) {
          doorCells.push({ row: door.grid_y + i, col: door.grid_x });
        }
      }

      for (const doorCell of doorCells) {
        const path = findPath(cellMap, gridDims, zoneCenterRow, zoneCenterCol, doorCell.row, doorCell.col, ['pedestrian', 'equipment', 'empty', 'staging', 'work', 'door']);
        if (path) {
          hasAccess = true;
          break;
        }
      }
      if (hasAccess) break;
    }

    if (hasAccess) {
      zonesWithAccess++;
    } else {
      const activity = activities.find(a => a.id === zone.activity_id);
      zonesWithoutAccess.push(activity?.name || 'Work area');
    }
  });

  const percentWithAccess = workZones.length > 0 ? (zonesWithAccess / workZones.length) : 1;

  let score = 3;
  let status: 'good' | 'warning' | 'critical' = 'good';
  let message = 'All work areas have corridor paths to exits. Emergency egress is clear.';

  if (percentWithAccess >= 1) {
    score = 3;
    status = 'good';
    message = 'All work areas have corridor paths to exits. Emergency egress is clear.';
  } else if (percentWithAccess >= 0.75) {
    score = 2;
    status = 'warning';
    message = `${zonesWithoutAccess.length} work area(s) lack clear corridor paths to exits: ${zonesWithoutAccess.join(', ')}.`;
  } else if (percentWithAccess >= 0.5) {
    score = 1;
    status = 'warning';
    message = `${zonesWithoutAccess.length} work area(s) lack clear corridor paths to exits: ${zonesWithoutAccess.join(', ')}.`;
  } else {
    score = 0;
    status = 'critical';
    message = `Most work areas (${zonesWithoutAccess.length}) lack clear corridor paths to exits. Extend corridors to connect these areas.`;
  }

  return {
    rule: 'Emergency Egress',
    score: Math.max(0, Math.min(3, score || 0)),
    maxScore: 3,
    status,
    message: message || 'Emergency egress evaluated.',
    locations: zonesWithoutAccess,
  };
}

// RULE 4: Pedestrian Access to Work Zones (2 points)
function checkPedestrianAccessToWork(
  cellMap: Map<string, CellClassification>,
  zones: Zone[],
  activities: Activity[]
): SafetyRule {
  const workZones = zones.filter(z => {
    const activity = activities.find(a => a.id === z.activity_id);
    return activity && activity.type === 'work-area';
  });

  if (workZones.length === 0) {
    return {
      rule: 'Pedestrian Access to Work Zones',
      score: 2,
      maxScore: 2,
      status: 'good',
      message: 'No work areas to evaluate.',
      locations: [],
    };
  }

  let zonesWithSafeAccess = 0;
  const zonesWithoutAccess: string[] = [];

  workZones.forEach(zone => {
    let hasPedAccess = false;

    for (let row = zone.grid_y; row < zone.grid_y + zone.grid_height; row++) {
      for (let col = zone.grid_x; col < zone.grid_x + zone.grid_width; col++) {
        const isEdge = row === zone.grid_y || row === zone.grid_y + zone.grid_height - 1 ||
                       col === zone.grid_x || col === zone.grid_x + zone.grid_width - 1;

        if (isEdge) {
          const neighbors = [
            { row: row - 1, col },
            { row: row + 1, col },
            { row, col: col - 1 },
            { row, col: col + 1 },
          ];

          for (const n of neighbors) {
            const key = `${n.row}-${n.col}`;
            const cell = cellMap.get(key);
            if (cell && (cell.type === 'pedestrian' || cell.type === 'empty' || cell.type === 'work' || cell.type === 'staging')) {
              hasPedAccess = true;
              break;
            }
          }
          if (hasPedAccess) break;
        }
      }
      if (hasPedAccess) break;
    }

    if (hasPedAccess) {
      zonesWithSafeAccess++;
    } else {
      const activity = activities.find(a => a.id === zone.activity_id);
      zonesWithoutAccess.push(activity?.name || 'Work area');
    }
  });

  const percentWithAccess = workZones.length > 0 ? (zonesWithSafeAccess / workZones.length) : 1;

  let score = 2;
  let status: 'good' | 'warning' | 'critical' = 'good';
  let message = 'All work areas have pedestrian-safe access.';

  if (percentWithAccess >= 1) {
    score = 2;
    status = 'good';
    message = 'All work areas have pedestrian-safe access.';
  } else if (percentWithAccess >= 0.5) {
    score = 1;
    status = 'warning';
    message = `${zonesWithoutAccess.length} work area(s) can only be reached through forklift paths: ${zonesWithoutAccess.join(', ')}.`;
  } else {
    score = 0;
    status = 'critical';
    message = `Most work areas (${zonesWithoutAccess.length}) can only be reached through forklift paths. Add pedestrian walkways.`;
  }

  return {
    rule: 'Pedestrian Access to Work Zones',
    score: Math.max(0, Math.min(2, score || 0)),
    maxScore: 2,
    status,
    message: message || 'Pedestrian access to work zones evaluated.',
    locations: zonesWithoutAccess,
  };
}

// RULE 5: Pedestrian Access Between Staging Lanes (2 points)
function checkPedestrianAccessBetweenStaging(
  cellMap: Map<string, CellClassification>,
  zones: Zone[],
  activities: Activity[],
  gridDims: GridDimensions
): SafetyRule {
  const stagingZones = zones.filter(z => {
    const activity = activities.find(a => a.id === z.activity_id);
    return activity && activity.type === 'staging-lane';
  });

  if (stagingZones.length < 2) {
    return {
      rule: 'Pedestrian Access Between Staging Lanes',
      score: 2,
      maxScore: 2,
      status: 'good',
      message: 'Less than 2 staging lanes. No inter-lane access to evaluate.',
      locations: [],
    };
  }

  let pairsChecked = 0;
  let pairsWithSafeAccess = 0;
  const problemPairs: string[] = [];

  for (let i = 0; i < stagingZones.length; i++) {
    for (let j = i + 1; j < stagingZones.length; j++) {
      const zoneA = stagingZones[i];
      const zoneB = stagingZones[j];
      const activityA = activities.find(a => a.id === zoneA.activity_id);
      const activityB = activities.find(a => a.id === zoneB.activity_id);

      const centerARow = zoneA.grid_y + Math.floor(zoneA.grid_height / 2);
      const centerACol = zoneA.grid_x + Math.floor(zoneA.grid_width / 2);
      const centerBRow = zoneB.grid_y + Math.floor(zoneB.grid_height / 2);
      const centerBCol = zoneB.grid_x + Math.floor(zoneB.grid_width / 2);

      const distance = Math.abs(centerARow - centerBRow) + Math.abs(centerACol - centerBCol);
      if (distance > 10) continue;

      pairsChecked++;

      const path = findPath(cellMap, gridDims, centerARow, centerACol, centerBRow, centerBCol, ['pedestrian', 'empty', 'staging', 'work']);
      const hasSafeAccess = path && !pathCrossesEquipmentZone(path, cellMap);

      if (hasSafeAccess) {
        pairsWithSafeAccess++;
      } else {
        problemPairs.push(`${activityA?.name || 'Staging'} ↔ ${activityB?.name || 'Staging'}`);
      }
    }
  }

  if (pairsChecked === 0) {
    return {
      rule: 'Pedestrian Access Between Staging Lanes',
      score: 2,
      maxScore: 2,
      status: 'good',
      message: 'Staging lanes are far apart. No inter-lane access needed.',
      locations: [],
    };
  }

  const percentWithAccess = pairsChecked > 0 ? (pairsWithSafeAccess / pairsChecked) : 1;

  let score = 2;
  let status: 'good' | 'warning' | 'critical' = 'good';
  let message = 'All adjacent staging lanes have pedestrian-safe paths between them.';

  if (percentWithAccess >= 1) {
    score = 2;
    status = 'good';
    message = 'All adjacent staging lanes have pedestrian-safe paths between them.';
  } else if (percentWithAccess >= 0.5) {
    score = 1;
    status = 'warning';
    message = `Some staging lane pairs (${problemPairs.length}) are separated only by forklift paths.`;
  } else {
    score = 0;
    status = 'warning';
    message = `Most staging lane pairs (${problemPairs.length}) are separated only by forklift paths. Consider adding pedestrian walkways.`;
  }

  return {
    rule: 'Pedestrian Access Between Staging Lanes',
    score: Math.max(0, Math.min(2, score || 0)),
    maxScore: 2,
    status,
    message: message || 'Pedestrian access between staging lanes evaluated.',
    locations: problemPairs.slice(0, 5),
  };
}

// RULE 6: Blind Corners (1 point)
function checkBlindCorners(
  cellMap: Map<string, CellClassification>,
  corridors: Corridor[],
  gridDims: GridDimensions
): SafetyRule {
  const blindCorners: string[] = [];

  corridors.forEach(corridor => {
    const minCol = Math.min(corridor.start_grid_x, corridor.end_grid_x);
    const maxCol = Math.max(corridor.start_grid_x, corridor.end_grid_x);
    const minRow = Math.min(corridor.start_grid_y, corridor.end_grid_y);
    const maxRow = Math.max(corridor.start_grid_y, corridor.end_grid_y);
    const isHorizontal = corridor.start_grid_y === corridor.end_grid_y;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (isHorizontal && row >= minRow + corridor.width) continue;
        if (!isHorizontal && col >= minCol + corridor.width) continue;

        const key = `${row}-${col}`;
        const cell = cellMap.get(key);
        if (!cell) continue;

        const neighbors = [
          { row: row - 1, col, dir: 'up' },
          { row: row + 1, col, dir: 'down' },
          { row, col: col - 1, dir: 'left' },
          { row, col: col + 1, dir: 'right' },
        ];

        let corridorDirections = 0;
        for (const n of neighbors) {
          const nKey = `${n.row}-${n.col}`;
          const nCell = cellMap.get(nKey);
          if (nCell && (nCell.type === 'pedestrian' || nCell.type === 'equipment')) {
            corridorDirections++;
          }
        }

        if (corridorDirections >= 2) {
          const diagonals = [
            { row: row - 1, col: col - 1 },
            { row: row - 1, col: col + 1 },
            { row: row + 1, col: col - 1 },
            { row: row + 1, col: col + 1 },
          ];

          for (const d of diagonals) {
            const dKey = `${d.row}-${d.col}`;
            const dCell = cellMap.get(dKey);
            if (dCell && (dCell.type === 'work' || dCell.type === 'staging' || dCell.type === 'obstacle')) {
              const coord = getGridCoordinate(row, col);
              if (!blindCorners.includes(coord.label)) {
                blindCorners.push(coord.label);
              }
              break;
            }
          }
        }
      }
    }
  });

  let score = 1;
  let status: 'good' | 'warning' | 'critical' = 'good';
  let message = 'No blind corners detected. Line of sight is clear at corridor turns.';

  if (blindCorners.length === 0) {
    score = 1;
    status = 'good';
    message = 'No blind corners detected. Line of sight is clear at corridor turns.';
  } else if (blindCorners.length <= 2) {
    score = 1;
    status = 'good';
    message = `${blindCorners.length} blind corner(s) detected. Consider adding convex mirrors at these locations.`;
  } else {
    score = 0;
    status = 'warning';
    message = `${blindCorners.length} blind corners detected. Add convex mirrors or widen turns to improve visibility.`;
  }

  return {
    rule: 'Blind Corners',
    score: Math.max(0, Math.min(1, score || 0)),
    maxScore: 1,
    status,
    message: message || 'Blind corners evaluated.',
    locations: blindCorners.slice(0, 5),
  };
}

// RULE 7: Speed Transition Zones (2 points)
function checkSpeedTransitionZones(
  cellMap: Map<string, CellClassification>,
  corridors: Corridor[],
  gridDims: GridDimensions
): SafetyRule {
  const forkliftCorridors = corridors.filter(c => c.type === 'forklift');

  if (forkliftCorridors.length === 0) {
    return {
      rule: 'Speed Transition Zones',
      score: 2,
      maxScore: 2,
      status: 'good',
      message: 'No forklift paths present.',
      locations: [],
    };
  }

  let totalForkliftCells = 0;
  let forkliftCellsAdjacentToWork = 0;
  const problemAreas: string[] = [];

  forkliftCorridors.forEach(corridor => {
    const minCol = Math.min(corridor.start_grid_x, corridor.end_grid_x);
    const maxCol = Math.max(corridor.start_grid_x, corridor.end_grid_x);
    const minRow = Math.min(corridor.start_grid_y, corridor.end_grid_y);
    const maxRow = Math.max(corridor.start_grid_y, corridor.end_grid_y);
    const isHorizontal = corridor.start_grid_y === corridor.end_grid_y;

    let corridorHasWorkAdjacency = false;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (isHorizontal && row >= minRow + corridor.width) continue;
        if (!isHorizontal && col >= minCol + corridor.width) continue;

        totalForkliftCells++;

        const neighbors = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 },
        ];

        let isAdjacentToWork = false;
        for (const n of neighbors) {
          const key = `${n.row}-${n.col}`;
          const cell = cellMap.get(key);
          if (cell && cell.type === 'work') {
            isAdjacentToWork = true;
            corridorHasWorkAdjacency = true;
            break;
          }
        }

        if (isAdjacentToWork) {
          forkliftCellsAdjacentToWork++;
        }
      }
    }

    if (corridorHasWorkAdjacency) {
      const startCoord = getGridCoordinate(corridor.start_grid_y, corridor.start_grid_x);
      const endCoord = getGridCoordinate(corridor.end_grid_y, corridor.end_grid_x);
      problemAreas.push(`${corridor.name || 'Forklift path'} (${startCoord.label} to ${endCoord.label})`);
    }
  });

  const percentAdjacent = totalForkliftCells > 0 ? (forkliftCellsAdjacentToWork / totalForkliftCells) : 0;

  let score = 2;
  let status: 'good' | 'warning' | 'critical' = 'good';
  let message = 'All forklift paths maintain buffer space from work areas. Good separation.';

  if (percentAdjacent === 0) {
    score = 2;
    status = 'good';
    message = 'All forklift paths maintain buffer space from work areas. Good separation.';
  } else if (percentAdjacent < 0.3) {
    score = 1;
    status = 'warning';
    message = `${Math.round(percentAdjacent * 100)}% of forklift path runs directly next to work areas. Mark these as slow zones.`;
  } else {
    score = 0;
    status = 'warning';
    message = `${Math.round(percentAdjacent * 100)}% of forklift path runs directly next to work areas. Consider adding buffer space or pedestrian walkways between paths and work areas.`;
  }

  return {
    rule: 'Speed Transition Zones',
    score: Math.max(0, Math.min(2, score || 0)),
    maxScore: 2,
    status,
    message: message || 'Speed transition zones evaluated.',
    locations: problemAreas.slice(0, 5),
  };
}

export function runAllSafetyChecks(
  gridDims: GridDimensions,
  zones: Zone[],
  corridors: Corridor[],
  doors: Door[],
  paintedSquares: Map<string, { type: 'permanent' | 'semi-fixed' }>,
  activities: Activity[]
): SafetyRule[] {
  const cellMap = classifyGridCells(gridDims, zones, corridors, doors, paintedSquares, activities);

  return [
    checkTrafficSeparation(cellMap, corridors, gridDims),
    checkCrossingPoints(cellMap, gridDims),
    checkEmergencyEgress(cellMap, zones, doors, activities, gridDims),
    checkPedestrianAccessToWork(cellMap, zones, activities),
    checkPedestrianAccessBetweenStaging(cellMap, zones, activities, gridDims),
    checkBlindCorners(cellMap, corridors, gridDims),
    checkSpeedTransitionZones(cellMap, corridors, gridDims),
  ];
}
