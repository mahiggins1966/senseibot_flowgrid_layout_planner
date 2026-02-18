import { Corridor, Door } from '../types';

/**
 * Corridor-based flow routing utility.
 * 
 * Builds a graph from forklift corridors and finds shortest paths
 * between doors and zone centroids for material flow visualization.
 */

// Grid coordinate key for node deduplication
function nodeKey(x: number, y: number): string {
  return `${x},${y}`;
}

interface GraphNode {
  x: number;  // grid col
  y: number;  // grid row
  key: string;
}

interface GraphEdge {
  from: string;  // node key
  to: string;    // node key
  weight: number; // Manhattan distance (grid squares)
}

interface CorridorGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  adjacency: Map<string, Array<{ neighbor: string; weight: number }>>;
}

/**
 * Build a routable graph from forklift corridors.
 * Nodes are placed at every corridor waypoint.
 * Edges connect consecutive waypoints within each corridor.
 * Corridors that share a waypoint position are automatically connected.
 */
export function buildCorridorGraph(corridors: Corridor[]): CorridorGraph {
  const forkliftCorridors = corridors.filter(c => c.type === 'forklift');
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, Array<{ neighbor: string; weight: number }>>();

  for (const corridor of forkliftCorridors) {
    const pts = corridor.points && corridor.points.length >= 2
      ? corridor.points
      : [{ x: corridor.start_grid_x, y: corridor.start_grid_y }, { x: corridor.end_grid_x, y: corridor.end_grid_y }];

    // Add all waypoints as nodes
    for (const pt of pts) {
      const key = nodeKey(pt.x, pt.y);
      if (!nodes.has(key)) {
        nodes.set(key, { x: pt.x, y: pt.y, key });
      }
    }

    // Add edges between consecutive waypoints
    for (let i = 0; i < pts.length - 1; i++) {
      const fromKey = nodeKey(pts[i].x, pts[i].y);
      const toKey = nodeKey(pts[i + 1].x, pts[i + 1].y);
      const dx = Math.abs(pts[i + 1].x - pts[i].x);
      const dy = Math.abs(pts[i + 1].y - pts[i].y);
      const weight = dx + dy; // Manhattan distance

      // Bidirectional edges
      edges.push({ from: fromKey, to: toKey, weight });
      edges.push({ from: toKey, to: fromKey, weight });
    }
  }

  // Build adjacency list
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push({ neighbor: edge.to, weight: edge.weight });
  }

  return { nodes, edges, adjacency };
}

/**
 * Find the nearest graph node to a given grid position.
 * Returns the node key and distance, or null if graph is empty.
 */
export function findNearestNode(
  graph: CorridorGraph,
  gridX: number,
  gridY: number,
): { key: string; node: GraphNode; distance: number } | null {
  let best: { key: string; node: GraphNode; distance: number } | null = null;

  for (const [key, node] of graph.nodes) {
    const dist = Math.abs(node.x - gridX) + Math.abs(node.y - gridY);
    if (!best || dist < best.distance) {
      best = { key, node, distance: dist };
    }
  }

  return best;
}

/**
 * Find the nearest point on any corridor edge to a given grid position.
 * This snaps to the closest point along a corridor segment, not just waypoints.
 * Returns the snapped grid position and the two adjacent node keys.
 */
export function snapToCorridorEdge(
  graph: CorridorGraph,
  corridors: Corridor[],
  gridX: number,
  gridY: number,
): { x: number; y: number; nearestNodeKey: string } | null {
  const forkliftCorridors = corridors.filter(c => c.type === 'forklift');
  let bestDist = Infinity;
  let bestResult: { x: number; y: number; nearestNodeKey: string } | null = null;

  for (const corridor of forkliftCorridors) {
    const pts = corridor.points && corridor.points.length >= 2
      ? corridor.points
      : [{ x: corridor.start_grid_x, y: corridor.start_grid_y }, { x: corridor.end_grid_x, y: corridor.end_grid_y }];

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const isH = p1.y === p2.y;

      // Project point onto this segment
      let snapX: number, snapY: number;
      if (isH) {
        snapX = Math.max(Math.min(p1.x, p2.x), Math.min(gridX, Math.max(p1.x, p2.x)));
        snapY = p1.y;
      } else {
        snapX = p1.x;
        snapY = Math.max(Math.min(p1.y, p2.y), Math.min(gridY, Math.max(p1.y, p2.y)));
      }

      const dist = Math.abs(snapX - gridX) + Math.abs(snapY - gridY);
      if (dist < bestDist) {
        bestDist = dist;
        // Pick the closer endpoint as the nearest node
        const d1 = Math.abs(p1.x - snapX) + Math.abs(p1.y - snapY);
        const d2 = Math.abs(p2.x - snapX) + Math.abs(p2.y - snapY);
        bestResult = {
          x: snapX,
          y: snapY,
          nearestNodeKey: d1 <= d2 ? nodeKey(p1.x, p1.y) : nodeKey(p2.x, p2.y),
        };
      }
    }
  }

  return bestResult;
}

