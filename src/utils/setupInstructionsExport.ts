import { Activity, Corridor, Door, Zone } from '../types';
import { getGridCoordinate } from './coordinates';

interface SetupData {
  zones: Zone[];
  activities: Activity[];
  corridors: Corridor[];
  doors: Door[];
  facilityWidth: number;
  facilityHeight: number;
  squareSize: number;
}

/**
 * Clones the grid SVG and prepares it for print embedding.
 * Resets the viewport transform so the full grid is visible,
 * strips interactive attributes, and returns clean SVG markup.
 */
function getCleanSvgMarkup(): string {
  const svg = document.querySelector('svg');
  if (!svg) return '';

  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Reset the viewport transform group to show the full grid
  const transformGroup = clone.querySelector('g');
  if (transformGroup) {
    transformGroup.setAttribute('transform', 'translate(0, 0) scale(1)');
    transformGroup.removeAttribute('style');
  }

  // Set explicit dimensions for the print context
  const viewBox = clone.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/\s+/);
    if (parts.length === 4) {
      clone.setAttribute('width', parts[2]);
      clone.setAttribute('height', parts[3]);
    }
  }

  // Strip all class attributes (Tailwind classes won't resolve in print)
  clone.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));
  clone.removeAttribute('class');
  clone.style.cssText = '';
  clone.removeAttribute('style');

  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

