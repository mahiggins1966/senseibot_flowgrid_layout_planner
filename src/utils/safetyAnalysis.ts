import {
  Activity,
  CellClassification,
  CellType,
  Corridor,
  Door,
  GridDimensions,
  SafetyFlag,
  Zone,
} from '../types';
import { getGridCoordinate } from './coordinates';

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

function generateFlagId(ruleType: string, coordinate: string): string {
  return `${ruleType}-${coordinate}`;
}

export function checkCrossingRule(
  cellMap: Map<string, CellClassification>,
  gridDims: GridDimensions
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  cellMap.forEach((cell, key) => {
    if (cell.type === 'pedestrian') {
      const equipmentCorridor = Array.from(cellMap.values()).find(
        c => c.row === cell.row && c.col === cell.col && c.type === 'equipment'
      );

      if (equipmentCorridor) {
        const coord = getGridCoordinate(cell.row, cell.col, gridDims);
        flags.push({
          id: generateFlagId('crossing', coord.label),
          ruleType: 'crossing',
          severity: 'HIGH',
          gridCoordinate: coord.label,
          finding: 'Pedestrian and forklift paths intersect',
          recommendation: 'Install stop signs for equipment and yield signs for pedestrians. Mark crossing with yellow/black zebra stripes on the floor.',
          affectedCells: [{ row: cell.row, col: cell.col }],
          pointsDeduction: 3,
        });
      }
    }
  });

  return flags;
}

export function checkSeparationRule(
  cellMap: Map<string, CellClassification>,
  gridDims: GridDimensions
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  cellMap.forEach((cell) => {
    if (cell.type === 'pedestrian') {
      const neighbors = [
        { row: cell.row - 1, col: cell.col },
        { row: cell.row + 1, col: cell.col },
        { row: cell.row, col: cell.col - 1 },
        { row: cell.row, col: cell.col + 1 },
      ];

      for (const neighbor of neighbors) {
        if (neighbor.row < 0 || neighbor.row >= gridDims.rows || neighbor.col < 0 || neighbor.col >= gridDims.cols) {
          continue;
        }

        const neighborKey = `${neighbor.row}-${neighbor.col}`;
        const neighborCell = cellMap.get(neighborKey);

        if (neighborCell && neighborCell.type === 'equipment') {
          const coord = getGridCoordinate(cell.row, cell.col, gridDims);
          const neighborCoord = getGridCoordinate(neighbor.row, neighbor.col, gridDims);

          const flagId = generateFlagId('separation', `${coord.label}-${neighborCoord.label}`);
          if (!flags.find(f => f.id === flagId)) {
            flags.push({
              id: flagId,
              ruleType: 'separation',
              severity: 'MEDIUM',
              gridCoordinate: coord.label,
              finding: `${coord.label} (pedestrian) is adjacent to ${neighborCoord.label} (forklift) with no barrier`,
              recommendation: 'Install steel guardrails or mark with 4-inch yellow safety tape per OSHA standards.',
              affectedCells: [
                { row: cell.row, col: cell.col },
                { row: neighbor.row, col: neighbor.col },
              ],
              pointsDeduction: 1,
            });
          }
        }
      }
    }
  });

  return flags;
}

export function checkBlindCornerRule(
  cellMap: Map<string, CellClassification>,
  gridDims: GridDimensions,
  crossingFlags: SafetyFlag[]
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  for (const crossingFlag of crossingFlags) {
    const affectedCell = crossingFlag.affectedCells[0];
    const diagonals = [
      { row: affectedCell.row - 1, col: affectedCell.col - 1 },
      { row: affectedCell.row - 1, col: affectedCell.col + 1 },
      { row: affectedCell.row + 1, col: affectedCell.col - 1 },
      { row: affectedCell.row + 1, col: affectedCell.col + 1 },
    ];

    for (const diagonal of diagonals) {
      if (diagonal.row < 0 || diagonal.row >= gridDims.rows || diagonal.col < 0 || diagonal.col >= gridDims.cols) {
        continue;
      }

      const diagonalKey = `${diagonal.row}-${diagonal.col}`;
      const diagonalCell = cellMap.get(diagonalKey);

      if (diagonalCell && diagonalCell.type === 'obstacle') {
        const coord = getGridCoordinate(affectedCell.row, affectedCell.col, gridDims);
        const obstacleCoord = getGridCoordinate(diagonal.row, diagonal.col, gridDims);

        flags.push({
          id: generateFlagId('blind-corner', coord.label),
          ruleType: 'blind-corner',
          severity: 'HIGH',
          gridCoordinate: coord.label,
          finding: `Obstacle at ${obstacleCoord.label} blocks line of sight for approaching traffic`,
          recommendation: 'Install convex safety mirror or proximity sensor.',
          affectedCells: [
            { row: affectedCell.row, col: affectedCell.col },
            { row: diagonal.row, col: diagonal.col },
          ],
          pointsDeduction: 3,
        });
        break;
      }
    }
  }

  return flags;
}

