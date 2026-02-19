/**
 * Generates a lightweight SVG floor plan from layout data.
 * Used for thumbnails in reports where the full GridCanvas isn't rendered.
 */

import { Activity, Corridor, Door, Zone } from '../types';
import { getActivityColor, getActivityBorderColor, getCorridorColor, getCorridorBorderColor, OSHA_COLORS } from './oshaColors';

interface ThumbnailData {
  zones: Zone[];
  corridors: Corridor[];
  doors: Door[];
  activities: Activity[];
  paintedSquares: Map<string, { type: 'permanent' | 'semi-fixed' }>;
  gridRows: number;
  gridCols: number;
  squareSize: number;
  facilityWidth: number;
  facilityHeight: number;
  flowPaths?: Record<string, Array<{ x: number; y: number }>>;
}

const CELL = 10; // px per grid cell in thumbnail
const PAD = 4;   // padding around grid

export function generateLayoutSvg(data: ThumbnailData): string {
  const { zones, corridors, doors, activities, paintedSquares, gridRows, gridCols } = data;
  const w = gridCols * CELL + PAD * 2;
  const h = gridRows * CELL + PAD * 2;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:#fff;border:1px solid #e5e7eb;border-radius:4px;">`;

  // Grid background
  svg += `<rect x="${PAD}" y="${PAD}" width="${gridCols * CELL}" height="${gridRows * CELL}" fill="#f9fafb" stroke="#e5e7eb" stroke-width="0.5"/>`;

  // Grid lines (light)
  for (let r = 0; r <= gridRows; r++) {
    svg += `<line x1="${PAD}" y1="${PAD + r * CELL}" x2="${PAD + gridCols * CELL}" y2="${PAD + r * CELL}" stroke="#e5e7eb" stroke-width="0.3"/>`;
  }
  for (let c = 0; c <= gridCols; c++) {
    svg += `<line x1="${PAD + c * CELL}" y1="${PAD}" x2="${PAD + c * CELL}" y2="${PAD + gridRows * CELL}" stroke="#e5e7eb" stroke-width="0.3"/>`;
  }

  // Painted squares
  paintedSquares.forEach((sq, key) => {
    const [r, c] = key.split('-').map(Number);
    const fill = sq.type === 'permanent' ? OSHA_COLORS.PERMANENT_OBSTACLE : '#d1d5db';
    svg += `<rect x="${PAD + c * CELL}" y="${PAD + r * CELL}" width="${CELL}" height="${CELL}" fill="${fill}" opacity="0.7"/>`;
  });

  // Corridors
  corridors.forEach(cor => {
    const isHoriz = cor.start_grid_y === cor.end_grid_y;
    const minC = Math.min(cor.start_grid_x, cor.end_grid_x);
    const maxC = Math.max(cor.start_grid_x, cor.end_grid_x);
    const minR = Math.min(cor.start_grid_y, cor.end_grid_y);
    const maxR = Math.max(cor.start_grid_y, cor.end_grid_y);

    const x = PAD + minC * CELL;
    const y = PAD + minR * CELL;
    const cw = isHoriz ? (maxC - minC + 1) * CELL : cor.width * CELL;
    const ch = isHoriz ? cor.width * CELL : (maxR - minR + 1) * CELL;

    const fill = getCorridorColor(cor.type);
    const stroke = getCorridorBorderColor(cor.type);
    svg += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${fill}" stroke="${stroke}" stroke-width="0.5" opacity="0.6"/>`;
  });

  // Zones
  zones.filter(z => z.activity_id).forEach(zone => {
    const activity = activities.find(a => a.id === zone.activity_id);
    const fill = activity ? getActivityColor(activity.type) : '#94a3b8';
    const stroke = activity ? getActivityBorderColor(activity.type) : '#64748b';

    const x = PAD + zone.grid_x * CELL;
    const y = PAD + zone.grid_y * CELL;
    const zw = zone.grid_width * CELL;
    const zh = zone.grid_height * CELL;

    svg += `<rect x="${x}" y="${y}" width="${zw}" height="${zh}" fill="${fill}" stroke="${stroke}" stroke-width="0.8" opacity="0.75" rx="1"/>`;

    // Label (only if zone is big enough)
    if (zw > 30 && zh > 12 && activity) {
      const name = activity.name.length > 12 ? activity.name.slice(0, 11) + '…' : activity.name;
      const fontSize = Math.min(7, Math.max(4, Math.min(zw, zh) / 5));
      svg += `<text x="${x + zw / 2}" y="${y + zh / 2 + fontSize / 3}" text-anchor="middle" font-size="${fontSize}" font-family="Inter,sans-serif" font-weight="600" fill="white" opacity="0.9">${escapeXml(name)}</text>`;
    }
  });

  // Doors
  doors.forEach(door => {
    const x = PAD + door.grid_x * CELL;
    const y = PAD + door.grid_y * CELL;
    let dw: number, dh: number;

    if (door.edge === 'top' || door.edge === 'bottom') {
      dw = door.width * CELL;
      dh = CELL * 0.6;
    } else {
      dw = CELL * 0.6;
      dh = door.width * CELL;
    }

    svg += `<rect x="${x}" y="${y}" width="${dw}" height="${dh}" fill="${OSHA_COLORS.DOOR}" stroke="#78350f" stroke-width="0.5" rx="1"/>`;
  });

  // Flow paths
  if (data.flowPaths) {
    const fp = data.flowPaths;

    // Helper: convert grid points to SVG polyline
    const pointsToPolyline = (pts: Array<{ x: number; y: number }>) => {
      return pts.map(p => `${PAD + p.x * CELL + CELL / 2},${PAD + p.y * CELL + CELL / 2}`).join(' ');
    };

    // Inbound paths (blue)
    doors.filter(d => d.has_inbound_material).forEach(door => {
      const key = `${door.id}_inbound`;
      const pts = fp[key];
      if (pts && pts.length >= 2) {
        svg += `<polyline points="${pointsToPolyline(pts)}" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.8"/>`;
        // Arrowhead at last point
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const lx = PAD + last.x * CELL + CELL / 2;
        const ly = PAD + last.y * CELL + CELL / 2;
        const dx = last.x - prev.x;
        const dy = last.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len;
        const ny = dy / len;
        svg += `<polygon points="${lx},${ly} ${lx - nx * 4 - ny * 2.5},${ly - ny * 4 + nx * 2.5} ${lx - nx * 4 + ny * 2.5},${ly - ny * 4 - nx * 2.5}" fill="#3b82f6" opacity="0.8"/>`;
      }
    });

    // Outbound paths (orange)
    doors.filter(d => d.has_outbound_material).forEach(door => {
      const key = `${door.id}_outbound`;
      const pts = fp[key];
      if (pts && pts.length >= 2) {
        svg += `<polyline points="${pointsToPolyline(pts)}" fill="none" stroke="#f97316" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.8"/>`;
        // Arrowhead at last point
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const lx = PAD + last.x * CELL + CELL / 2;
        const ly = PAD + last.y * CELL + CELL / 2;
        const dx = last.x - prev.x;
        const dy = last.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len;
        const ny = dy / len;
        svg += `<polygon points="${lx},${ly} ${lx - nx * 4 - ny * 2.5},${ly - ny * 4 + nx * 2.5} ${lx - nx * 4 + ny * 2.5},${ly - ny * 4 - nx * 2.5}" fill="#f97316" opacity="0.8"/>`;
      }
    });

    // Process flow arrows (zone centroid to centroid) — dashed gray
    const sequenced = activities
      .filter(a => a.sequence_order != null && (a.sequence_order as number) > 0)
      .sort((a, b) => ((a.sequence_order as number) || 0) - ((b.sequence_order as number) || 0));

    const seqGroups = new Map<number, { cx: number; cy: number }>();
    for (const act of sequenced) {
      const actZones = zones.filter(z => z.activity_id === act.id);
      if (actZones.length === 0) continue;
      const seq = act.sequence_order as number;
      if (!seqGroups.has(seq)) {
        let cx = 0, cy = 0;
        for (const z of actZones) {
          cx += z.grid_x + z.grid_width / 2;
          cy += z.grid_y + z.grid_height / 2;
        }
        seqGroups.set(seq, { cx: cx / actZones.length, cy: cy / actZones.length });
      }
    }

    const sortedSeqs = Array.from(seqGroups.keys()).sort((a, b) => a - b);
    for (let i = 0; i < sortedSeqs.length - 1; i++) {
      const from = seqGroups.get(sortedSeqs[i])!;
      const to = seqGroups.get(sortedSeqs[i + 1])!;
      const fx = PAD + from.cx * CELL;
      const fy = PAD + from.cy * CELL;
      const tx = PAD + to.cx * CELL;
      const ty = PAD + to.cy * CELL;
      svg += `<line x1="${fx}" y1="${fy}" x2="${tx}" y2="${ty}" stroke="#64748b" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>`;
      // Small arrowhead
      const dx = tx - fx;
      const dy = ty - fy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      svg += `<polygon points="${tx},${ty} ${tx - nx * 3.5 - ny * 2},${ty - ny * 3.5 + nx * 2} ${tx - nx * 3.5 + ny * 2},${ty - ny * 3.5 - nx * 2}" fill="#64748b" opacity="0.6"/>`;
    }
  }

  svg += '</svg>';
  return svg;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
