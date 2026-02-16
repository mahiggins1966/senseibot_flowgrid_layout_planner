import { LayoutScore } from './scoring';
import { SafetyRule } from './safetyAnalysis';

interface ExportData {
  scoreData: LayoutScore;
  facilityWidth: number;
  facilityHeight: number;
  squareSize: number;
  zoneCount: number;
  corridorCount: number;
  doorCount: number;
  activityCount: number;
}

/**
 * Clones the grid SVG and prepares it for print embedding.
 * Resets the viewport transform so the full grid is visible,
 * strips interactive attributes, and returns clean SVG markup.
 */
function getCleanSvgMarkup(): string {
  const svg = document.querySelector('#flowgrid-canvas') as SVGSVGElement;
  if (!svg) return '';

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('id');

  // Reset the viewport transform group to show the full grid
  // The first <g> child has transform="translate(panX, panY) scale(zoom)"
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

  // Strip interactive styles
  clone.style.cssText = '';
  clone.removeAttribute('style');

  // Remove any elements that are purely interactive UI (mode banners, etc.)
  // These are siblings outside the SVG so won't be in the clone anyway

  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

export function exportFloorPlanPDF(data?: ExportData) {
  const svgMarkup = getCleanSvgMarkup();
  if (!svgMarkup) {
    alert('Grid not found. Make sure you are on the layout view.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export the floor plan.');
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const facilityDims = data
    ? `${data.facilityWidth} ft × ${data.facilityHeight} ft`
    : '';
  const gridSize = data ? `${data.squareSize} ft per square` : '';

  // Build score page content
  let scorePage = '';
  if (data?.scoreData) {
    const sd = data.scoreData;
    const scoreColor = sd.percentage >= 85 ? '#16a34a' : sd.percentage >= 60 ? '#d97706' : '#dc2626';

    scorePage = `
      <div class="page-break"></div>
      <div class="score-page">
        <div class="score-header">
          <h2>Layout Score Report</h2>
          <div class="score-meta">${dateStr} at ${timeStr}</div>
        </div>

        <div class="score-summary">
          <div class="score-circle" style="border-color: ${scoreColor};">
            <div class="score-pct">${sd.percentage}%</div>
            <div class="score-pts">${sd.total} / ${sd.maxTotal}</div>
          </div>
          <div class="score-verdict">
            <div class="verdict-text">${sd.verdict}</div>
            <div class="score-stats">
              <span>${data.zoneCount} zone${data.zoneCount !== 1 ? 's' : ''}</span>
              <span class="dot">·</span>
              <span>${data.corridorCount} corridor${data.corridorCount !== 1 ? 's' : ''}</span>
              <span class="dot">·</span>
              <span>${data.doorCount} door${data.doorCount !== 1 ? 's' : ''}</span>
              <span class="dot">·</span>
              <span>${facilityDims}</span>
            </div>
          </div>
        </div>

        <table class="factor-table">
          <thead>
            <tr>
              <th class="col-status"></th>
              <th class="col-factor">Scoring Factor</th>
              <th class="col-score">Score</th>
              <th class="col-summary">Summary</th>
            </tr>
          </thead>
          <tbody>
            ${sd.factors.map(f => {
              const pct = f.maxScore > 0 ? (f.score / f.maxScore) * 100 : 0;
              const icon = pct >= 90 ? '✓' : pct >= 50 ? '⚠' : '✗';
              const iconColor = pct >= 90 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
              const factorName = f.label.split(':')[0];
              const factorQuestion = f.label.split(':')[1]?.trim() || '';

              return `
                <tr>
                  <td class="col-status"><span style="color:${iconColor}; font-weight:bold; font-size:16px;">${icon}</span></td>
                  <td class="col-factor">
                    <div class="factor-name">${factorName}</div>
                    <div class="factor-question">${factorQuestion}</div>
                  </td>
                  <td class="col-score">
                    <span class="score-num" style="color:${iconColor}">${f.score}</span>
                    <span class="score-max">/ ${f.maxScore}</span>
                  </td>
                  <td class="col-summary">${f.display}</td>
                </tr>
                ${f.details.length > 0 ? `
                  <tr class="detail-row">
                    <td></td>
                    <td colspan="3">
                      <div class="detail-list">
                        ${f.details.map(d => `<div class="detail-item">${d}</div>`).join('')}
                      </div>
                    </td>
                  </tr>
                ` : ''}
                ${f.flags && f.flags.filter(fl => !fl.isDismissed).length > 0 ? `
                  <tr class="detail-row">
                    <td></td>
                    <td colspan="3">
                      <div class="detail-list">
                        ${f.flags.filter(fl => !fl.isDismissed).map(fl => `
                          <div class="flag-item flag-${fl.severity.toLowerCase()}">
                            <span class="flag-severity">${fl.severity}</span>
                            <span class="flag-msg">${fl.message}</span>
                            <div class="flag-rec">${fl.recommendation}</div>
                          </div>
                        `).join('')}
                      </div>
                    </td>
                  </tr>
                ` : ''}
                ${f.safetyRules && f.safetyRules.length > 0 ? `
                  <tr class="detail-row">
                    <td></td>
                    <td colspan="3">
                      <div class="detail-list">
                        ${(f.safetyRules as SafetyRule[]).map(r => {
                          const rColor = r.score >= r.maxScore ? '#16a34a' : r.score === 0 ? '#dc2626' : '#d97706';
                          const rIcon = r.score >= r.maxScore ? '✓' : r.score === 0 ? '✗' : '⚠';
                          return `
                            <div class="safety-rule">
                              <div class="safety-rule-header">
                                <span style="color:${rColor}; font-weight:bold;">${rIcon} ${r.rule}</span>
                                <span style="color:${rColor}; font-weight:600;">${r.score}/${r.maxScore}</span>
                              </div>
                              <div class="safety-rule-msg">${r.message}</div>
                              ${r.locations.length > 0 ? `<div class="safety-rule-loc">Locations: ${r.locations.join(', ')}</div>` : ''}
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </td>
                  </tr>
                ` : ''}
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Floor Layout Plan</title>
  <style>
    @page { size: landscape; margin: 0.5in; }
    @media print { .no-print { display: none !important; } }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; }

    .page-break { page-break-before: always; }

    /* PAGE 1 — Layout */
    .layout-page { padding: 20px; }
    .layout-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; }
    .layout-title h1 { font-size: 22px; font-weight: 700; }
    .layout-title .subtitle { font-size: 13px; color: #6b7280; margin-top: 2px; }
    .layout-meta { text-align: right; font-size: 12px; color: #6b7280; }
    .layout-meta div { margin-bottom: 2px; }

    .plan-image { text-align: center; margin: 0 auto; }
    .plan-image svg { max-width: 100%; max-height: 65vh; height: auto; display: block; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 4px; background: white; }

    .layout-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }

    /* PAGE 2 — Score */
    .score-page { padding: 20px; }
    .score-header { margin-bottom: 20px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    .score-header h2 { font-size: 20px; font-weight: 700; }
    .score-meta { font-size: 12px; color: #6b7280; }

    .score-summary { display: flex; align-items: center; gap: 24px; margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; }
    .score-circle { width: 80px; height: 80px; border-radius: 50%; border: 4px solid; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; background: white; }
    .score-pct { font-size: 24px; font-weight: 700; }
    .score-pts { font-size: 11px; color: #6b7280; }
    .verdict-text { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .score-stats { font-size: 13px; color: #6b7280; }
    .dot { margin: 0 6px; }

    .factor-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .factor-table th { text-align: left; padding: 8px 10px; background: #f3f4f6; border-bottom: 2px solid #d1d5db; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    .factor-table td { padding: 10px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .col-status { width: 30px; text-align: center; }
    .col-score { width: 80px; white-space: nowrap; }
    .col-summary { color: #4b5563; }
    .factor-name { font-weight: 600; }
    .factor-question { font-size: 11px; color: #9ca3af; }
    .score-num { font-weight: 700; font-size: 14px; }
    .score-max { color: #9ca3af; }

    .detail-row td { padding-top: 0 !important; border-bottom: 1px solid #e5e7eb; }
    .detail-list { padding: 4px 0 8px 0; }
    .detail-item { font-size: 12px; color: #4b5563; padding: 3px 8px; border-left: 3px solid #d1d5db; margin-bottom: 4px; background: #f9fafb; }

    .flag-item { font-size: 12px; padding: 6px 8px; margin-bottom: 4px; border-left: 3px solid; background: #f9fafb; }
    .flag-high { border-color: #dc2626; }
    .flag-medium { border-color: #d97706; }
    .flag-low { border-color: #3b82f6; }
    .flag-severity { font-weight: 700; font-size: 10px; text-transform: uppercase; margin-right: 6px; }
    .flag-msg { font-weight: 600; }
    .flag-rec { font-size: 11px; color: #6b7280; margin-top: 2px; }

    .safety-rule { padding: 6px 8px; margin-bottom: 4px; background: #f9fafb; border-left: 3px solid #d1d5db; }
    .safety-rule-header { display: flex; justify-content: space-between; font-size: 12px; }
    .safety-rule-msg { font-size: 11px; color: #4b5563; margin-top: 2px; }
    .safety-rule-loc { font-size: 10px; color: #9ca3af; margin-top: 1px; }

    .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1f2937; color: white; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 100; }
    .print-bar button { padding: 8px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .print-bar button:hover { background: #2563eb; }
    .spacer { height: 52px; }
  </style>
</head>
<body>
  <div class="no-print print-bar">
    <span>Floor Layout Plan — Ready to print or save as PDF</span>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="no-print spacer"></div>

  <div class="layout-page">
    <div class="layout-header">
      <div class="layout-title">
        <h1>Floor Layout Plan</h1>
        <div class="subtitle">FlowGrid Layout Planner — Kamaka Air</div>
      </div>
      <div class="layout-meta">
        <div><strong>${dateStr}</strong></div>
        <div>${timeStr}</div>
        ${facilityDims ? `<div>${facilityDims}</div>` : ''}
        ${gridSize ? `<div>Grid: ${gridSize}</div>` : ''}
      </div>
    </div>

    <div class="plan-image">
      ${svgMarkup}
    </div>

    <div class="layout-footer">
      <span>Generated by FlowGrid Layout Planner</span>
      <span>Document is for reference only — verify measurements on site</span>
    </div>
  </div>

  ${scorePage}
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