export function checkSpeedRule(
  cellMap: Map<string, CellClassification>,
  gridDims: GridDimensions,
  crossingFlags: SafetyFlag[],
  squareSize: number
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  for (const crossingFlag of crossingFlags) {
    const crossingCell = crossingFlag.affectedCells[0];

    const directions = [
      { dr: -1, dc: 0, name: 'from south' },
      { dr: 1, dc: 0, name: 'from north' },
      { dr: 0, dc: -1, name: 'from east' },
      { dr: 0, dc: 1, name: 'from west' },
    ];

    for (const dir of directions) {
      let consecutiveCount = 0;
      let r = crossingCell.row + dir.dr;
      let c = crossingCell.col + dir.dc;
      let startCell = { row: r, col: c };

      while (r >= 0 && r < gridDims.rows && c >= 0 && c < gridDims.cols) {
        const key = `${r}-${c}`;
        const cell = cellMap.get(key);

        if (cell && cell.type === 'equipment') {
          consecutiveCount++;
          r += dir.dr;
          c += dir.dc;
        } else {
          break;
        }
      }

      if (consecutiveCount >= 5) {
        const distance = consecutiveCount * squareSize;
        const startCoord = getGridCoordinate(startCell.row, startCell.col, gridDims);
        const crossingCoord = getGridCoordinate(crossingCell.row, crossingCell.col, gridDims);

        flags.push({
          id: generateFlagId('speed', `${startCoord.label}-${crossingCoord.label}`),
          ruleType: 'speed',
          severity: 'MEDIUM',
          gridCoordinate: crossingCoord.label,
          finding: `Long forklift approach (${distance} ft) into intersection at ${crossingCoord.label} ${dir.name}`,
          recommendation: `Install floor SLOW decals or speed bumps at midpoint to reduce speed before the crossing.`,
          affectedCells: [{ row: crossingCell.row, col: crossingCell.col }, { row: startCell.row, col: startCell.col }],
          pointsDeduction: 1,
        });
      }
    }
  }

  return flags;
}

export function checkPedestrianAccessToWorkZones(
  cellMap: Map<string, CellClassification>,
  gridDims: GridDimensions,
  zones: Zone[],
  doors: Door[],
  activities: Activity[]
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  const workZones = zones.filter(z => {
    const activity = activities.find(a => a.id === z.activity_id);
    return activity && activity.type === 'work-area';
  });

  const personnelDoors = doors.filter(d => d.is_personnel_only || d.type === 'personnel');

  for (const workZone of workZones) {
    const zoneCenterRow = workZone.grid_y + Math.floor(workZone.grid_height / 2);
    const zoneCenterCol = workZone.grid_x + Math.floor(workZone.grid_width / 2);

    let hasSafePath = false;

    for (const door of personnelDoors) {
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
        const path = findPath(cellMap, gridDims, doorCell.row, doorCell.col, zoneCenterRow, zoneCenterCol, ['pedestrian', 'empty', 'work', 'door']);
        if (path && !pathCrossesEquipmentZone(path, cellMap)) {
          hasSafePath = true;
          break;
        }
      }

      if (hasSafePath) break;
    }

    if (!hasSafePath) {
      const coord = getGridCoordinate(zoneCenterRow, zoneCenterCol, gridDims);
      const activity = activities.find(a => a.id === workZone.activity_id);

      flags.push({
        id: generateFlagId('ped-access-work', workZone.id),
        ruleType: 'ped-access-work',
        severity: 'MEDIUM',
        gridCoordinate: coord.label,
        finding: `Worker must cross forklift path to reach ${activity?.name || 'work zone'}`,
        recommendation: 'Add a pedestrian walkway around the forklift path, or install a marked pedestrian crossing.',
        affectedCells: [{ row: zoneCenterRow, col: zoneCenterCol }],
        pointsDeduction: 1,
      });
    }
  }

  return flags;
}

