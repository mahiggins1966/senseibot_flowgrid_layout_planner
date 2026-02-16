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

  svg += '</svg>';
  return svg;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