/**
 * Dijkstra shortest path between two node keys.
 * Returns array of grid positions forming the path, or null if no path.
 */
export function findPath(
  graph: CorridorGraph,
  fromKey: string,
  toKey: string,
): Array<{ x: number; y: number }> | null {
  if (!graph.nodes.has(fromKey) || !graph.nodes.has(toKey)) return null;
  if (fromKey === toKey) {
    const node = graph.nodes.get(fromKey)!;
    return [{ x: node.x, y: node.y }];
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  // Simple priority queue using sorted array
  const queue: Array<{ key: string; dist: number }> = [];

  dist.set(fromKey, 0);
  prev.set(fromKey, null);
  queue.push({ key: fromKey, dist: 0 });

  while (queue.length > 0) {
    // Extract minimum
    queue.sort((a, b) => a.dist - b.dist);
    const current = queue.shift()!;

    if (visited.has(current.key)) continue;
    visited.add(current.key);

    if (current.key === toKey) break;

    const neighbors = graph.adjacency.get(current.key) || [];
    for (const { neighbor, weight } of neighbors) {
      if (visited.has(neighbor)) continue;

      const newDist = current.dist + weight;
      if (!dist.has(neighbor) || newDist < dist.get(neighbor)!) {
        dist.set(neighbor, newDist);
        prev.set(neighbor, current.key);
        queue.push({ key: neighbor, dist: newDist });
      }
    }
  }

  // Reconstruct path
  if (!prev.has(toKey)) return null;

  const path: Array<{ x: number; y: number }> = [];
  let current: string | null = toKey;
  while (current !== null) {
    const node = graph.nodes.get(current);
    if (node) path.unshift({ x: node.x, y: node.y });
    current = prev.get(current) ?? null;
  }

  return path.length >= 1 ? path : null;
}

/**
 * Route a flow leg between two pixel positions through the corridor network.
 * Returns an array of SVG pixel positions forming a polyline path,
 * or null if no corridor route exists (caller should fall back to direct arrow).
 * 
 * @param fromGridX Source grid column
 * @param fromGridY Source grid row  
 * @param toGridX Destination grid column
 * @param toGridY Destination grid row
 * @param corridors All corridors
 * @param cellSize Grid cell pixel size
 * @param margin Grid margin pixels
 */
export function routeFlowLeg(
  fromGridX: number,
  fromGridY: number,
  toGridX: number,
  toGridY: number,
  corridors: Corridor[],
  cellSize: number,
  margin: number,
): Array<{ x: number; y: number }> | null {
  const graph = buildCorridorGraph(corridors);
  if (graph.nodes.size === 0) return null;

  // Snap source and destination to nearest corridor nodes
  const snapFrom = findNearestNode(graph, fromGridX, fromGridY);
  const snapTo = findNearestNode(graph, toGridX, toGridY);

  if (!snapFrom || !snapTo) return null;

  // Don't route through corridors if snap distance is too far (> 15 squares)
  if (snapFrom.distance > 15 || snapTo.distance > 15) return null;

  // Find path through corridor graph
  const gridPath = findPath(graph, snapFrom.key, snapTo.key);
  if (!gridPath) return null;

  // Convert grid path to pixel coordinates (center of grid squares)
  const pixelPath: Array<{ x: number; y: number }> = [];

  // Start from actual source position (pixel)
  pixelPath.push({
    x: margin + fromGridX * cellSize + cellSize / 2,
    y: margin + fromGridY * cellSize + cellSize / 2,
  });

  // Add corridor waypoints
  for (const pt of gridPath) {
    pixelPath.push({
      x: margin + pt.x * cellSize + cellSize / 2,
      y: margin + pt.y * cellSize + cellSize / 2,
    });
  }

  // End at actual destination position (pixel)
  pixelPath.push({
    x: margin + toGridX * cellSize + cellSize / 2,
    y: margin + toGridY * cellSize + cellSize / 2,
  });

  return pixelPath;
}

/**
 * Get door center position in grid coordinates.
 */
export function getDoorGridCenter(door: Door): { x: number; y: number } {
  if (door.edge === 'top' || door.edge === 'bottom') {
    return {
      x: door.grid_x + Math.floor(door.width / 2),
      y: door.grid_y,
    };
  } else {
    return {
      x: door.grid_x,
      y: door.grid_y + Math.floor(door.width / 2),
    };
  }
}

/**
 * Build a polyline SVG path string from an array of pixel points.
 * Uses straight line segments (the corridor route).
 */
export function buildPolylinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

/**
 * Build a Bézier curve path string between two points (fallback when no corridor route).
 */
export function buildBezierPath(
  fromX: number, fromY: number,
  toX: number, toY: number,
): string {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(dist * 0.25, 40);
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);
  const mx = (fromX + toX) / 2 + nx * curvature;
  const my = (fromY + toY) / 2 + ny * curvature;
  return `M ${fromX} ${fromY} Q ${mx} ${my} ${toX} ${toY}`;
}