export function checkPedestrianAccessBetweenStagingLanes(
  cellMap: Map<string, CellClassification>,
  gridDims: GridDimensions,
  zones: Zone[],
  activities: Activity[]
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  const stagingZones = zones.filter(z => {
    const activity = activities.find(a => a.id === z.activity_id);
    return activity && activity.type === 'staging-lane';
  });

  for (let i = 0; i < stagingZones.length; i++) {
    for (let j = i + 1; j < stagingZones.length; j++) {
      const zoneA = stagingZones[i];
      const zoneB = stagingZones[j];

      const activityA = activities.find(a => a.id === zoneA.activity_id);
      const activityB = activities.find(a => a.id === zoneB.activity_id);

      if (!activityA || !activityB) continue;

      const centerARow = zoneA.grid_y + Math.floor(zoneA.grid_height / 2);
      const centerACol = zoneA.grid_x + Math.floor(zoneA.grid_width / 2);
      const centerBRow = zoneB.grid_y + Math.floor(zoneB.grid_height / 2);
      const centerBCol = zoneB.grid_x + Math.floor(zoneB.grid_width / 2);

      const path = findPath(cellMap, gridDims, centerARow, centerACol, centerBRow, centerBCol, ['pedestrian', 'empty', 'staging']);

      if (!path || pathCrossesEquipmentZone(path, cellMap)) {
        const coord = getGridCoordinate(centerARow, centerACol, gridDims);

        flags.push({
          id: generateFlagId('ped-access-staging', `${zoneA.id}-${zoneB.id}`),
          ruleType: 'ped-access-staging',
          severity: 'LOW',
          gridCoordinate: coord.label,
          finding: `No pedestrian walkway between ${activityA.name} and ${activityB.name}. Workers may need to walk through a forklift zone to move between these lanes.`,
          recommendation: 'Add a pedestrian walkway connecting the staging lanes.',
          affectedCells: [
            { row: centerARow, col: centerACol },
            { row: centerBRow, col: centerBCol },
          ],
          pointsDeduction: 0,
        });
      }
    }
  }

  return flags;
}

export function checkEmergencyEgress(
  cellMap: Map<string, CellClassification>,
  gridDims: GridDimensions,
  zones: Zone[],
  doors: Door[],
  activities: Activity[]
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  const exitDoors = doors.filter(d => d.type === 'emergency' || d.type === 'personnel' || d.is_personnel_only);

  for (const zone of zones) {
    const zoneCenterRow = zone.grid_y + Math.floor(zone.grid_height / 2);
    const zoneCenterCol = zone.grid_x + Math.floor(zone.grid_width / 2);

    let hasSafeExit = false;

    for (const door of exitDoors) {
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
        const path = findPath(cellMap, gridDims, zoneCenterRow, zoneCenterCol, doorCell.row, doorCell.col, ['pedestrian', 'empty', 'staging', 'work', 'door']);
        if (path && !pathCrossesEquipmentZone(path, cellMap)) {
          hasSafeExit = true;
          break;
        }
      }

      if (hasSafeExit) break;
    }

    if (!hasSafeExit && exitDoors.length > 0) {
      const coord = getGridCoordinate(zoneCenterRow, zoneCenterCol, gridDims);
      const activity = activities.find(a => a.id === zone.activity_id);
      const nearestDoor = exitDoors[0];

      flags.push({
        id: generateFlagId('egress', zone.id),
        ruleType: 'egress',
        severity: 'HIGH',
        gridCoordinate: coord.label,
        finding: `No safe pedestrian exit path from ${activity?.name || zone.name} to ${nearestDoor.name} without crossing a forklift path`,
        recommendation: 'Add a pedestrian walkway or install a marked crossing for emergency egress.',
        affectedCells: [{ row: zoneCenterRow, col: zoneCenterCol }],
        pointsDeduction: 3,
      });
    }
  }

  return flags;
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

export function runAllSafetyChecks(
  gridDims: GridDimensions,
  zones: Zone[],
  corridors: Corridor[],
  doors: Door[],
  paintedSquares: Map<string, { type: 'permanent' | 'semi-fixed' }>,
  activities: Activity[],
  squareSize: number
): SafetyFlag[] {
  const cellMap = classifyGridCells(gridDims, zones, corridors, doors, paintedSquares, activities);

  const crossingFlags = checkCrossingRule(cellMap, gridDims);
  const separationFlags = checkSeparationRule(cellMap, gridDims);
  const blindCornerFlags = checkBlindCornerRule(cellMap, gridDims, crossingFlags);
  const speedFlags = checkSpeedRule(cellMap, gridDims, crossingFlags, squareSize);
  const pedAccessWorkFlags = checkPedestrianAccessToWorkZones(cellMap, gridDims, zones, doors, activities);
  const pedAccessStagingFlags = checkPedestrianAccessBetweenStagingLanes(cellMap, gridDims, zones, activities);
  const egressFlags = checkEmergencyEgress(cellMap, gridDims, zones, doors, activities);

  return [
    ...crossingFlags,
    ...separationFlags,
    ...blindCornerFlags,
    ...speedFlags,
    ...pedAccessWorkFlags,
    ...pedAccessStagingFlags,
    ...egressFlags,
  ];
}
