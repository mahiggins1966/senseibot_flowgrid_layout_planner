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

export function exportSetupInstructions(data: SetupData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export setup instructions.');
    return;
  }

  // Capture the SVG for the reference diagram
  const svg = document.querySelector('svg');
  const svgHtml = svg ? (svg.cloneNode(true) as SVGSVGElement).outerHTML : '<p>Layout diagram not available</p>';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const sqft = data.facilityWidth * data.facilityHeight;

  // Build zone instructions sorted by type then name
  const placedZones = data.zones
    .filter(z => z.activity_id)
    .map(z => {
      const activity = data.activities.find(a => a.id === z.activity_id);
      const startCoord = getGridCoordinate(z.grid_y, z.grid_x);
      const endCoord = getGridCoordinate(z.grid_y + z.grid_height - 1, z.grid_x + z.grid_width - 1);
      const widthFt = z.grid_width * data.squareSize;
      const heightFt = z.grid_height * data.squareSize;
      const areaSqFt = widthFt * heightFt;
      return { zone: z, activity, startCoord, endCoord, widthFt, heightFt, areaSqFt };
    })
    .sort((a, b) => {
      const typeOrder: Record<string, number> = { 'work-area': 0, 'staging-lane': 1, 'support-area': 2, 'corridor': 3 };
      const aOrder = typeOrder[a.activity?.type || ''] ?? 99;
      const bOrder = typeOrder[b.activity?.type || ''] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.activity?.name || '').localeCompare(b.activity?.name || '');
    });

  // Build corridor instructions
  const corridorRows = data.corridors.map((c, i) => {
    const startCoord = getGridCoordinate(c.start_grid_y, c.start_grid_x);
    const endCoord = getGridCoordinate(c.end_grid_y, c.end_grid_x);
    const lengthSquares = Math.max(
      Math.abs(c.end_grid_x - c.start_grid_x),
      Math.abs(c.end_grid_y - c.start_grid_y)
    ) + 1;
    const lengthFt = lengthSquares * data.squareSize;
    const widthFt = c.width * data.squareSize;
    const typeLabel = c.type === 'pedestrian' ? 'Pedestrian Walkway' : 'Forklift / Cart Path';
    const tapeColor = c.type === 'pedestrian' ? 'Yellow' : 'White';
    const tapeWidth = c.type === 'forklift' ? '4"' : '2"';
    return { corridor: c, idx: i + 1, startCoord, endCoord, lengthFt, widthFt, typeLabel, tapeColor, tapeWidth };
  });

  // Build door list
  const doorRows = data.doors.map((d, i) => {
    const coord = getGridCoordinate(d.grid_y, d.grid_x);
    const widthFt = d.width * data.squareSize;
    const features: string[] = [];
    if (d.has_inbound_material) features.push('Inbound material');
    if (d.has_outbound_material) features.push('Outbound material');
    if (d.has_vehicle_access) features.push('Vehicle access');
    if (d.has_pedestrian_access) features.push('Pedestrian');
    return { door: d, idx: i + 1, coord, widthFt, features };
  });

  // Floor marking tape color guide
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
      case 'corridor': return 'Corridor';
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

    /* Print bar */
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
    .zone-row td:first-child { font-weight: 600; }

    /* Color swatch */
    .swatch { display: inline-block; width: 16px; height: 16px; border-radius: 3px; vertical-align: middle; margin-right: 6px; border: 1px solid #d1d5db; }

    /* Step cards */
    .step-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-bottom: 10px; }
    .step-card h4 { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
    .step-card .coords { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; background: #e5e7eb; padding: 2px 6px; border-radius: 3px; }
    .step-card ol { margin-left: 20px; margin-top: 6px; }
    .step-card li { margin-bottom: 3px; }

    /* Reference diagram */
    .diagram-container { text-align: center; margin: 12px 0; }
    .diagram-container svg { max-width: 100%; max-height: 45vh; height: auto; }

    /* Sign-off */
    .signoff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px; }
    .signoff-line { border-bottom: 1px solid #1f2937; height: 40px; margin-bottom: 4px; }
    .signoff-label { font-size: 11px; color: #6b7280; }

    /* Tip box */
    .tip { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 14px; margin: 10px 0; border-radius: 0 6px 6px 0; }
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

  <!-- COVER PAGE -->
  <div class="cover">
    <h1>Floor Layout Setup Instructions</h1>
    <div class="subtitle">Work Instruction — Physical Floor Marking & Zone Setup</div>
    <div class="cover-meta">
      <div><strong>Facility:</strong> Kamaka Air</div>
      <div><strong>Floor Area:</strong> ${data.facilityWidth} ft × ${data.facilityHeight} ft (${sqft.toLocaleString()} sq ft)</div>
      <div><strong>Grid Scale:</strong> 1 square = ${data.squareSize} ft × ${data.squareSize} ft</div>
      <div><strong>Date Prepared:</strong> ${dateStr}</div>
      <div><strong>Work Areas:</strong> ${placedZones.filter(z => z.activity?.type === 'work-area').length}</div>
      <div><strong>Staging Lanes:</strong> ${placedZones.filter(z => z.activity?.type === 'staging-lane').length}</div>
      <div><strong>Corridors:</strong> ${corridorRows.length}</div>
      <div><strong>Doors / Openings:</strong> ${doorRows.length}</div>
    </div>
    <div class="cover-footer">Generated by FlowGrid Layout Planner · Document is the controlled reference for floor layout execution</div>
  </div>

  <!-- PAGE 2: SAFETY & PPE -->
  <div class="page-break"></div>
  <div class="safety-box">
    <h3>⚠ SAFETY & PPE REQUIREMENTS</h3>
    <p style="margin-bottom:8px;">All personnel involved in the layout must comply with the following before starting work:</p>
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

  <!-- SECTION 1: TOOLS & MATERIALS -->
  <div class="section">
    <div class="section-title">
      <span class="section-num">1</span>
      <h2>Tools & Materials Required</h2>
    </div>
    <table>
      <thead>
        <tr><th>Item</th><th>Quantity</th><th>Purpose</th></tr>
      </thead>
      <tbody>
        <tr><td>Tape measure (100 ft / 30 m)</td><td>2</td><td>Measuring zone boundaries and distances</td></tr>
        <tr><td>Chalk line reel</td><td>2</td><td>Snapping straight reference lines on floor</td></tr>
        <tr><td>Chalk (blue or red)</td><td>4 refills</td><td>Chalk line refills — blue for temp lines, red for permanent</td></tr>
        <tr><td>Laser level (cross-line)</td><td>1</td><td>Establishing perpendicular reference lines and verifying square corners</td></tr>
        <tr><td>Floor marking tape (2" yellow)</td><td>${Math.max(2, corridorRows.filter(c => c.corridor.type === 'pedestrian').length)} rolls</td><td>Pedestrian walkway boundaries (OSHA standard)</td></tr>
        <tr><td>Floor marking tape (4" white)</td><td>${Math.max(1, corridorRows.filter(c => c.corridor.type === 'forklift').length)} rolls</td><td>Equipment traffic lane boundaries</td></tr>
        <tr><td>Floor marking tape (2" green)</td><td>${Math.max(1, placedZones.filter(z => z.activity?.type === 'work-area').length)} rolls</td><td>Work area zone borders</td></tr>
        <tr><td>Floor marking tape (2" blue)</td><td>${Math.max(1, placedZones.filter(z => z.activity?.type === 'staging-lane').length)} rolls</td><td>Staging lane zone borders</td></tr>
        <tr><td>Permanent markers (black, broad tip)</td><td>4</td><td>Labeling zones on tape or floor</td></tr>
        <tr><td>Laminated zone ID signs</td><td>${placedZones.length}</td><td>Post at each zone — print from this document</td></tr>
        <tr><td>Painter's masking tape (1")</td><td>2 rolls</td><td>Temporary reference marks during layout</td></tr>
        <tr><td>Utility knife</td><td>2</td><td>Cutting floor tape cleanly</td></tr>
        <tr><td>Broom / floor scraper</td><td>1</td><td>Cleaning floor surface before applying tape (tape won't stick to dirty floors)</td></tr>
        <tr><td>Isopropyl alcohol + rags</td><td>1 gallon</td><td>Degreasing floor surface where tape will be applied</td></tr>
        <tr><td>This document (printed)</td><td>2 copies</td><td>Reference during layout — one for lead, one for verifier</td></tr>
      </tbody>
    </table>
    <div class="tip">
      <strong>Pro tip:</strong> Adhesive floor tape is preferred over paint per lean best practices — it applies instantly with no drying time, removes cleanly when layout changes, and can be replaced in sections without shutting down the floor. Minimum tape width per OSHA is 2".
    </div>
  </div>

  <!-- SECTION 2: PRE-WORK CHECKLIST -->
  <div class="section">
    <div class="section-title">
      <span class="section-num">2</span>
      <h2>Pre-Work Preparation</h2>
    </div>
    <p style="margin-bottom:8px;">Complete each item before starting floor marking. Check off as done:</p>
    <ul class="checklist">
      <li>Photograph current floor layout from multiple angles (before photos for 5S documentation)</li>
      <li>Remove all unnecessary items, equipment, and materials from the floor (5S Sort)</li>
      <li>Sweep and clean the entire floor area — tape will not adhere to dusty or greasy surfaces</li>
      <li>Degrease any oil spots or high-traffic areas with isopropyl alcohol</li>
      <li>Remove old floor markings, tape remnants, and paint marks that conflict with new layout</li>
      <li>Verify all doors and openings are accessible and match the layout plan (${doorRows.length} doors)</li>
      <li>Confirm no active operations or vehicle traffic during setup window</li>
      <li>Brief the setup crew on this work instruction — everyone reads Section 1 (Safety) first</li>
      <li>Establish a datum point (reference corner) — recommended: the top-left corner of the grid (A1)</li>
      <li>Snap a chalk line from datum along the full width and full height of the facility to create the baseline grid</li>
    </ul>
  </div>

  <!-- SECTION 3: REFERENCE LAYOUT -->
  <div class="page-break"></div>
  <div class="section">
    <div class="section-title">
      <span class="section-num">3</span>
      <h2>Reference Layout Diagram</h2>
    </div>
    <p style="margin-bottom:8px;">This is the target layout. All zone positions and dimensions below reference this diagram.</p>
    <div class="diagram-container">
      ${svgHtml}
    </div>
    <div class="tip">
      <strong>Grid coordinate system:</strong> Columns are labeled A, B, C... from left to right. Rows are numbered 1, 2, 3... from top to bottom. Each square is ${data.squareSize} ft × ${data.squareSize} ft. Position "A1" is the top-left corner of the facility.
    </div>
  </div>

  <!-- SECTION 4: FLOOR MARKING COLOR GUIDE -->
  <div class="section">
    <div class="section-title">
      <span class="section-num">4</span>
      <h2>Floor Marking Color Guide (OSHA/ANSI)</h2>
    </div>
    <p style="margin-bottom:8px;">Use these colors consistently. Post a copy of this chart at a central location visible to all personnel.</p>
    <table>
      <thead>
        <tr><th>Color</th><th>Tape Width</th><th>Use</th></tr>
      </thead>
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

  <!-- SECTION 5: ZONE PLACEMENT -->
  <div class="page-break"></div>
  <div class="section">
    <div class="section-title">
      <span class="section-num">5</span>
      <h2>Zone Placement Instructions</h2>
    </div>
    <p style="margin-bottom:8px;">Mark each zone in the order listed. For each zone: measure from the datum point, snap chalk lines for the boundaries, verify with laser level, then apply floor tape.</p>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Zone Name</th>
          <th>Type</th>
          <th>Grid Position</th>
          <th>Size (ft)</th>
          <th>Area</th>
          <th>Tape Color</th>
        </tr>
      </thead>
      <tbody>
        ${placedZones.map((z, i) => {
          const tc = getTapeColorForType(z.activity?.type || '');
          return `
            <tr class="zone-row">
              <td>${i + 1}</td>
              <td>${z.activity?.name || 'Unknown'}</td>
              <td>${getTypeLabel(z.activity?.type || '')}</td>
              <td><span class="coords">${z.startCoord.label}</span> → <span class="coords">${z.endCoord.label}</span></td>
              <td>${z.widthFt} × ${z.heightFt}</td>
              <td>${z.areaSqFt.toLocaleString()} sq ft</td>
              <td><span class="swatch" style="background:${tc.hex};"></span>${tc.color} 2"</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <div class="tip" style="margin-top: 8px;">
      <strong>Marking procedure per zone:</strong><br>
      1. Measure from datum to the zone's start position<br>
      2. Snap chalk lines for all four sides<br>
      3. Verify corners are square using laser level (90° check)<br>
      4. Clean the tape path — wipe with alcohol if needed<br>
      5. Apply floor tape along chalk lines — press firmly, especially at corners<br>
      6. Label the zone with a permanent marker on the tape or post a laminated sign<br>
      7. Photograph the completed zone before moving to the next
    </div>
  </div>

  <!-- SECTION 6: CORRIDOR MARKING -->
  ${corridorRows.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-num">6</span>
      <h2>Corridor & Path Marking</h2>
    </div>
    <p style="margin-bottom:8px;">Mark corridors after zones are complete. Corridors may overlap zone boundaries — apply corridor tape on top of zone tape where they intersect.</p>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Type</th>
          <th>From → To</th>
          <th>Length</th>
          <th>Width</th>
          <th>Tape</th>
        </tr>
      </thead>
      <tbody>
        ${corridorRows.map(c => `
          <tr>
            <td>${c.idx}</td>
            <td>${c.typeLabel}</td>
            <td><span class="coords">${c.startCoord.label}</span> → <span class="coords">${c.endCoord.label}</span></td>
            <td>${c.lengthFt} ft</td>
            <td>${c.widthFt} ft</td>
            <td><span class="swatch" style="background:${c.tapeColor === 'Yellow' ? '#FFD700' : '#FFF'}; border-color:${c.tapeColor === 'Yellow' ? '#B8860B' : '#999'};"></span>${c.tapeColor} ${c.tapeWidth}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="tip">
      <strong>Corridor marking rules:</strong><br>
      • Mark both edges of the corridor — do not just mark the centerline<br>
      • Pedestrian walkways: minimum 5 ft wide (OSHA) — mark with 2" yellow tape<br>
      • Forklift / cart paths: minimum 10 ft wide — mark with 4" white tape on both edges<br>
      • At intersections, stop both corridor tapes 2" short and leave a visible gap<br>
      • Add directional arrows at corridor entry points if one-way traffic is intended
    </div>
  </div>
  ` : ''}

  <!-- SECTION 7: DOOR VERIFICATION -->
  ${doorRows.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-num">${corridorRows.length > 0 ? '7' : '6'}</span>
      <h2>Door & Opening Verification</h2>
    </div>
    <p style="margin-bottom:8px;">Verify each door/opening is clear, accessible, and matches the plan. Mark keep-clear zones around doors with red tape per OSHA.</p>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Position</th>
          <th>Width</th>
          <th>Wall</th>
          <th>Access Type</th>
        </tr>
      </thead>
      <tbody>
        ${doorRows.map(d => `
          <tr>
            <td>${d.idx}</td>
            <td><span class="coords">${d.coord.label}</span></td>
            <td>${d.widthFt} ft</td>
            <td>${d.door.wall}</td>
            <td>${d.features.length > 0 ? d.features.join(', ') : 'General'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="tip">
      <strong>Door clearance rules:</strong><br>
      • Keep a minimum 36" clear zone in front of all doors (OSHA 1910.36)<br>
      • Emergency exits: mark with red tape hatching — never place equipment or materials in this zone<br>
      • Outbound material doors: ensure forklift path connects directly to the door with no obstructions
    </div>
  </div>
  ` : ''}

  <!-- SECTION 8: QC VERIFICATION -->
  <div class="page-break"></div>
  <div class="section">
    <div class="section-title">
      <span class="section-num">${corridorRows.length > 0 && doorRows.length > 0 ? '8' : corridorRows.length > 0 || doorRows.length > 0 ? '7' : '6'}</span>
      <h2>Quality Verification Checklist</h2>
    </div>
    <p style="margin-bottom:8px;">After all zones and corridors are marked, a second person (verifier) must walk the floor and confirm each item:</p>
    <ul class="checklist">
      <li>All ${placedZones.length} zones are marked and labeled — cross-check against Section 5 table</li>
      <li>All ${corridorRows.length} corridors are marked on both edges with correct tape color and width</li>
      <li>All ${doorRows.length} doors have clear zones — nothing blocking within 36"</li>
      <li>Tape is firmly adhered — no lifting corners, bubbles, or wrinkles</li>
      <li>All corners are square (verified by laser or 3-4-5 triangle method)</li>
      <li>Zone labels are legible and posted at each zone</li>
      <li>Color coding matches Section 4 guide — no incorrect colors used</li>
      <li>Pedestrian walkways are minimum 5 ft clear width</li>
      <li>Forklift paths are minimum 10 ft clear width</li>
      <li>No equipment, materials, or debris left in marked corridors</li>
      <li>Floor marking color chart is posted at a central visible location</li>
      <li>After photos taken from same angles as before photos (5S documentation)</li>
      <li>Layout matches the reference diagram in Section 3</li>
    </ul>
  </div>

  <!-- SECTION 9: SIGN-OFF -->
  <div class="section">
    <div class="section-title">
      <span class="section-num">${corridorRows.length > 0 && doorRows.length > 0 ? '9' : corridorRows.length > 0 || doorRows.length > 0 ? '8' : '7'}</span>
      <h2>Completion Sign-Off</h2>
    </div>
    <p style="margin-bottom:16px;">Both the layout lead and the verifier must sign below to confirm the floor layout matches this work instruction.</p>

    <div class="signoff-grid">
      <div>
        <div class="signoff-line"></div>
        <div class="signoff-label">Layout Lead — Print Name & Sign</div>
      </div>
      <div>
        <div class="signoff-line"></div>
        <div class="signoff-label">Date</div>
      </div>
      <div>
        <div class="signoff-line"></div>
        <div class="signoff-label">Verifier — Print Name & Sign</div>
      </div>
      <div>
        <div class="signoff-line"></div>
        <div class="signoff-label">Date</div>
      </div>
      <div>
        <div class="signoff-line"></div>
        <div class="signoff-label">Supervisor Approval — Print Name & Sign</div>
      </div>
      <div>
        <div class="signoff-line"></div>
        <div class="signoff-label">Date</div>
      </div>
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