export function exportSetupInstructions(data: SetupData) {
  const svgMarkup = getCleanSvgMarkup();

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export setup instructions.');
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const sqft = data.facilityWidth * data.facilityHeight;
  const sq = data.squareSize;

  // Build placed zones sorted by type then by position (top-left first)
  const placedZones = data.zones
    .filter(z => z.activity_id)
    .map(z => {
      const activity = data.activities.find(a => a.id === z.activity_id);
      const startCoord = getGridCoordinate(z.grid_y, z.grid_x);
      const endCoord = getGridCoordinate(z.grid_y + z.grid_height - 1, z.grid_x + z.grid_width - 1);
      const xFt = z.grid_x * sq;
      const yFt = z.grid_y * sq;
      const widthFt = z.grid_width * sq;
      const heightFt = z.grid_height * sq;
      const areaSqFt = widthFt * heightFt;
      return { zone: z, activity, startCoord, endCoord, xFt, yFt, widthFt, heightFt, areaSqFt };
    })
    .sort((a, b) => {
      // Sort by type, then top-to-bottom, then left-to-right
      const typeOrder: Record<string, number> = { 'work-area': 0, 'staging-lane': 1, 'support-area': 2, 'corridor': 3 };
      const aOrder = typeOrder[a.activity?.type || ''] ?? 99;
      const bOrder = typeOrder[b.activity?.type || ''] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      if (a.zone.grid_y !== b.zone.grid_y) return a.zone.grid_y - b.zone.grid_y;
      return a.zone.grid_x - b.zone.grid_x;
    });

  // Build corridor data
  const corridorRows = data.corridors.map((c, i) => {
    const startCoord = getGridCoordinate(c.start_grid_y, c.start_grid_x);
    const endCoord = getGridCoordinate(c.end_grid_y, c.end_grid_x);
    const isHorizontal = c.start_grid_y === c.end_grid_y;
    const lengthSquares = Math.max(
      Math.abs(c.end_grid_x - c.start_grid_x),
      Math.abs(c.end_grid_y - c.start_grid_y)
    ) + 1;
    const startXFt = Math.min(c.start_grid_x, c.end_grid_x) * sq;
    const startYFt = Math.min(c.start_grid_y, c.end_grid_y) * sq;
    const lengthFt = lengthSquares * sq;
    const widthFt = c.width * sq;
    const typeLabel = c.type === 'pedestrian' ? 'Pedestrian Walkway' : 'Forklift / Cart Path';
    const tapeColor = c.type === 'pedestrian' ? 'Yellow' : 'White';
    const tapeWidth = c.type === 'forklift' ? '4"' : '2"';
    const direction = isHorizontal ? 'east (→)' : 'south (↓)';
    return { corridor: c, idx: i + 1, startCoord, endCoord, startXFt, startYFt, lengthFt, widthFt, typeLabel, tapeColor, tapeWidth, direction, isHorizontal };
  });

  // Build door list
  const doorRows = data.doors.map((d, i) => {
    const coord = getGridCoordinate(d.grid_y, d.grid_x);
    const xFt = d.grid_x * sq;
    const yFt = d.grid_y * sq;
    const widthFt = d.width * sq;
    const features: string[] = [];
    if (d.has_inbound_material) features.push('Inbound material');
    if (d.has_outbound_material) features.push('Outbound material');
    if (d.has_vehicle_access) features.push('Vehicle access');
    if (d.has_pedestrian_access) features.push('Pedestrian');
    return { door: d, idx: i + 1, coord, xFt, yFt, widthFt, features };
  });

  // Tape color guide
  const tapeGuide = [
    { color: '#FFD700', border: '#B8860B', name: 'Yellow', use: 'Pedestrian walkways, caution areas, aisle boundaries (OSHA/ANSI standard)' },
    { color: '#FFFFFF', border: '#999', name: 'White', use: 'Equipment traffic lanes, storage location borders, general markings' },
    { color: '#2563EB', border: '#1E40AF', name: 'Blue', use: 'Staging lanes, raw materials, work-in-progress areas' },
    { color: '#16A34A', border: '#15803D', name: 'Green', use: 'Work areas, finished goods, safe zones' },
    { color: '#DC2626', border: '#991B1B', name: 'Red', use: 'Fire equipment, emergency zones, restricted areas — do NOT block' },
    { color: '#F97316', border: '#C2410C', name: 'Orange', use: 'Inspection areas, items held for review' },
  ];

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'work-area': return 'Work Area';
      case 'staging-lane': return 'Staging Lane';
      case 'support-area': return 'Support Area';
      default: return type;
    }
  };

  const getTapeColorForType = (type: string) => {
    switch (type) {
      case 'work-area': return { color: 'Green', hex: '#16A34A' };
      case 'staging-lane': return { color: 'Blue', hex: '#2563EB' };
      case 'support-area': return { color: 'Blue', hex: '#2563EB' };
      default: return { color: 'White', hex: '#999' };
    }
  };

  // ──────────────────────────────────────────
  // Build step-by-step physical instructions
  // ──────────────────────────────────────────
  let globalStep = 0;

  const step = () => { globalStep++; return globalStep; };

  let stepsHtml = '';

  // Step: Establish datum
  stepsHtml += buildStepCard(step(), 'Establish Datum Point (0, 0)', [
    `Locate the <strong>top-left corner</strong> of the facility floor area. This is your reference origin — all measurements start here.`,
    `Mark this point clearly on the floor with a chalk "X" or a piece of painter's tape labeled <span class="coords">DATUM (0, 0)</span>.`,
    `This corresponds to grid position <span class="coords">A1</span> on the layout plan.`,
  ], 'tip', 'All distances in this document are measured from this datum point: east (→) is to the right, south (↓) is downward when facing the facility.');

  // Step: Snap baseline grid lines
  stepsHtml += buildStepCard(step(), 'Snap Baseline Reference Lines', [
    `From the datum, snap a chalk line running <strong>${data.facilityWidth} ft east (→)</strong> along the top wall. This is your X-axis baseline.`,
    `From the datum, snap a chalk line running <strong>${data.facilityHeight} ft south (↓)</strong> along the left wall. This is your Y-axis baseline.`,
    `Verify the corner is square: use a laser level or measure the 3-4-5 triangle method — mark 3 ft along one line, 4 ft along the other, and confirm the diagonal is exactly 5 ft.`,
    `<em>Optional:</em> Snap intermediate chalk lines every ${sq * 5} ft (every 5 grid squares) to create a reference grid for faster zone layout.`,
  ]);

  // Step: Verify doors
  if (doorRows.length > 0) {
    const doorSteps = [
      `Verify each door/opening is clear, accessible, and matches the positions below before marking zones:`,
    ];
    doorRows.forEach(d => {
      doorSteps.push(
        `<strong>Door ${d.idx}</strong> — ${d.door.wall} wall at <span class="coords">${d.coord.label}</span>: ` +
        `${d.xFt} ft east, ${d.yFt} ft south from datum. Opening width: ${d.widthFt} ft. ` +
        `Access: ${d.features.length > 0 ? d.features.join(', ') : 'General'}. ` +
        `Mark a <strong>36" keep-clear zone</strong> in front of this door with red tape.`
      );
    });
    stepsHtml += buildStepCard(step(), `Verify Doors & Mark Keep-Clear Zones (${doorRows.length} door${doorRows.length !== 1 ? 's' : ''})`, doorSteps);
  }

  // Steps: Mark each zone — one step card per zone
  placedZones.forEach((z, i) => {
    const name = z.activity?.name || 'Unknown Zone';
    const type = getTypeLabel(z.activity?.type || '');
    const tc = getTapeColorForType(z.activity?.type || '');

    const substeps = [
      `<strong>Locate the starting corner:</strong> From the datum (0, 0), measure <strong>${z.xFt} ft east (→)</strong> and <strong>${z.yFt} ft south (↓)</strong>. Mark this point — it is the <strong>top-left corner</strong> of the zone at grid position <span class="coords">${z.startCoord.label}</span>.`,
      `<strong>Mark the width:</strong> From that corner, measure <strong>${z.widthFt} ft east (→)</strong>. Mark the endpoint and snap a chalk line between the two points. This is the <strong>top edge</strong> of the zone.`,
      `<strong>Mark the height:</strong> Return to the starting corner. Measure <strong>${z.heightFt} ft south (↓)</strong>. Mark the endpoint and snap a chalk line. This is the <strong>left edge</strong> of the zone.`,
      `<strong>Complete the rectangle:</strong> From the end of the top edge, measure ${z.heightFt} ft south (↓). From the end of the left edge, measure ${z.widthFt} ft east (→). These two points should meet at <span class="coords">${z.endCoord.label}</span> — the bottom-right corner. Snap chalk lines for the right and bottom edges.`,
      `<strong>Verify square:</strong> Check that both diagonals of the rectangle are equal length. If they differ by more than 1", adjust the corners.`,
      `<strong>Apply tape:</strong> Clean the floor along all four chalk lines (wipe with alcohol if greasy). Apply <strong>${tc.color} 2" floor marking tape</strong> on all four sides, pressing firmly.`,
      `<strong>Label:</strong> Write <strong>"${name}"</strong> on the tape at the zone entrance, or post a laminated sign.`,
      `<strong>Photograph</strong> the completed zone before moving on.`,
    ];

    stepsHtml += buildStepCard(
      step(),
      `Mark Zone: "${name}" — ${type} (${z.widthFt} ft × ${z.heightFt} ft)`,
      substeps,
      'zone-summary',
      `Grid: ${z.startCoord.label} → ${z.endCoord.label} &nbsp;|&nbsp; Position: ${z.xFt} ft east, ${z.yFt} ft south &nbsp;|&nbsp; Area: ${z.areaSqFt.toLocaleString()} sq ft &nbsp;|&nbsp; Tape: ${tc.color} 2"`
    );
  });

  // Steps: Mark each corridor
  corridorRows.forEach(c => {
    const substeps = [
      `<strong>Locate the starting point:</strong> From the datum (0, 0), measure <strong>${c.startXFt} ft east (→)</strong> and <strong>${c.startYFt} ft south (↓)</strong>. Mark this point at grid position <span class="coords">${c.startCoord.label}</span>.`,
      `<strong>Mark the first edge:</strong> From that point, run a chalk line <strong>${c.lengthFt} ft ${c.direction}</strong> to the corridor end at <span class="coords">${c.endCoord.label}</span>.`,
      `<strong>Mark the second edge:</strong> Offset <strong>${c.widthFt} ft</strong> ${c.isHorizontal ? 'south (↓)' : 'east (→)'} from the first edge and run a parallel chalk line the same length. These two lines define both edges of the corridor.`,
      `<strong>Apply tape:</strong> Apply <strong>${c.tapeColor} ${c.tapeWidth} floor marking tape</strong> along <strong>both</strong> edges. Do NOT tape just the centerline — both edges must be marked.`,
      `At intersections with other corridors, stop the tape 2" short and leave a visible gap.`,
      `If this is a one-way path, add a directional arrow at the entry point using floor tape or a floor sign.`,
    ];

    stepsHtml += buildStepCard(
      step(),
      `Mark Corridor: ${c.typeLabel} (${c.lengthFt} ft long × ${c.widthFt} ft wide)`,
      substeps,
      'zone-summary',
      `Grid: ${c.startCoord.label} → ${c.endCoord.label} &nbsp;|&nbsp; Tape: ${c.tapeColor} ${c.tapeWidth} on both edges`
    );
  });

  // Step: Post color chart
  stepsHtml += buildStepCard(step(), 'Post Floor Marking Color Chart', [
    `Print and laminate the color guide from Section 4 of this document.`,
    `Post it at a central, highly visible location — near the main entrance or time clock.`,
    `All personnel should be able to identify zone types by tape color at a glance.`,
  ]);

  // Step: Final walkthrough
  stepsHtml += buildStepCard(step(), 'Final Walkthrough & Verification', [
    `A <strong>second person (verifier)</strong> who was not part of the marking crew must walk the entire floor.`,
    `Cross-check every zone against the reference diagram — verify position, size, label, and tape color.`,
    `Verify all ${corridorRows.length} corridor(s) are marked on <strong>both</strong> edges with correct tape color and width.`,
    `Verify all ${doorRows.length} door(s) have 36" clear zones — nothing blocking.`,
    `Check tape adhesion — no lifting corners, bubbles, or wrinkles. Press down any problem areas.`,
    `Verify all corners are square (laser level or diagonal measurement).`,
    `Confirm pedestrian walkways are minimum <strong>5 ft</strong> clear width.`,
    `Confirm forklift/cart paths are minimum <strong>10 ft</strong> clear width.`,
    `No equipment, materials, or debris left in marked corridors.`,
    `Take <strong>"after" photographs</strong> from the same angles as the "before" photos.`,
    `Compare layout to the reference diagram below — it must match.`,
  ]);

  // Section number tracker
  let sectionNum = 0;
  const sec = () => { sectionNum++; return sectionNum; };

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Layout Setup Instructions</title>
  <style>
    @page { size: portrait; margin: 0.6in; }
    @media print {
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .keep-together { page-break-inside: avoid; }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.6; font-size: 13px; }

    .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1f2937; color: white; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 100; }
    .print-bar button { padding: 8px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .print-bar button:hover { background: #2563eb; }
    .spacer { height: 52px; }

    /* Cover */
    .cover { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 90vh; text-align: center; }
    .cover h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
    .cover .subtitle { font-size: 16px; color: #6b7280; margin-bottom: 40px; }
    .cover-meta { font-size: 14px; color: #4b5563; line-height: 2; }
    .cover-meta strong { font-weight: 600; }
    .cover-footer { margin-top: 60px; font-size: 12px; color: #9ca3af; }

    /* Section styling */
    .section { margin-bottom: 28px; }
    .section-num { display: inline-block; width: 28px; height: 28px; background: #1f2937; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; font-size: 14px; margin-right: 8px; flex-shrink: 0; }
    .section-title { display: flex; align-items: center; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
    .section-title h2 { font-size: 18px; font-weight: 700; }

    /* Safety box */
    .safety-box { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .safety-box h3 { color: #dc2626; font-size: 15px; margin-bottom: 8px; }
    .safety-box ul { margin-left: 20px; }
    .safety-box li { margin-bottom: 4px; }

    /* Checklist */
    .checklist { list-style: none; margin: 0; padding: 0; }
    .checklist li { padding: 6px 0 6px 28px; position: relative; border-bottom: 1px solid #f3f4f6; }
    .checklist li::before { content: '☐'; position: absolute; left: 4px; top: 6px; font-size: 16px; color: #6b7280; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
    th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7280; border-bottom: 2px solid #d1d5db; }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }

    /* Color swatch */
    .swatch { display: inline-block; width: 16px; height: 16px; border-radius: 3px; vertical-align: middle; margin-right: 6px; border: 1px solid #d1d5db; }

    /* Step cards */
    .step-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 14px; overflow: hidden; page-break-inside: avoid; }
    .step-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    .step-number { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: #1f2937; color: white; border-radius: 50%; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .step-title { font-size: 14px; font-weight: 700; color: #1f2937; }
    .step-body { padding: 12px 16px; }
    .step-body ol { margin: 0; padding-left: 20px; }
    .step-body ol li { margin-bottom: 8px; line-height: 1.6; }
    .step-summary { font-size: 11px; color: #6b7280; padding: 8px 16px; background: #f3f4f6; border-top: 1px solid #e5e7eb; font-family: 'SF Mono', 'Fira Code', monospace; }

    .coords { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; background: #e5e7eb; padding: 1px 5px; border-radius: 3px; white-space: nowrap; }

    /* Reference diagram */
    .diagram-container { text-align: center; margin: 12px 0; }
    .diagram-container svg { max-width: 100%; max-height: 50vh; height: auto; display: block; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 4px; background: white; }

    /* Sign-off */
    .signoff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px; }
    .signoff-line { border-bottom: 1px solid #1f2937; height: 40px; margin-bottom: 4px; }
    .signoff-label { font-size: 11px; color: #6b7280; }

    /* Tip box */
    .tip { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 14px; margin: 10px 0; border-radius: 0 6px 6px 0; font-size: 12px; }
    .tip strong { color: #1e40af; }

    .page-footer { font-size: 10px; color: #9ca3af; text-align: center; margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="no-print print-bar">
    <span>Setup Instructions — Ready to print or save as PDF</span>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="no-print spacer"></div>

  <!-- ═══════════════ COVER PAGE ═══════════════ -->
  <div class="cover">
    <h1>Floor Layout Setup Instructions</h1>
    <div class="subtitle">Work Instruction — Physical Floor Marking & Zone Setup</div>
    <div class="cover-meta">
      <div><strong>Facility:</strong> Kamaka Air</div>
      <div><strong>Floor Area:</strong> ${data.facilityWidth} ft × ${data.facilityHeight} ft (${sqft.toLocaleString()} sq ft)</div>
      <div><strong>Grid Scale:</strong> 1 square = ${sq} ft × ${sq} ft</div>
      <div><strong>Date Prepared:</strong> ${dateStr}</div>
      <div><strong>Total Steps:</strong> ${globalStep}</div>
      <div><strong>Work Areas:</strong> ${placedZones.filter(z => z.activity?.type === 'work-area').length} &nbsp;|&nbsp; <strong>Staging Lanes:</strong> ${placedZones.filter(z => z.activity?.type === 'staging-lane').length} &nbsp;|&nbsp; <strong>Corridors:</strong> ${corridorRows.length} &nbsp;|&nbsp; <strong>Doors:</strong> ${doorRows.length}</div>
    </div>
    <div class="cover-footer">Generated by FlowGrid Layout Planner · This is the controlled reference for floor layout execution</div>
  </div>

  <!-- ═══════════════ SAFETY & PPE ═══════════════ -->
  <div class="page-break"></div>
  <div class="safety-box">
    <h3>⚠ SAFETY & PPE REQUIREMENTS — READ BEFORE STARTING</h3>
    <p style="margin-bottom:8px;">All personnel involved in the layout must comply with the following:</p>
    <ul>
      <li><strong>Steel-toe safety boots</strong> — required at all times on the floor</li>
      <li><strong>High-visibility vest</strong> — required if any vehicle traffic is active during setup</li>
      <li><strong>Safety glasses</strong> — required when cutting tape, drilling, or using power tools</li>
      <li><strong>Gloves</strong> — recommended for moving heavy equipment and furniture</li>
      <li><strong>Hearing protection</strong> — required if using power tools in enclosed spaces</li>
    </ul>
    <div class="tip" style="margin-top:12px;">
      <strong>Before you start:</strong> Ensure the area is clear of active operations. Post signage at all entrances: "FLOOR LAYOUT IN PROGRESS — AUTHORIZED PERSONNEL ONLY." Lock out / tag out any equipment being moved.
    </div>
  </div>

  <!-- ═══════════════ SECTION 1: TOOLS ═══════════════ -->
  <div class="section">
    <div class="section-title">
      <span class="section-num">${sec()}</span>
      <h2>Tools & Materials Required</h2>
    </div>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td>Tape measure (100 ft / 30 m)</td><td>2</td><td>Measuring zone boundaries and distances from datum</td></tr>
        <tr><td>Chalk line reel</td><td>2</td><td>Snapping straight reference lines on floor</td></tr>
        <tr><td>Chalk (blue or red)</td><td>4 refills</td><td>Blue for temporary lines, red for permanent</td></tr>
        <tr><td>Laser level (cross-line)</td><td>1</td><td>Establishing perpendicular lines and verifying square corners</td></tr>
        <tr><td>Floor marking tape — Yellow 2"</td><td>${Math.max(2, corridorRows.filter(c => c.corridor.type === 'pedestrian').length)} rolls</td><td>Pedestrian walkway boundaries (OSHA standard)</td></tr>
        <tr><td>Floor marking tape — White 4"</td><td>${Math.max(1, corridorRows.filter(c => c.corridor.type === 'forklift').length)} rolls</td><td>Equipment traffic lane boundaries</td></tr>
        <tr><td>Floor marking tape — Green 2"</td><td>${Math.max(1, placedZones.filter(z => z.activity?.type === 'work-area').length)} rolls</td><td>Work area zone borders</td></tr>
        <tr><td>Floor marking tape — Blue 2"</td><td>${Math.max(1, placedZones.filter(z => z.activity?.type === 'staging-lane').length)} rolls</td><td>Staging lane zone borders</td></tr>
        <tr><td>Floor marking tape — Red 2"</td><td>1 roll</td><td>Emergency / keep-clear zones around doors</td></tr>
        <tr><td>Permanent markers (black, broad)</td><td>4</td><td>Labeling zones on tape or floor</td></tr>
        <tr><td>Laminated zone ID signs</td><td>${placedZones.length}</td><td>Post at each zone</td></tr>
        <tr><td>Painter's masking tape (1")</td><td>2 rolls</td><td>Temporary reference marks during layout</td></tr>
        <tr><td>Utility knife</td><td>2</td><td>Cutting floor tape cleanly</td></tr>
        <tr><td>Broom / floor scraper</td><td>1</td><td>Cleaning floor before tape application</td></tr>
        <tr><td>Isopropyl alcohol + rags</td><td>1 gallon</td><td>Degreasing floor surface where tape will be applied</td></tr>
        <tr><td>This document (printed)</td><td>2 copies</td><td>One for layout lead, one for verifier</td></tr>
      </tbody>
    </table>
    <div class="tip">
      <strong>Why tape over paint?</strong> Adhesive floor tape is preferred per lean best practices — it applies instantly with no drying time, removes cleanly when layout changes, and can be replaced in sections. Minimum tape width per OSHA is 2".
    </div>
  </div>

  <!-- ═══════════════ SECTION 2: PRE-WORK ═══════════════ -->
  <div class="section">
    <div class="section-title">
      <span class="section-num">${sec()}</span>
      <h2>Pre-Work Checklist</h2>
    </div>
    <p style="margin-bottom:8px;">Complete each item before starting Step 1. Check off as done:</p>
    <ul class="checklist">
      <li>Photograph current floor layout from multiple angles (before photos for 5S documentation)</li>
      <li>Remove all unnecessary items, equipment, and materials from the floor (5S Sort)</li>
      <li>Sweep and clean the entire floor area — tape will not adhere to dusty or greasy surfaces</li>
      <li>Degrease any oil spots or high-traffic areas with isopropyl alcohol</li>
      <li>Remove old floor markings, tape remnants, and paint that conflict with new layout</li>
      <li>Verify all doors and openings are accessible and match the layout plan (${doorRows.length} doors)</li>
      <li>Confirm no active operations or vehicle traffic during setup window</li>
      <li>Brief the setup crew on this work instruction — everyone reads Safety section first</li>
    </ul>
  </div>

  <!-- ═══════════════ SECTION 3: REFERENCE DIAGRAM ═══════════════ -->
  <div class="page-break"></div>
  <div class="section">
    <div class="section-title">
      <span class="section-num">${sec()}</span>
      <h2>Reference Layout Diagram</h2>
    </div>
    <p style="margin-bottom:8px;">This is the target layout. All step-by-step instructions reference positions on this diagram.</p>
    ${svgMarkup
      ? `<div class="diagram-container">${svgMarkup}</div>`
      : `<div class="diagram-container" style="padding:40px; background:#f3f4f6; border-radius:8px; color:#6b7280;">Layout image not available — refer to the Floor Plan PDF export</div>`
    }
    <div class="tip">
      <strong>Coordinate system:</strong> The top-left corner of the facility is the <strong>datum point (0, 0)</strong>, which corresponds to grid position <span class="coords">A1</span>. Distances are measured in feet: <strong>east (→)</strong> from the left wall, <strong>south (↓)</strong> from the top wall. Each grid square = ${sq} ft × ${sq} ft.
    </div>
  </div>

  <!-- ═══════════════ SECTION 4: COLOR GUIDE ═══════════════ -->
  <div class="section">
    <div class="section-title">
      <span class="section-num">${sec()}</span>
      <h2>Floor Marking Color Guide (OSHA / ANSI)</h2>
    </div>
    <p style="margin-bottom:8px;">Use these colors consistently. Post a laminated copy at a central location.</p>
    <table>
      <thead><tr><th>Color</th><th>Width</th><th>Use</th></tr></thead>
      <tbody>
        ${tapeGuide.map(t => `
          <tr>
            <td><span class="swatch" style="background:${t.color}; border-color:${t.border};"></span>${t.name}</td>
            <td>${t.name === 'White' ? '4"' : '2"'}</td>
            <td>${t.use}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- ═══════════════ SECTION 5: STEP-BY-STEP ═══════════════ -->
  <div class="page-break"></div>
  <div class="section">
    <div class="section-title">
      <span class="section-num">${sec()}</span>
      <h2>Step-by-Step Layout Instructions</h2>
    </div>
    <p style="margin-bottom:14px;">Follow each step in order. Every measurement is from the <strong>datum point (0, 0)</strong> at the top-left corner of the facility. Complete each step fully before moving to the next.</p>

    ${stepsHtml}
  </div>

  <!-- ═══════════════ SECTION 6: SIGN-OFF ═══════════════ -->
  <div class="page-break"></div>
  <div class="section">
    <div class="section-title">
      <span class="section-num">${sec()}</span>
      <h2>Completion Sign-Off</h2>
    </div>
    <p style="margin-bottom:16px;">Both the layout lead and the verifier must sign below to confirm the floor layout matches this work instruction.</p>
    <div class="signoff-grid">
      <div><div class="signoff-line"></div><div class="signoff-label">Layout Lead — Print Name & Sign</div></div>
      <div><div class="signoff-line"></div><div class="signoff-label">Date</div></div>
      <div><div class="signoff-line"></div><div class="signoff-label">Verifier — Print Name & Sign</div></div>
      <div><div class="signoff-line"></div><div class="signoff-label">Date</div></div>
      <div><div class="signoff-line"></div><div class="signoff-label">Supervisor Approval — Print Name & Sign</div></div>
      <div><div class="signoff-line"></div><div class="signoff-label">Date</div></div>
    </div>
  </div>

  <div class="page-footer">
    FlowGrid Layout Planner — Setup Instructions — ${dateStr} — This is a controlled document. Verify you have the latest revision before executing.
  </div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Builds a single step card with numbered header, ordered substeps, and optional summary/tip
 */
function buildStepCard(
  stepNum: number,
  title: string,
  substeps: string[],
  footerType?: 'tip' | 'zone-summary',
  footerContent?: string
): string {
  return `
    <div class="step-card">
      <div class="step-header">
        <span class="step-number">${stepNum}</span>
        <span class="step-title">${title}</span>
      </div>
      <div class="step-body">
        <ol>
          ${substeps.map(s => `<li>${s}</li>`).join('')}
        </ol>
      </div>
      ${footerContent
        ? footerType === 'tip'
          ? `<div class="tip" style="margin:0; border-radius:0;">${footerContent}</div>`
          : `<div class="step-summary">${footerContent}</div>`
        : ''
      }
    </div>
  `;
}
