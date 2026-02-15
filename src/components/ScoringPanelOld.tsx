import { useEffect, useState } from 'react';
import { useGridStore } from '../store/gridStore';
import { Activity, Zone } from '../types';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ScoreFactor {
  name: string;
  label: string;
  score: number;
  maxScore: number;
  display: string;
  suggestion: string;
  changed?: number;
  details?: string[];
}

interface LayoutScore {
  total: number;
  factors: ScoreFactor[];
  bestScore: number;
}

export function ScoringPanel() {
  const { zones, activities, settings, activityRelationships, volumeTiming, doors, corridors, paintedSquares } = useGridStore();
  const [score, setScore] = useState<LayoutScore>({ total: 0, factors: [], bestScore: 0 });
  const [flashingFactor, setFlashingFactor] = useState<string | null>(null);

  const calculateDistance = (zone1: Zone, zone2: Zone): number => {
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
  };

  const formatDistance = (squares: number): string => {
    const feet = Math.round(squares * settings.squareSize);
    if (squares === 0) return '0 ft (touching)';
    if (squares === 1) return `${feet} ft (1 square)`;
    return `${feet} ft (${Math.round(squares)} squares)`;
  };

  const gridLabel = (row: number, col: number): string => {
    const letter = String.fromCharCode(65 + row);
    return `${letter}${col + 1}`;
  };

  const getScreenDirection = (fromZone: Zone, toZone: Zone): string => {
    const fromCenterX = fromZone.grid_x + fromZone.grid_width / 2;
    const fromCenterY = fromZone.grid_y + fromZone.grid_height / 2;
    const toCenterX = toZone.grid_x + toZone.grid_width / 2;
    const toCenterY = toZone.grid_y + toZone.grid_height / 2;

    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy * 2) {
      return dx > 0 ? 'right' : 'left';
    } else if (absDy > absDx * 2) {
      return dy > 0 ? 'down' : 'up';
    } else {
      const ns = dy > 0 ? 'down' : 'up';
      const ew = dx > 0 ? 'right' : 'left';
      return `${ns}-${ew}`;
    }
  };

  const reverseDirection = (dir: string): string => {
    return dir
      .replace('up-right', 'DOWN_LEFT')
      .replace('up-left', 'DOWN_RIGHT')
      .replace('down-right', 'UP_LEFT')
      .replace('down-left', 'UP_RIGHT')
      .replace('up', 'DOWN')
      .replace('down', 'UP')
      .replace('left', 'RIGHT')
      .replace('right', 'LEFT')
      .toLowerCase()
      .replace('_', '-');
  };

  interface CorridorRecommendation {
    lane: Zone;
    laneName: string;
    targetType: 'corridor' | 'zone' | 'door';
    targetName: string;
    targetPosition: { row: number; col: number };
    direction: string;
    distance: number;
    corridorType: 'forklift' | 'pedestrian';
  }

  const hasCorridorBetween = (zoneA: Zone, zoneB: Zone): boolean => {
    return corridors.some(corridor => {
      const corridorMinX = Math.min(corridor.start_grid_x, corridor.end_grid_x);
      const corridorMaxX = Math.max(corridor.start_grid_x, corridor.end_grid_x);
      const corridorMinY = Math.min(corridor.start_grid_y, corridor.end_grid_y);
      const corridorMaxY = Math.max(corridor.start_grid_y, corridor.end_grid_y);

      const zoneARight = zoneA.grid_x + zoneA.grid_width;
      const zoneABottom = zoneA.grid_y + zoneA.grid_height;
      const zoneBRight = zoneB.grid_x + zoneB.grid_width;
      const zoneBBottom = zoneB.grid_y + zoneB.grid_height;

      const corridorRight = corridorMaxX + corridor.width;
      const corridorBottom = corridorMaxY + corridor.width;

      const corridorTouchesA = !(
        zoneARight < corridorMinX ||
        zoneA.grid_x > corridorRight ||
        zoneABottom < corridorMinY ||
        zoneA.grid_y > corridorBottom
      );

      const corridorTouchesB = !(
        zoneBRight < corridorMinX ||
        zoneB.grid_x > corridorRight ||
        zoneBBottom < corridorMinY ||
        zoneB.grid_y > corridorBottom
      );

      return corridorTouchesA && corridorTouchesB;
    });
  };

  const calculateFlowDistance = (): ScoreFactor => {
    const workAreaActivities = activities
      .filter(a => a.type === 'work-area')
      .sort((a, b) => a.sort_order - b.sort_order);

    const workAreaZones = workAreaActivities
      .map(act => zones.find(z => z.activity_id === act.id))
      .filter((z): z is Zone => z !== undefined);

    const stagingLaneActivities = activities.filter(a => a.type === 'staging-lane');
    const stagingLaneZones = stagingLaneActivities
      .map(act => zones.find(z => z.activity_id === act.id))
      .filter((z): z is Zone => z !== undefined);

    if (workAreaZones.length < 2) {
      return {
        name: 'flow_distance',
        label: 'How far does material travel?',
        score: 0,
        maxScore: 20,
        display: `${workAreaZones.length} of ${workAreaActivities.length} work areas placed`,
        suggestion: 'Place zones for your work areas to calculate flow distance',
        details: [],
      };
    }

    if (stagingLaneZones.length === 0) {
      return {
        name: 'flow_distance',
        label: 'How far does material travel?',
        score: 10,
        maxScore: 20,
        display: 'No staging lanes placed yet',
        suggestion: 'Add staging lanes to see full flow scoring',
        details: [],
      };
    }

    const inboundDoors = doors.filter(d => d.inbound_percentage && d.inbound_percentage > 0);
    const outboundDoors = doors.filter(d => d.outbound_percentage && d.outbound_percentage > 0);

    let totalWeightedDistance = 0;
    let totalVolume = 0;
    const details: string[] = [];

    const pathsInfo: Array<{ lane: string; distance: number; percentage: number }> = [];

    stagingLaneZones.forEach(lane => {
      const vt = volumeTiming.find(v => v.activity_id === lane.activity_id);
      const act = activities.find(a => a.id === lane.activity_id);
      if (!vt || vt.percentage === 0) return;

      let pathDistance = 0;

      if (inboundDoors.length > 0 && workAreaZones.length > 0) {
        const firstWorkArea = workAreaZones[0];
        let minInboundDistance = Infinity;

        inboundDoors.forEach(door => {
          const waRight = firstWorkArea.grid_x + firstWorkArea.grid_width;
          const waBottom = firstWorkArea.grid_y + firstWorkArea.grid_height;

          let dx = 0;
          if (door.grid_x < firstWorkArea.grid_x) {
            dx = firstWorkArea.grid_x - door.grid_x;
          } else if (door.grid_x >= waRight) {
            dx = door.grid_x - waRight;
          }

          let dy = 0;
          if (door.grid_y < firstWorkArea.grid_y) {
            dy = firstWorkArea.grid_y - door.grid_y;
          } else if (door.grid_y >= waBottom) {
            dy = door.grid_y - waBottom;
          }

          minInboundDistance = Math.min(minInboundDistance, dx + dy);
        });

        if (minInboundDistance !== Infinity) {
          pathDistance += minInboundDistance;
        }
      }

      for (let i = 0; i < workAreaZones.length - 1; i++) {
        pathDistance += calculateDistance(workAreaZones[i], workAreaZones[i + 1]);
      }

      if (workAreaZones.length > 0) {
        const lastWorkArea = workAreaZones[workAreaZones.length - 1];
        pathDistance += calculateDistance(lastWorkArea, lane);
      }

      if (outboundDoors.length > 0) {
        let minOutboundDistance = Infinity;

        outboundDoors.forEach(door => {
          const laneRight = lane.grid_x + lane.grid_width;
          const laneBottom = lane.grid_y + lane.grid_height;

          let dx = 0;
          if (door.grid_x < lane.grid_x) {
            dx = lane.grid_x - door.grid_x;
          } else if (door.grid_x >= laneRight) {
            dx = door.grid_x - laneRight;
          }

          let dy = 0;
          if (door.grid_y < lane.grid_y) {
            dy = lane.grid_y - door.grid_y;
          } else if (door.grid_y >= laneBottom) {
            dy = door.grid_y - laneBottom;
          }

          minOutboundDistance = Math.min(minOutboundDistance, dx + dy);
        });

        if (minOutboundDistance !== Infinity) {
          pathDistance += minOutboundDistance;
        }
      }

      pathsInfo.push({
        lane: act?.name || 'Unknown',
        distance: pathDistance,
        percentage: vt.percentage,
      });

      totalWeightedDistance += pathDistance * (vt.percentage / 100);
      totalVolume += vt.percentage;
    });

    const avgSquareSize = settings.squareSize;
    const totalWeightedDistanceFt = Math.round(totalWeightedDistance * avgSquareSize);

    const minimumPossibleDistance = stagingLaneZones.length * workAreaZones.length * 1.5;
    const bestPossibleFt = Math.round(minimumPossibleDistance * avgSquareSize);

    const efficiency = minimumPossibleDistance / (totalWeightedDistance || 1);
    const calculatedScore = Math.min(20, Math.round(20 * efficiency));

    pathsInfo.sort((a, b) => b.distance - a.distance);

    const longestPath = pathsInfo[0];
    if (longestPath) {
      const distFt = Math.round(longestPath.distance * avgSquareSize);
      details.push(`Longest flow path: ${longestPath.lane} = ${distFt} ft (${Math.round(longestPath.distance)} squares) — handles ${longestPath.percentage}% of volume`);
    }

    if (calculatedScore < 15) {
      const highVolumeLongDistance = pathsInfo.filter(p => p.percentage > 15 && p.distance > 15);
      highVolumeLongDistance.forEach(p => {
        const distFt = Math.round(p.distance * avgSquareSize);
        const laneZone = stagingLaneZones.find(z => {
          const act = activities.find(a => a.id === z.activity_id);
          return act?.name === p.lane;
        });

        if (laneZone && workAreaZones.length > 0) {
          const lastWorkArea = workAreaZones[workAreaZones.length - 1];
          const direction = getScreenDirection(lastWorkArea, laneZone);
          const revDir = reverseDirection(direction);

          details.push(`⚠ ${p.lane} (${gridLabel(laneZone.grid_y, laneZone.grid_x)}) handles ${p.percentage}% of volume but has a ${distFt} ft path — move it ${revDir} closer to ${activities.find(a => a.id === lastWorkArea.activity_id)?.name || 'the work flow'}`);
        } else {
          details.push(`⚠ ${p.lane} handles ${p.percentage}% of volume but has a ${distFt} ft path — move it closer to the work flow`);
        }
      });
    }

    details.push(`Total weighted flow distance: ${totalWeightedDistanceFt} ft | Best possible: ~${bestPossibleFt} ft`);

    let suggestion = '';
    if (calculatedScore < 15 && longestPath && longestPath.percentage > 15) {
      const distFt = Math.round(longestPath.distance * avgSquareSize);
      const laneZone = stagingLaneZones.find(z => {
        const act = activities.find(a => a.id === z.activity_id);
        return act?.name === longestPath.lane;
      });

      if (laneZone && workAreaZones.length > 0) {
        const lastWorkArea = workAreaZones[workAreaZones.length - 1];
        const direction = getScreenDirection(lastWorkArea, laneZone);
        const revDir = reverseDirection(direction);

        suggestion = `Move ${longestPath.lane} (${gridLabel(laneZone.grid_y, laneZone.grid_x)}) ${revDir} closer to ${activities.find(a => a.id === lastWorkArea.activity_id)?.name || 'work areas'}. This lane handles ${longestPath.percentage}% of volume with a ${distFt} ft path, reducing this could save thousands of feet of travel daily.`;
      } else {
        suggestion = `${longestPath.lane} handles ${longestPath.percentage}% of volume but has a ${distFt} ft path. Move it closer to reduce travel distance.`;
      }
    }

    const flowPath = inboundDoors.length > 0 && outboundDoors.length > 0
      ? `inbound → ${workAreaZones.length} work areas → staging → outbound`
      : `through ${workAreaZones.length} work areas → staging`;

    return {
      name: 'flow_distance',
      label: 'How far does material travel?',
      score: calculatedScore,
      maxScore: 20,
      display: `Flow: ${flowPath} | ${totalWeightedDistanceFt} ft weighted avg`,
      suggestion,
      details,
    };
  };

  const calculateClosenessCompliance = (): ScoreFactor => {
    if (activityRelationships.length === 0) {
      return {
        name: 'closeness_compliance',
        label: 'Are related areas close enough?',
        score: 20,
        maxScore: 20,
        display: 'No closeness relationships defined',
        suggestion: '',
        details: [],
      };
    }

    let pointsEarned = 0;
    let pointsPossible = 0;
    const details: string[] = [];

    activityRelationships.forEach(rel => {
      const zoneA = zones.find(z => z.activity_id === rel.activity_a_id);
      const zoneB = zones.find(z => z.activity_id === rel.activity_b_id);

      if (!zoneA || !zoneB) return;

      const actA = activities.find(a => a.id === rel.activity_a_id);
      const actB = activities.find(a => a.id === rel.activity_b_id);

      const distance = calculateDistance(zoneA, zoneB);
      const hasCorridor = hasCorridorBetween(zoneA, zoneB);

      if (rel.rating === 'must-be-close') {
        pointsPossible += 3;
        if (distance === 0) {
          pointsEarned += 3;
          details.push(`✓ ${actA?.name} ↔ ${actB?.name}: touching (rated: must be close)`);
        } else if (distance <= 2) {
          pointsEarned += 3;
          if (hasCorridor) {
            details.push(`✓ ${actA?.name} ↔ ${actB?.name}: ${formatDistance(distance)} with corridor (rated: must be close)`);
          } else {
            const direction = getScreenDirection(zoneA, zoneB);
            details.push(`⚠ ${actA?.name} (${gridLabel(zoneA.grid_y, zoneA.grid_x)}) ↔ ${actB?.name} (${gridLabel(zoneB.grid_y, zoneB.grid_x)}): ${formatDistance(distance)} — rated must be close, but no walkway connects them. Add a corridor running ${direction}.`);
          }
        } else if (distance <= 4) {
          pointsEarned += 2.25;
          const direction = getScreenDirection(zoneA, zoneB);
          const revDir = reverseDirection(direction);
          details.push(`⚠ ${actA?.name} (${gridLabel(zoneA.grid_y, zoneA.grid_x)}) ↔ ${actB?.name} (${gridLabel(zoneB.grid_y, zoneB.grid_x)}): ${formatDistance(distance)} — rated must be close, should be within 10 ft. Move ${actB?.name} ${revDir} closer to ${actA?.name}.`);
        } else if (distance <= 7) {
          pointsEarned += 0.75;
          details.push(`⚠ ${actA?.name} (${gridLabel(zoneA.grid_y, zoneA.grid_x)}) ↔ ${actB?.name} (${gridLabel(zoneB.grid_y, zoneB.grid_x)}): ${formatDistance(distance)} — rated must be close, TOO FAR. Relocate ${actB?.name} adjacent to ${actA?.name}.`);
        } else {
          details.push(`⚠ ${actA?.name} (${gridLabel(zoneA.grid_y, zoneA.grid_x)}) ↔ ${actB?.name} (${gridLabel(zoneB.grid_y, zoneB.grid_x)}): ${formatDistance(distance)} — rated must be close, MUCH TOO FAR. Relocate ${actB?.name} adjacent to ${actA?.name}.`);
        }
      } else if (rel.rating === 'prefer-close') {
        pointsPossible += 2;
        if (distance <= 4) {
          pointsEarned += 2;
          details.push(`✓ ${actA?.name} ↔ ${actB?.name}: ${formatDistance(distance)} (rated: prefer close)`);
        } else if (distance <= 7) {
          pointsEarned += 1;
          const direction = getScreenDirection(zoneA, zoneB);
          const revDir = reverseDirection(direction);
          details.push(`ℹ ${actA?.name} (${gridLabel(zoneA.grid_y, zoneA.grid_x)}) ↔ ${actB?.name} (${gridLabel(zoneB.grid_y, zoneB.grid_x)}): ${formatDistance(distance)} — prefer close, could be closer. Consider moving ${actB?.name} ${revDir}.`);
        } else {
          const direction = getScreenDirection(zoneA, zoneB);
          const revDir = reverseDirection(direction);
          details.push(`⚠ ${actA?.name} (${gridLabel(zoneA.grid_y, zoneA.grid_x)}) ↔ ${actB?.name} (${gridLabel(zoneB.grid_y, zoneB.grid_x)}): ${formatDistance(distance)} — prefer close, but quite far. Move ${actB?.name} ${revDir} toward ${actA?.name}.`);
        }
      } else if (rel.rating === 'keep-apart') {
        pointsPossible += 2;
        if (distance >= 8) {
          pointsEarned += 2;
          details.push(`✓ ${actA?.name} ↔ ${actB?.name}: ${formatDistance(distance)} (rated: keep apart)`);
        } else if (distance >= 5) {
          pointsEarned += 1;
          details.push(`ℹ ${actA?.name} (${gridLabel(zoneA.grid_y, zoneA.grid_x)}) ↔ ${actB?.name} (${gridLabel(zoneB.grid_y, zoneB.grid_x)}): ${formatDistance(distance)} — should keep apart, could be farther.`);
        } else {
          const direction = getScreenDirection(zoneA, zoneB);
          details.push(`⚠ ${actA?.name} (${gridLabel(zoneA.grid_y, zoneA.grid_x)}) ↔ ${actB?.name} (${gridLabel(zoneB.grid_y, zoneB.grid_x)}): ${formatDistance(distance)} — rated keep apart, TOO CLOSE. Move ${actB?.name} ${direction} away from ${actA?.name}.`);
        }
      }
    });

    const score = pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 20) : 20;
    const pairsSatisfied = Math.round((pointsEarned / pointsPossible) * activityRelationships.length);

    const violations = details.filter(d => d.includes('⚠'));
    const suggestion = violations.length > 0 ? violations[0].replace('⚠ ', '') : '';

    return {
      name: 'closeness_compliance',
      label: 'Are related areas close enough?',
      score,
      maxScore: 20,
      display: `${pairsSatisfied} of ${activityRelationships.length} pairs satisfied`,
      suggestion,
      details,
    };
  };

  const calculateDeparturePriority = (): ScoreFactor => {
    const stagingLanes = zones.filter(z => {
      const act = activities.find(a => a.id === z.activity_id);
      return act?.type === 'staging-lane';
    });

    if (stagingLanes.length === 0 || doors.length === 0) {
      return {
        name: 'departure_priority',
        label: 'Are first departures closest to the exit?',
        score: 0,
        maxScore: 15,
        display: 'Need staging lanes and doors to calculate',
        suggestion: 'Add doors and staging lanes to the layout',
        details: [],
      };
    }

    const outboundDoors = doors.filter(d =>
      d.outbound_percentage && d.outbound_percentage > 0 &&
      (d.type === 'hangar' || d.type === 'loading-dock')
    );

    if (outboundDoors.length === 0) {
      return {
        name: 'departure_priority',
        label: 'Are first departures closest to the exit?',
        score: 0,
        maxScore: 15,
        display: 'No outbound vehicle doors marked',
        suggestion: 'Mark hangar or loading-dock doors as "Outbound" in Step 2A to enable departure scoring',
        details: [],
      };
    }

    const lanesWithTiming = stagingLanes
      .map(lane => {
        const act = activities.find(a => a.id === lane.activity_id);
        return {
          lane,
          activity: act,
          departureTime: act?.departure_time || '23:59',
        };
      })
      .sort((a, b) => a.departureTime.localeCompare(b.departureTime));

    const lanesWithDoorDistance = lanesWithTiming.map(item => {
      let minDistance = Infinity;

      outboundDoors.forEach(door => {
        const laneRight = item.lane.grid_x + item.lane.grid_width;
        const laneBottom = item.lane.grid_y + item.lane.grid_height;

        let dx = 0;
        if (door.grid_x < item.lane.grid_x) {
          dx = item.lane.grid_x - door.grid_x;
        } else if (door.grid_x >= laneRight) {
          dx = door.grid_x - laneRight;
        }

        let dy = 0;
        if (door.grid_y < item.lane.grid_y) {
          dy = item.lane.grid_y - door.grid_y;
        } else if (door.grid_y >= laneBottom) {
          dy = door.grid_y - laneBottom;
        }

        const dist = dx + dy;
        minDistance = Math.min(minDistance, dist);
      });

      return { ...item, doorDistance: minDistance };
    });

    const rankedByDeparture = [...lanesWithDoorDistance];
    const rankedByDistance = [...lanesWithDoorDistance].sort((a, b) => a.doorDistance - b.doorDistance);

    const details: string[] = [];

    details.push('Departure order (earliest first):');
    rankedByDeparture.forEach((item, idx) => {
      details.push(`  ${idx + 1}. ${item.activity?.name} (${item.departureTime})`);
    });

    details.push('');
    details.push('Actual proximity to outbound door (closest first):');
    rankedByDistance.forEach((item, idx) => {
      const distFt = Math.round(item.doorDistance * settings.squareSize);
      details.push(`  ${idx + 1}. ${item.activity?.name} — ${distFt} ft from door`);
    });

    let correctPositions = 0;
    const mismatches: string[] = [];

    rankedByDeparture.forEach((item, idealIndex) => {
      const actualIndex = rankedByDistance.indexOf(item);
      if (Math.abs(actualIndex - idealIndex) <= 1) {
        correctPositions++;
      } else {
        const ordinal = (n: number) => {
          const s = ['th', 'st', 'nd', 'rd'];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        const nearestDoor = outboundDoors.reduce((nearest, door) => {
          const laneZone = item.lane;
          const doorZone: Zone = {
            id: door.id,
            name: door.name,
            grid_x: door.grid_x,
            grid_y: door.grid_y,
            grid_width: door.width,
            grid_height: 1,
            color: '',
            group_type: 'flexible' as const,
            created_at: '',
          };

          const dist = calculateDistance(laneZone, doorZone);
          if (!nearest || dist < nearest.distance) {
            return { door, distance: dist };
          }
          return nearest;
        }, null as { door: typeof outboundDoors[0], distance: number } | null);

        const distFt = Math.round(item.doorDistance * settings.squareSize);
        mismatches.push(`⚠ ${item.activity?.name} (${gridLabel(item.lane.grid_y, item.lane.grid_x)}) departs ${ordinal(idealIndex + 1)} (${item.departureTime}) but is ${ordinal(actualIndex + 1)} closest to ${nearestDoor?.door.name || 'door'} at ${distFt} ft`);
      }
    });

    details.push('');
    if (mismatches.length > 0) {
      details.push(...mismatches);
    } else {
      details.push('✓ All lanes are in optimal departure order');
    }

    const score = Math.round((correctPositions / lanesWithTiming.length) * 15);

    let suggestion = '';
    if (mismatches.length > 0 && rankedByDeparture.length >= 2) {
      const firstMismatch = rankedByDeparture.find((item, idealIndex) => {
        const actualIndex = rankedByDistance.indexOf(item);
        return Math.abs(actualIndex - idealIndex) > 1;
      });

      if (firstMismatch) {
        const idealIndex = rankedByDeparture.indexOf(firstMismatch);
        const shouldBeClosest = rankedByDistance[idealIndex];
        const nearestDoor = outboundDoors[0];

        if (shouldBeClosest && nearestDoor) {
          const direction = getScreenDirection(shouldBeClosest.lane, {
            id: nearestDoor.id,
            name: nearestDoor.name,
            grid_x: nearestDoor.grid_x,
            grid_y: nearestDoor.grid_y,
            grid_width: nearestDoor.width,
            grid_height: 1,
            color: '',
            group_type: 'flexible' as const,
            created_at: '',
          });
          suggestion = `Move ${shouldBeClosest.activity?.name} (currently at ${gridLabel(shouldBeClosest.lane.grid_y, shouldBeClosest.lane.grid_x)}) ${direction} closer to ${nearestDoor.name} to match its ${shouldBeClosest.departureTime} departure time.`;
        }
      }
    }

    return {
      name: 'departure_priority',
      label: 'Are first departures closest to the exit?',
      score,
      maxScore: 15,
      display: `Departure order vs door proximity: ${correctPositions} of ${lanesWithTiming.length} correct`,
      suggestion,
      details,
    };
  };

  const calculateSpaceUtilization = (): ScoreFactor => {
    const stagingLanes = zones.filter(z => {
      const act = activities.find(a => a.id === z.activity_id);
      return act?.type === 'staging-lane';
    });

    if (stagingLanes.length === 0) {
      return {
        name: 'space_utilization',
        label: 'Is space matched to volume?',
        score: 15,
        maxScore: 15,
        display: 'No staging lanes placed yet',
        suggestion: '',
        details: [],
      };
    }

    const totalStagingSpace = stagingLanes.reduce((sum, lane) => sum + (lane.grid_width * lane.grid_height), 0);
    const totalVolume = volumeTiming.reduce((sum, vt) => sum + vt.percentage, 0);

    const details: string[] = [];
    let totalDeviation = 0;

    stagingLanes.forEach(lane => {
      const vt = volumeTiming.find(v => v.activity_id === lane.activity_id);
      const act = activities.find(a => a.id === lane.activity_id);

      if (!vt) return;

      const spacePercent = ((lane.grid_width * lane.grid_height) / totalStagingSpace) * 100;
      const volumePercent = vt.percentage;
      const deviation = Math.abs(spacePercent - volumePercent);
      totalDeviation += deviation;

      const spaceArea = lane.grid_width * lane.grid_height * settings.squareSize * settings.squareSize;

      if (deviation > 10) {
        if (spacePercent < volumePercent) {
          const needed = Math.round((volumePercent / 100) * totalStagingSpace - (lane.grid_width * lane.grid_height));
          const currentSize = `${lane.grid_width}×${lane.grid_height}`;
          const extraRows = Math.ceil(needed / lane.grid_width);
          const newHeight = lane.grid_height + extraRows;
          const suggestedSize = `${lane.grid_width}×${newHeight}`;

          details.push(`⚠ ${act?.name} (${gridLabel(lane.grid_y, lane.grid_x)}, size ${currentSize}): handles ${Math.round(volumePercent)}% of volume but has only ${Math.round(spacePercent)}% of space (${spaceArea} sq ft) — expand to ${suggestedSize} (add ${needed} squares)`);
        } else {
          const excess = Math.round((lane.grid_width * lane.grid_height) - (volumePercent / 100) * totalStagingSpace);
          const currentSize = `${lane.grid_width}×${lane.grid_height}`;
          const rowsToRemove = Math.floor(excess / lane.grid_width);
          const newHeight = Math.max(2, lane.grid_height - rowsToRemove);
          const suggestedSize = `${lane.grid_width}×${newHeight}`;

          details.push(`ℹ ${act?.name} (${gridLabel(lane.grid_y, lane.grid_x)}, size ${currentSize}): handles ${Math.round(volumePercent)}% of volume but has ${Math.round(spacePercent)}% of space (${spaceArea} sq ft) — could shrink to ${suggestedSize} (remove ${excess} squares)`);
        }
      } else {
        details.push(`✓ ${act?.name}: ${Math.round(volumePercent)}% volume, ${Math.round(spacePercent)}% space — well matched`);
      }
    });

    const avgDeviation = totalDeviation / stagingLanes.length;
    const score = Math.max(0, Math.round(15 - (avgDeviation / 10)));

    const warnings = details.filter(d => d.includes('⚠'));
    const suggestion = warnings.length > 0 ? warnings[0].replace('⚠ ', '') : '';

    return {
      name: 'space_utilization',
      label: 'Is space matched to volume?',
      score,
      maxScore: 15,
      display: warnings.length > 0 ? `${warnings.length} lane(s) have space/volume mismatch` : 'Space allocation matches volume well',
      suggestion,
      details,
    };
  };

  const calculatePathClearance = (): ScoreFactor => {
    const stagingLanes = zones.filter(z => {
      const act = activities.find(a => a.id === z.activity_id);
      return act?.type === 'staging-lane';
    });

    if (stagingLanes.length === 0) {
      return {
        name: 'path_clearance',
        label: 'Can equipment move freely?',
        score: 15,
        maxScore: 15,
        display: 'No staging lanes to check yet',
        suggestion: '',
        details: [],
      };
    }

    const forkliftCorridors = corridors.filter(c => c.type === 'forklift');
    const pedestrianCorridors = corridors.filter(c => c.type === 'pedestrian');
    const details: string[] = [];

    if (corridors.length === 0) {
      return {
        name: 'path_clearance',
        label: 'Can equipment move freely?',
        score: 0,
        maxScore: 15,
        display: 'No corridors drawn yet',
        suggestion: 'Draw pedestrian walkways and forklift paths to connect work areas',
        details: ['⚠ No corridors drawn — add pedestrian walkways and forklift paths'],
      };
    }

    let points = 0;

    if (forkliftCorridors.length > 0) {
      points += 5;
      details.push(`✓ ${forkliftCorridors.length} forklift path(s) drawn`);
    } else {
      details.push('⚠ No forklift paths drawn — add at least one forklift corridor');
    }

    if (pedestrianCorridors.length > 0) {
      details.push(`✓ ${pedestrianCorridors.length} pedestrian walkway(s) drawn`);
    }

    let lanesWithPaths = 0;
    const disconnectedLanes: CorridorRecommendation[] = [];

    stagingLanes.forEach(lane => {
      const act = activities.find(a => a.id === lane.activity_id);
      const hasPath = corridors.some(corridor => {
        const laneRight = lane.grid_x + lane.grid_width;
        const laneBottom = lane.grid_y + lane.grid_height;

        const corridorMinX = Math.min(corridor.start_grid_x, corridor.end_grid_x);
        const corridorMaxX = Math.max(corridor.start_grid_x, corridor.end_grid_x);
        const corridorMinY = Math.min(corridor.start_grid_y, corridor.end_grid_y);
        const corridorMaxY = Math.max(corridor.start_grid_y, corridor.end_grid_y);

        const corridorRight = corridorMaxX + corridor.width;
        const corridorBottom = corridorMaxY + corridor.width;

        const xOverlap = !(laneRight < corridorMinX || lane.grid_x > corridorRight);
        const yOverlap = !(laneBottom < corridorMinY || lane.grid_y > corridorBottom);

        const isAdjacent = xOverlap && yOverlap;
        const isNearby = calculateDistance(
          { ...lane, grid_width: lane.grid_width, grid_height: lane.grid_height },
          {
            id: '',
            name: '',
            grid_x: corridorMinX,
            grid_y: corridorMinY,
            grid_width: corridorMaxX - corridorMinX + corridor.width,
            grid_height: corridorMaxY - corridorMinY + corridor.width,
            color: '',
            group_type: 'flexible' as const,
            created_at: '',
          }
        ) <= 3;

        return isAdjacent || isNearby;
      });

      if (hasPath) {
        lanesWithPaths++;
      } else {
        const recommendation = findBestCorridorTarget(lane, act?.name || 'Unknown');
        if (recommendation) {
          disconnectedLanes.push(recommendation);
        }
      }
    });

    points += Math.round((lanesWithPaths / stagingLanes.length) * 10);

    if (disconnectedLanes.length > 0) {
      disconnectedLanes.forEach(rec => {
        const distStr = formatDistance(rec.distance);
        details.push(
          `⚠ ${rec.laneName} (${gridLabel(rec.lane.grid_y, rec.lane.grid_x)}) — no corridor connection. Draw a ${rec.corridorType} path from ${rec.targetName} (${gridLabel(rec.targetPosition.row, rec.targetPosition.col)}) ${rec.direction} to ${rec.laneName}. Distance: ${distStr}.`
        );
      });
    } else {
      details.push(`✓ All ${stagingLanes.length} staging lanes have corridor access`);
    }

    const score = Math.min(15, points);

    let suggestion = '';
    if (disconnectedLanes.length > 0) {
      const optimalCorridor = findOptimalCorridorPlacement(disconnectedLanes);
      if (optimalCorridor) {
        suggestion = optimalCorridor;
      } else {
        const first = disconnectedLanes[0];
        suggestion = `Draw a ${first.corridorType} path from ${first.targetName} ${first.direction} to ${first.laneName} (${formatDistance(first.distance)}). This will improve your score by approximately ${Math.round(10 / stagingLanes.length)} points.`;
      }
    } else if (forkliftCorridors.length === 0) {
      suggestion = 'Add forklift paths to improve material handling';
    }

    return {
      name: 'path_clearance',
      label: 'Can equipment move freely?',
      score,
      maxScore: 15,
      display: `${forkliftCorridors.length} forklift, ${pedestrianCorridors.length} pedestrian | ${lanesWithPaths}/${stagingLanes.length} lanes accessible`,
      suggestion,
      details,
    };
  };

  const findBestCorridorTarget = (lane: Zone, laneName: string): CorridorRecommendation | null => {
    let bestTarget: CorridorRecommendation | null = null;
    let minDistance = Infinity;

    corridors.forEach(corridor => {
      const corridorMinX = Math.min(corridor.start_grid_x, corridor.end_grid_x);
      const corridorMaxX = Math.max(corridor.start_grid_x, corridor.end_grid_x);
      const corridorMinY = Math.min(corridor.start_grid_y, corridor.end_grid_y);
      const corridorMaxY = Math.max(corridor.start_grid_y, corridor.end_grid_y);

      const corridorZone: Zone = {
        id: corridor.id,
        name: '',
        grid_x: corridorMinX,
        grid_y: corridorMinY,
        grid_width: corridorMaxX - corridorMinX + corridor.width,
        grid_height: corridorMaxY - corridorMinY + corridor.width,
        color: '',
        group_type: 'flexible' as const,
        created_at: '',
      };

      const distance = calculateDistance(lane, corridorZone);

      if (distance < minDistance && distance <= 10) {
        minDistance = distance;
        const direction = getScreenDirection(corridorZone, lane);
        const corridorName = corridor.name || `${corridor.type} corridor`;

        bestTarget = {
          lane,
          laneName,
          targetType: 'corridor',
          targetName: corridorName,
          targetPosition: { row: corridorMinY, col: corridorMinX },
          direction,
          distance,
          corridorType: 'forklift',
        };
      }
    });

    if (bestTarget) return bestTarget;

    const processZones = zones.filter(z => {
      const act = activities.find(a => a.id === z.activity_id);
      return act?.type === 'process';
    });

    processZones.forEach(zone => {
      const distance = calculateDistance(lane, zone);
      const act = activities.find(a => a.id === zone.activity_id);

      if (distance < minDistance) {
        minDistance = distance;
        const direction = getScreenDirection(zone, lane);

        bestTarget = {
          lane,
          laneName,
          targetType: 'zone',
          targetName: act?.name || 'Process area',
          targetPosition: { row: zone.grid_y, col: zone.grid_x },
          direction,
          distance,
          corridorType: 'forklift',
        };
      }
    });

    if (bestTarget) return bestTarget;

    const outboundDoors = doors.filter(d => (d.outbound_percentage || 0) > 0);

    outboundDoors.forEach(door => {
      const doorZone: Zone = {
        id: door.id,
        name: door.name,
        grid_x: door.grid_x,
        grid_y: door.grid_y,
        grid_width: door.width,
        grid_height: 1,
        color: '',
        group_type: 'flexible' as const,
        created_at: '',
      };

      const distance = calculateDistance(lane, doorZone);

      if (distance < minDistance) {
        minDistance = distance;
        const direction = getScreenDirection(lane, doorZone);

        bestTarget = {
          lane,
          laneName,
          targetType: 'door',
          targetName: door.name,
          targetPosition: { row: door.grid_y, col: door.grid_x },
          direction,
          distance,
          corridorType: 'forklift',
        };
      }
    });

    return bestTarget;
  };

  const findOptimalCorridorPlacement = (disconnected: CorridorRecommendation[]): string | null => {
    if (disconnected.length < 2) return null;

    const lanes = disconnected.map(d => d.lane);

    const columns = new Map<number, number>();
    const rows = new Map<number, number>();

    lanes.forEach(lane => {
      const col = lane.grid_x;
      const row = lane.grid_y;
      columns.set(col, (columns.get(col) || 0) + 1);
      rows.set(row, (rows.get(row) || 0) + 1);
    });

    let bestCol = -1;
    let bestColCount = 0;
    columns.forEach((count, col) => {
      if (count > bestColCount) {
        bestColCount = count;
        bestCol = col;
      }
    });

    let bestRow = -1;
    let bestRowCount = 0;
    rows.forEach((count, row) => {
      if (count > bestRowCount) {
        bestRowCount = count;
        bestRow = row;
      }
    });

    if (bestColCount >= 2) {
      const connectedLanes = lanes.filter(l => l.grid_x === bestCol);
      const minRow = Math.min(...connectedLanes.map(l => l.grid_y));
      const maxRow = Math.max(...connectedLanes.map(l => l.grid_y + l.grid_height - 1));
      const laneNames = connectedLanes.map(l => {
        const act = activities.find(a => a.id === l.activity_id);
        return act?.name || 'Unknown';
      }).join(', ');

      const pointsGained = Math.round((bestColCount / lanes.length) * 10);

      return `💡 Quick fix: Draw one forklift path running up-down from ${gridLabel(minRow, bestCol)} to ${gridLabel(maxRow, bestCol)}. This single corridor would connect ${laneNames}, improving your score by approximately ${pointsGained} points.`;
    }

    if (bestRowCount >= 2) {
      const connectedLanes = lanes.filter(l => l.grid_y === bestRow);
      const minCol = Math.min(...connectedLanes.map(l => l.grid_x));
      const maxCol = Math.max(...connectedLanes.map(l => l.grid_x + l.grid_width - 1));
      const laneNames = connectedLanes.map(l => {
        const act = activities.find(a => a.id === l.activity_id);
        return act?.name || 'Unknown';
      }).join(', ');

      const pointsGained = Math.round((bestRowCount / lanes.length) * 10);

      return `💡 Quick fix: Draw one forklift path running left-right from ${gridLabel(bestRow, minCol)} to ${gridLabel(bestRow, maxCol)}. This single corridor would connect ${laneNames}, improving your score by approximately ${pointsGained} points.`;
    }

    return null;
  };

  const calculateBufferCapacity = (): ScoreFactor => {
    const stagingLanes = zones.filter(z => {
      const act = activities.find(a => a.id === z.activity_id);
      return act?.type === 'staging-lane';
    });

    if (stagingLanes.length === 0) {
      return {
        name: 'buffer_capacity',
        label: 'Can you handle your busiest day?',
        score: 15,
        maxScore: 15,
        display: 'No staging lanes to evaluate',
        suggestion: '',
        details: [],
      };
    }

    const ASSUMED_DENSITY = 250;
    const details: string[] = [];
    let totalCapacityRatio = 0;

    stagingLanes.forEach(lane => {
      const vt = volumeTiming.find(v => v.activity_id === lane.activity_id);
      const act = activities.find(a => a.id === lane.activity_id);

      if (!vt) return;

      const zoneSqFt = lane.grid_width * lane.grid_height * settings.squareSize * settings.squareSize;
      const zoneCapacityLbs = zoneSqFt * (ASSUMED_DENSITY / (settings.squareSize * settings.squareSize));

      const typicalVolume = vt.typical_volume_per_shift || 0;
      const peakVolume = vt.peak_volume_per_shift || typicalVolume * 1.3;

      if (peakVolume > zoneCapacityLbs * 0.8) {
        const shortage = Math.round(peakVolume - zoneCapacityLbs);
        const extraSquares = Math.ceil(shortage / (ASSUMED_DENSITY));

        const currentSize = `${lane.grid_width}×${lane.grid_height}`;
        const extraRows = Math.ceil(extraSquares / lane.grid_width);
        const newHeight = lane.grid_height + extraRows;
        const suggestedSize = `${lane.grid_width}×${newHeight}`;

        details.push(`⚠ ${act?.name} (${gridLabel(lane.grid_y, lane.grid_x)}, size ${currentSize}): peak volume ${Math.round(peakVolume).toLocaleString()} lbs, current zone fits ~${Math.round(zoneCapacityLbs).toLocaleString()} lbs — expand to ${suggestedSize} (add ${extraSquares} more squares)`);
        totalCapacityRatio += (zoneCapacityLbs / peakVolume);
      } else {
        details.push(`✓ ${act?.name}: peak volume ${Math.round(peakVolume).toLocaleString()} lbs, zone fits ~${Math.round(zoneCapacityLbs).toLocaleString()} lbs — adequate buffer`);
        totalCapacityRatio += 1;
      }
    });

    const avgCapacityRatio = totalCapacityRatio / stagingLanes.length;
    const score = Math.round(Math.min(15, avgCapacityRatio * 15));

    const warnings = details.filter(d => d.includes('⚠'));
    const suggestion = warnings.length > 0 ? warnings[0].replace('⚠ ', '') : '';

    return {
      name: 'buffer_capacity',
      label: 'Can you handle your busiest day?',
      score,
      maxScore: 15,
      display: warnings.length > 0 ? `${warnings.length} lane(s) may not handle peak volume` : 'All lanes have adequate buffer capacity',
      suggestion,
      details,
    };
  };


  useEffect(() => {
    const newFactors = [
      calculateFlowDistance(),
      calculateClosenessCompliance(),
      calculateDeparturePriority(),
      calculateSpaceUtilization(),
      calculatePathClearance(),
      calculateBufferCapacity(),
    ];

    const newTotal = newFactors.reduce((sum, f) => sum + f.score, 0);
    const newBestScore = Math.max(score.bestScore, newTotal);

    const prevFactors = score.factors;
    newFactors.forEach(newFactor => {
      const prevFactor = prevFactors.find(f => f.name === newFactor.name);
      if (prevFactor && prevFactor.score !== newFactor.score) {
        newFactor.changed = newFactor.score - prevFactor.score;
        setFlashingFactor(newFactor.name);
        setTimeout(() => setFlashingFactor(null), 1000);
      }
    });

    setScore({
      total: newTotal,
      factors: newFactors,
      bestScore: newBestScore,
    });
  }, [zones, activities, activityRelationships, volumeTiming, doors, corridors]);

  const getScoreColor = (total: number): string => {
    if (total >= 80) return 'bg-green-100 border-green-500 text-green-900';
    if (total >= 60) return 'bg-yellow-100 border-yellow-500 text-yellow-900';
    return 'bg-red-100 border-red-500 text-red-900';
  };

  const getVerdict = (total: number): string => {
    if (total >= 90) return 'Excellent — this layout is well optimized';
    if (total >= 80) return 'Good — minor improvements possible';
    if (total >= 60) return 'Fair — review the suggestions below';
    return 'Needs work — several issues to address';
  };

  const hasDoorPurposes = doors.some(d =>
    (d.inbound_percentage && d.inbound_percentage > 0 && d.inbound_percentage < 100) ||
    (d.outbound_percentage && d.outbound_percentage > 0 && d.outbound_percentage < 100)
  );

  return (
    <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="p-4 space-y-4">
        <div className="sticky top-0 bg-white pb-2 border-b border-gray-200 z-10">
          <h2 className="text-xl font-bold text-gray-900">Layout Score</h2>
        </div>

        <div className={`p-4 rounded-lg border-2 ${getScoreColor(score.total)}`}>
          <div className="text-4xl font-bold text-center mb-2">
            {score.total} / 100
          </div>
          <div className="text-sm text-center font-medium">
            {getVerdict(score.total)}
          </div>
        </div>

        {doors.length > 0 && !hasDoorPurposes && (
          <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
            <div className="text-sm font-semibold text-orange-900 mb-1">⚠️ Door purposes not set</div>
            <div className="text-xs text-orange-800">
              Go to Step 2A and mark which doors are for receiving (inbound) and which are for loading (outbound). Scoring accuracy depends on this.
            </div>
          </div>
        )}

        <div className="space-y-3">
          {score.factors.map(factor => (
            <div
              key={factor.name}
              className={`p-3 rounded-lg border transition-all ${
                flashingFactor === factor.name
                  ? 'border-blue-500 bg-blue-50 shadow-lg'
                  : 'border-gray-300 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="font-semibold text-gray-900 text-sm">
                  {factor.label}
                </div>
                <div className="flex items-center gap-1 text-sm font-bold">
                  <span>{factor.score}/{factor.maxScore}</span>
                  {factor.changed !== undefined && factor.changed !== 0 && (
                    <span className={factor.changed > 0 ? 'text-green-600' : 'text-red-600'}>
                      {factor.changed > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      {Math.abs(factor.changed)}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-700 mb-2">
                {factor.display}
              </div>

              {factor.details && factor.details.length > 0 && (
                <details className="text-xs bg-white p-2 rounded border border-gray-200 mb-2">
                  <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                    View details ({factor.details.length} items)
                  </summary>
                  <div className="mt-2 space-y-1 text-gray-600 pl-2">
                    {factor.details.map((detail, idx) => (
                      <div key={idx} className={detail.includes('⚠') ? 'text-orange-700 font-medium' : ''}>
                        {detail}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {factor.suggestion && (
                <div className="text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-200">
                  💡 {factor.suggestion}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-200 text-xs text-gray-600 text-center">
          <div>Best score this session: <span className="font-bold text-gray-900">{score.bestScore}</span></div>
          <div>Current: <span className="font-bold text-gray-900">{score.total}</span></div>
        </div>
      </div>
    </div>
  );
}
