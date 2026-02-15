import { GridCoordinate } from '../types';

export function getRowLabel(rowIndex: number): string {
  let label = '';
  let num = rowIndex;

  while (num >= 0) {
    label = String.fromCharCode(65 + (num % 26)) + label;
    num = Math.floor(num / 26) - 1;
  }

  return label;
}

export function getColumnLabel(colIndex: number): string {
  return (colIndex + 1).toString();
}

export function getGridCoordinate(row: number, col: number): GridCoordinate {
  return {
    row,
    col,
    label: `${getRowLabel(row)}${getColumnLabel(col)}`,
  };
}

export function screenToSVG(
  screenX: number,
  screenY: number,
  svg: SVGSVGElement
): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = screenX;
  pt.y = screenY;
  const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
  return { x: svgPt.x, y: svgPt.y };
}

export function getTouchCenter(touches: TouchList): { x: number; y: number } {
  if (touches.length === 1) {
    return { x: touches[0].clientX, y: touches[0].clientY };
  }

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < touches.length; i++) {
    sumX += touches[i].clientX;
    sumY += touches[i].clientY;
  }

  return {
    x: sumX / touches.length,
    y: sumY / touches.length,
  };
}

export function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;

  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;

  return Math.sqrt(dx * dx + dy * dy);
}
