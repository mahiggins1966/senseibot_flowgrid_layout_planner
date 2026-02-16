import { supabase } from '../lib/supabase';
import { calculateLayoutScore, LayoutScore, ScoreFactor } from './scoring';
import { Activity, ActivityRelationship, Corridor, Door, VolumeTiming, Zone } from '../types';

interface LayoutAnalysis {
  id: string;
  name: string;
  score: LayoutScore;
  zoneCount: number;
  corridorCount: number;
  objectCount: number;
  zoneSqFt: number;
  corridorSqFt: number;
  created_at: string;
  updated_at: string;
}

export async function exportComparativeAnalysis(projectId: string) {
  // ── Load project ──
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (!project) { alert('Project not found.'); return; }

  // ── Load foundation (shared across layouts) ──
  const [settingsRes, activitiesRes, volumeRes, relsRes, doorsRes, paintedRes, layoutsRes] = await Promise.all([
    supabase.from('app_settings').select('*').eq('project_id', projectId).maybeSingle(),
    supabase.from('activities').select('*').eq('project_id', projectId),
    supabase.from('volume_timing').select('*').eq('project_id', projectId),
    supabase.from('activity_relationships').select('*').eq('project_id', projectId),
    supabase.from('doors').select('*').eq('project_id', projectId),
    supabase.from('painted_squares').select('*').eq('project_id', projectId),
    supabase.from('layouts').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
  ]);

  const s = settingsRes.data;
  if (!s) { alert('No settings found for this project.'); return; }
  const allLayouts = layoutsRes.data || [];
  if (allLayouts.length < 2) { alert('Need at least 2 layouts to compare.'); return; }

  const activities = (activitiesRes.data || []) as Activity[];
  const volumeTiming = (volumeRes.data || []) as VolumeTiming[];
  const activityRelationships = (relsRes.data || []) as ActivityRelationship[];
  const doors = (doorsRes.data || []) as Door[];

  const paintedSquares = new Map<string, { type: 'permanent' | 'semi-fixed' }>();
  (paintedRes.data || []).forEach((sq: any) => {
    paintedSquares.set(`${sq.row}-${sq.col}`, { type: sq.type });
  });

  const settings = {
    squareSize: s.square_size,
    facilityWidth: s.facility_width,
    facilityHeight: s.facility_height,
  };

  const gridDims = {
    rows: Math.floor(s.facility_height / s.square_size),
    cols: Math.floor(s.facility_width / s.square_size),
  };

  const sqFt = s.square_size * s.square_size;
  const unit = s.measurement_system === 'Metric' ? 'm' : 'ft';
  const areaUnit = s.measurement_system === 'Metric' ? 'm²' : 'sq ft';

  // ── Score each layout ──
  const layoutAnalyses: LayoutAnalysis[] = [];

  for (const layout of allLayouts) {
    const [zonesRes, corridorsRes, objectsRes] = await Promise.all([
      supabase.from('zones').select('*').eq('layout_id', layout.id),
      supabase.from('corridors').select('*').eq('layout_id', layout.id),
      supabase.from('placed_objects').select('*').eq('layout_id', layout.id),
    ]);

    const zones = (zonesRes.data || []) as Zone[];
    const corridors = (corridorsRes.data || []) as Corridor[];

    const score = calculateLayoutScore(
      zones, activities, settings, activityRelationships,
      volumeTiming, doors, corridors, paintedSquares, gridDims, new Set()
    );

    const zoneSqFt = zones.reduce((sum, z) => sum + z.grid_width * z.grid_height * sqFt, 0);
    let corridorSqFt = 0;
    corridors.forEach(c => {
      const len = Math.abs(c.end_grid_x - c.start_grid_x) + Math.abs(c.end_grid_y - c.start_grid_y) + 1;
      corridorSqFt += len * c.width * sqFt;
    });

    layoutAnalyses.push({
      id: layout.id,
      name: layout.name,
      score,
      zoneCount: zones.filter(z => z.activity_id).length,
      corridorCount: corridors.length,
      objectCount: objectsRes.data?.length || 0,
      zoneSqFt,
      corridorSqFt,
      created_at: layout.created_at,
      updated_at: layout.updated_at,
    });
  }

  // ── Sort by score descending ──
  layoutAnalyses.sort((a, b) => b.score.percentage - a.score.percentage);
  const best = layoutAnalyses[0];
  const factorNames = best.score.factors.map(f => f.name);

  // ── Build HTML ──
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Please allow popups to export the report.'); return; }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const facilityArea = s.facility_width * s.facility_height;

  // Color helpers
  const scoreColor = (pct: number) => pct >= 85 ? '#059669' : pct >= 60 ? '#d97706' : '#dc2626';
  const scoreBg = (pct: number) => pct >= 85 ? '#ecfdf5' : pct >= 60 ? '#fffbeb' : '#fef2f2';
  const scoreBorder = (pct: number) => pct >= 85 ? '#a7f3d0' : pct >= 60 ? '#fde68a' : '#fecaca';

  // Ranking badges
  const rankBadge = (i: number) => {
    if (i === 0) return '<span class="rank rank-1">★ RECOMMENDED</span>';
    if (i === 1) return '<span class="rank rank-2">2nd</span>';
    if (i === 2) return '<span class="rank rank-3">3rd</span>';
    return `<span class="rank rank-other">${i + 1}th</span>`;
  };

  // Factor winner per category
  const factorWinners = factorNames.map(fname => {
    let bestLayout = layoutAnalyses[0];
    let bestScore = -1;
    layoutAnalyses.forEach(la => {
      const f = la.score.factors.find(f => f.name === fname);
      if (f && f.score > bestScore) { bestScore = f.score; bestLayout = la; }
    });
    return bestLayout.name;
  });

  // Score differential narrative
  const scoreDiff = layoutAnalyses.length >= 2
    ? layoutAnalyses[0].score.percentage - layoutAnalyses[1].score.percentage
    : 0;

  let executiveSummary = '';
  if (scoreDiff === 0) {
    executiveSummary = `<strong>${layoutAnalyses[0].name}</strong> and <strong>${layoutAnalyses[1].name}</strong> are tied at <strong>${layoutAnalyses[0].score.percentage}%</strong>. Review the factor-by-factor breakdown to identify which layout better serves your operational priorities.`;
  } else if (scoreDiff <= 5) {
    executiveSummary = `<strong>${best.name}</strong> leads by a narrow margin of ${scoreDiff} points (${best.score.percentage}% vs ${layoutAnalyses[1].score.percentage}%). The layouts are closely matched — the deciding factor should be which trade-offs align with your operational priorities.`;
  } else if (scoreDiff <= 15) {
    executiveSummary = `<strong>${best.name}</strong> outperforms the next closest layout by ${scoreDiff} points (${best.score.percentage}% vs ${layoutAnalyses[1].score.percentage}%). This is a meaningful difference that will impact daily operations.`;
  } else {
    executiveSummary = `<strong>${best.name}</strong> is the clear frontrunner at ${best.score.percentage}%, leading by ${scoreDiff} points. The performance gap is significant and warrants serious consideration.`;
  }

  // Build factor comparison rows
  const factorRows = factorNames.map((fname, fi) => {
    const factorLabel = best.score.factors[fi].label.split(':')[0];
    const maxScore = best.score.factors[fi].maxScore;

    const cells = layoutAnalyses.map(la => {
      const f = la.score.factors.find(f => f.name === fname)!;
      const pct = f.maxScore > 0 ? (f.score / f.maxScore) * 100 : 0;
      const color = scoreColor(pct);
      const isWinner = factorWinners[fi] === la.name;
      return `
        <td class="factor-cell">
          <div class="factor-score-row">
            <span class="factor-pts" style="color:${color}">${f.score}</span>
            <span class="factor-max">/ ${f.maxScore}</span>
            ${isWinner && layoutAnalyses.length > 1 ? '<span class="factor-win">✦</span>' : ''}
          </div>
          <div class="factor-bar-track">
            <div class="factor-bar-fill" style="width:${pct}%; background:${color};"></div>
          </div>
          <div class="factor-display">${f.display}</div>
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td class="factor-label">
          <div class="factor-name">${factorLabel}</div>
          <div class="factor-weight">${maxScore} pts max</div>
        </td>
        ${cells}
      </tr>
    `;
  }).join('');

  // Build key findings section
  const findings: string[] = [];

  // Find factors where layouts diverge most
  factorNames.forEach((fname, fi) => {
    const scores = layoutAnalyses.map(la => {
      const f = la.score.factors.find(f => f.name === fname)!;
      return { name: la.name, score: f.score, maxScore: f.maxScore, display: f.display };
    });
    const max = Math.max(...scores.map(s => s.score));
    const min = Math.min(...scores.map(s => s.score));
    const spread = max - min;
    const factorLabel = best.score.factors[fi].label.split(':')[0];

    if (spread > 0) {
      const winner = scores.find(s => s.score === max)!;
      const loser = scores.find(s => s.score === min)!;
      findings.push(
        `<strong>${factorLabel}</strong> — ${winner.name} scores ${winner.score}/${winner.maxScore} while ${loser.name} scores ${loser.score}/${loser.maxScore}. ${winner.display}.`
      );
    }
  });

  // Build detail issues per layout
  const layoutDetailSections = layoutAnalyses.map(la => {
    const issues = la.score.factors
      .filter(f => f.details.length > 0 || (f.flags && f.flags.filter(fl => !fl.isDismissed).length > 0))
      .map(f => {
        const factorLabel = f.label.split(':')[0];
        const items = [
          ...f.details.map(d => `<li>${d}</li>`),
          ...(f.flags || []).filter(fl => !fl.isDismissed).map(fl =>
            `<li><span class="severity-${fl.severity.toLowerCase()}">${fl.severity}</span> ${fl.message}</li>`
          ),
        ];
        if (items.length === 0) return '';
        return `
          <div class="issue-group">
            <div class="issue-factor">${factorLabel}</div>
            <ul class="issue-list">${items.join('')}</ul>
          </div>
        `;
      }).filter(Boolean).join('');

    return { name: la.name, pct: la.score.percentage, issues };
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Comparative Layout Analysis — ${project.name}</title>
  <style>
    @page { size: portrait; margin: 0.6in 0.75in; }
    @media print {
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      body { font-size: 11px; }
    }

    :root {
      --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb;
      --gray-300: #d1d5db; --gray-400: #9ca3af; --gray-500: #6b7280;
      --gray-600: #4b5563; --gray-700: #374151; --gray-800: #1f2937;
      --gray-900: #111827;
      --blue-600: #2563eb; --blue-50: #eff6ff;
      --green-600: #059669; --green-50: #ecfdf5; --green-200: #a7f3d0;
      --amber-600: #d97706; --amber-50: #fffbeb; --amber-200: #fde68a;
      --red-600: #dc2626; --red-50: #fef2f2; --red-200: #fecaca;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--gray-800); line-height: 1.6; background: white;
    }

    /* ─── Print bar ─── */
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: var(--gray-900); color: white;
      padding: 12px 32px; display: flex; justify-content: space-between; align-items: center;
    }
    .print-bar span { font-size: 14px; font-weight: 500; }
    .print-bar button {
      padding: 8px 24px; background: var(--blue-600); color: white;
      border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .print-bar button:hover { background: #1d4ed8; }
    .print-spacer { height: 56px; }

    /* ─── Cover page ─── */
    .cover {
      min-height: 100vh; display: flex; flex-direction: column;
      justify-content: center; padding: 60px 80px;
      background: linear-gradient(135deg, var(--gray-900) 0%, #1e293b 100%);
      color: white; position: relative;
    }
    .cover::after {
      content: ''; position: absolute; top: 0; right: 0;
      width: 40%; height: 100%;
      background: linear-gradient(135deg, transparent 0%, rgba(37,99,235,0.08) 100%);
    }
    .cover-badge {
      display: inline-block; padding: 6px 16px;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px; font-size: 11px; letter-spacing: 0.12em;
      text-transform: uppercase; font-weight: 600; margin-bottom: 32px; color: rgba(255,255,255,0.7);
    }
    .cover h1 {
      font-size: 42px; font-weight: 800; line-height: 1.15;
      margin-bottom: 12px; letter-spacing: -0.02em;
    }
    .cover-project {
      font-size: 22px; font-weight: 400; color: rgba(255,255,255,0.6);
      margin-bottom: 48px;
    }
    .cover-meta {
      font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.8;
    }
    .cover-divider {
      width: 60px; height: 3px; background: var(--blue-600);
      margin-bottom: 24px; border-radius: 2px;
    }
    .cover-stats {
      display: flex; gap: 40px; margin-top: 48px;
      padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.1);
    }
    .cover-stat-value {
      font-size: 28px; font-weight: 700; color: white;
    }
    .cover-stat-label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
      color: rgba(255,255,255,0.4); margin-top: 2px;
    }

    /* ─── Content pages ─── */
    .content { padding: 48px 64px; max-width: 1000px; margin: 0 auto; }

    .section { margin-bottom: 48px; }
    .section-num {
      font-size: 11px; font-weight: 700; color: var(--blue-600);
      text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;
    }
    .section-title {
      font-size: 24px; font-weight: 700; color: var(--gray-900);
      margin-bottom: 4px; letter-spacing: -0.01em;
    }
    .section-subtitle {
      font-size: 14px; color: var(--gray-500); margin-bottom: 24px;
    }
    .section-divider {
      width: 40px; height: 3px; background: var(--blue-600);
      margin-bottom: 20px; border-radius: 2px;
    }

    /* ─── Executive summary ─── */
    .exec-box {
      background: var(--gray-50); border: 1px solid var(--gray-200);
      border-radius: 12px; padding: 24px 28px; font-size: 15px;
      line-height: 1.7; color: var(--gray-700);
    }
    .exec-box strong { color: var(--gray-900); }

    /* ─── Scorecard grid ─── */
    .scorecard-grid {
      display: grid;
      grid-template-columns: repeat(${Math.min(layoutAnalyses.length, 4)}, 1fr);
      gap: 16px; margin-bottom: 32px;
    }
    .scorecard {
      border: 2px solid var(--gray-200); border-radius: 12px;
      padding: 24px 20px; text-align: center; position: relative;
      transition: border-color 0.2s;
    }
    .scorecard-best { border-color: var(--green-200); background: var(--green-50); }
    .scorecard-name {
      font-size: 16px; font-weight: 700; color: var(--gray-800); margin-bottom: 12px;
    }
    .scorecard-pct {
      font-size: 48px; font-weight: 800; line-height: 1;
      margin-bottom: 4px; letter-spacing: -0.03em;
    }
    .scorecard-pts {
      font-size: 13px; color: var(--gray-400); margin-bottom: 16px;
    }
    .scorecard-verdict {
      font-size: 12px; color: var(--gray-600); font-style: italic;
      padding-top: 12px; border-top: 1px solid var(--gray-200);
    }
    .scorecard-best .scorecard-verdict { border-color: var(--green-200); }

    .rank {
      display: inline-block; padding: 3px 10px; border-radius: 10px;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; margin-bottom: 12px;
    }
    .rank-1 { background: #fef3c7; color: #92400e; }
    .rank-2 { background: var(--gray-100); color: var(--gray-600); }
    .rank-3 { background: var(--gray-100); color: var(--gray-500); }
    .rank-other { background: var(--gray-100); color: var(--gray-400); }

    /* ─── Stats row ─── */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(${Math.min(layoutAnalyses.length, 4)}, 1fr);
      gap: 16px; margin-bottom: 8px;
    }
    .stat-cell {
      text-align: center; padding: 12px;
      background: var(--gray-50); border-radius: 8px;
    }
    .stat-value { font-size: 18px; font-weight: 700; color: var(--gray-800); }
    .stat-label { font-size: 11px; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.06em; }

    /* ─── Factor comparison table ─── */
    .factor-table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .factor-table thead th {
      padding: 10px 14px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--gray-500); background: var(--gray-50);
      border-bottom: 2px solid var(--gray-200); text-align: left;
    }
    .factor-table thead th:first-child {
      border-radius: 8px 0 0 0; width: 180px;
    }
    .factor-table thead th:last-child { border-radius: 0 8px 0 0; }
    .factor-label {
      padding: 14px; border-bottom: 1px solid var(--gray-100); vertical-align: top;
    }
    .factor-name { font-weight: 600; font-size: 13px; color: var(--gray-800); }
    .factor-weight { font-size: 11px; color: var(--gray-400); margin-top: 2px; }
    .factor-cell {
      padding: 14px; border-bottom: 1px solid var(--gray-100); vertical-align: top;
    }
    .factor-score-row { display: flex; align-items: baseline; gap: 3px; margin-bottom: 6px; }
    .factor-pts { font-size: 16px; font-weight: 700; }
    .factor-max { font-size: 12px; color: var(--gray-400); }
    .factor-win {
      font-size: 12px; color: var(--green-600); margin-left: 4px;
    }
    .factor-bar-track {
      width: 100%; height: 6px; background: var(--gray-100);
      border-radius: 3px; margin-bottom: 6px; overflow: hidden;
    }
    .factor-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
    .factor-display { font-size: 11px; color: var(--gray-500); line-height: 1.4; }

    /* ─── Key findings ─── */
    .findings-list { list-style: none; counter-reset: finding; }
    .findings-list li {
      padding: 14px 16px 14px 48px; position: relative;
      border-bottom: 1px solid var(--gray-100);
      font-size: 13px; color: var(--gray-700); line-height: 1.6;
    }
    .findings-list li::before {
      counter-increment: finding;
      content: counter(finding);
      position: absolute; left: 14px; top: 14px;
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--blue-50); color: var(--blue-600);
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .findings-list li strong { color: var(--gray-900); }

    /* ─── Detail issues ─── */
    .layout-issues { margin-bottom: 32px; }
    .layout-issues-header {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 12px; padding-bottom: 8px;
      border-bottom: 2px solid var(--gray-200);
    }
    .layout-issues-name { font-size: 16px; font-weight: 700; color: var(--gray-800); }
    .layout-issues-score {
      padding: 2px 10px; border-radius: 10px;
      font-size: 12px; font-weight: 700;
    }
    .issue-group { margin-bottom: 12px; }
    .issue-factor {
      font-size: 12px; font-weight: 600; color: var(--gray-600);
      margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .issue-list { list-style: none; padding-left: 12px; }
    .issue-list li {
      font-size: 12px; color: var(--gray-600); line-height: 1.6;
      padding: 3px 0; border-left: 3px solid var(--gray-200); padding-left: 10px;
      margin-bottom: 3px;
    }
    .severity-high { font-weight: 700; color: var(--red-600); font-size: 10px; text-transform: uppercase; margin-right: 4px; }
    .severity-medium { font-weight: 700; color: var(--amber-600); font-size: 10px; text-transform: uppercase; margin-right: 4px; }
    .severity-low { font-weight: 700; color: var(--blue-600); font-size: 10px; text-transform: uppercase; margin-right: 4px; }
    .no-issues {
      font-size: 13px; color: var(--green-600); font-style: italic;
      padding: 8px 12px; background: var(--green-50); border-radius: 6px;
    }

    /* ─── Footer ─── */
    .report-footer {
      margin-top: 48px; padding-top: 16px;
      border-top: 1px solid var(--gray-200);
      display: flex; justify-content: space-between;
      font-size: 11px; color: var(--gray-400);
    }
  </style>
</head>
<body>
  <div class="no-print print-bar">
    <span>Comparative Layout Analysis — Ready to print or save as PDF</span>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="no-print print-spacer"></div>

  <!-- ═══════════════════════ COVER PAGE ═══════════════════════ -->
  <div class="cover">
    <div class="cover-badge">Layout Performance Analysis</div>
    <h1>Comparative<br>Layout Analysis</h1>
    <div class="cover-project">${project.name}</div>
    <div class="cover-divider"></div>
    <div class="cover-meta">
      <div>Prepared ${dateStr} at ${timeStr}</div>
      <div>${s.facility_width} × ${s.facility_height} ${unit} facility — ${facilityArea.toLocaleString()} ${areaUnit}</div>
      <div>${layoutAnalyses.length} layout${layoutAnalyses.length > 1 ? 's' : ''} evaluated across ${factorNames.length} scoring factors</div>
    </div>
    <div class="cover-stats">
      <div>
        <div class="cover-stat-value">${layoutAnalyses.length}</div>
        <div class="cover-stat-label">Layouts Compared</div>
      </div>
      <div>
        <div class="cover-stat-value">${best.score.percentage}%</div>
        <div class="cover-stat-label">Highest Score</div>
      </div>
      <div>
        <div class="cover-stat-value">${activities.length}</div>
        <div class="cover-stat-label">Activity Zones</div>
      </div>
      <div>
        <div class="cover-stat-value">${doors.length}</div>
        <div class="cover-stat-label">Door Openings</div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════ CONTENT ═══════════════════════ -->
  <div class="page-break"></div>
  <div class="content">

    <!-- §1 EXECUTIVE SUMMARY -->
    <div class="section">
      <div class="section-num">Section 1</div>
      <div class="section-title">Executive Summary</div>
      <div class="section-divider"></div>
      <div class="exec-box">${executiveSummary}</div>
    </div>

    <!-- §2 OVERALL SCORES -->
    <div class="section">
      <div class="section-num">Section 2</div>
      <div class="section-title">Overall Scores</div>
      <div class="section-subtitle">Each layout scored across ${factorNames.length} weighted factors totaling ${best.score.maxTotal} points</div>
      <div class="section-divider"></div>

      <div class="scorecard-grid">
        ${layoutAnalyses.map((la, i) => `
          <div class="scorecard ${i === 0 ? 'scorecard-best' : ''}">
            ${rankBadge(i)}
            <div class="scorecard-name">${la.name}</div>
            <div class="scorecard-pct" style="color:${scoreColor(la.score.percentage)}">${la.score.percentage}%</div>
            <div class="scorecard-pts">${la.score.total} / ${la.score.maxTotal} points</div>
            <div class="scorecard-verdict">${la.score.verdict}</div>
          </div>
        `).join('')}
      </div>

      <div class="stats-row">
        ${layoutAnalyses.map(la => `
          <div class="stat-cell">
            <div class="stat-value">${la.zoneCount}</div>
            <div class="stat-label">Zones Placed</div>
          </div>
        `).join('')}
      </div>
      <div class="stats-row">
        ${layoutAnalyses.map(la => `
          <div class="stat-cell">
            <div class="stat-value">${la.corridorCount}</div>
            <div class="stat-label">Corridors</div>
          </div>
        `).join('')}
      </div>
      <div class="stats-row">
        ${layoutAnalyses.map(la => `
          <div class="stat-cell">
            <div class="stat-value">${la.zoneSqFt.toLocaleString()}</div>
            <div class="stat-label">${areaUnit} Zoned</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- §3 FACTOR COMPARISON -->
    <div class="page-break"></div>
    <div class="section">
      <div class="section-num">Section 3</div>
      <div class="section-title">Factor-by-Factor Comparison</div>
      <div class="section-subtitle">✦ marks the leading layout in each category</div>
      <div class="section-divider"></div>

      <table class="factor-table">
        <thead>
          <tr>
            <th>Factor</th>
            ${layoutAnalyses.map(la => `<th>${la.name}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${factorRows}
          <tr style="background: var(--gray-50);">
            <td class="factor-label" style="border-bottom:none;">
              <div class="factor-name" style="font-size:14px;">TOTAL</div>
            </td>
            ${layoutAnalyses.map(la => `
              <td class="factor-cell" style="border-bottom:none;">
                <div class="factor-score-row">
                  <span class="factor-pts" style="color:${scoreColor(la.score.percentage)}; font-size:20px;">${la.score.total}</span>
                  <span class="factor-max">/ ${la.score.maxTotal}</span>
                </div>
              </td>
            `).join('')}
          </tr>
        </tbody>
      </table>
    </div>

    <!-- §4 KEY FINDINGS -->
    ${findings.length > 0 ? `
    <div class="section">
      <div class="section-num">Section 4</div>
      <div class="section-title">Key Differences</div>
      <div class="section-subtitle">Factors where layouts diverge in performance</div>
      <div class="section-divider"></div>
      <ol class="findings-list">
        ${findings.map(f => `<li>${f}</li>`).join('')}
      </ol>
    </div>
    ` : ''}

    <!-- §5 DETAILED ISSUES -->
    <div class="page-break"></div>
    <div class="section">
      <div class="section-num">Section ${findings.length > 0 ? '5' : '4'}</div>
      <div class="section-title">Detailed Issues by Layout</div>
      <div class="section-subtitle">Specific warnings and improvement opportunities for each layout</div>
      <div class="section-divider"></div>

      ${layoutDetailSections.map(ld => `
        <div class="layout-issues">
          <div class="layout-issues-header">
            <span class="layout-issues-name">${ld.name}</span>
            <span class="layout-issues-score" style="background:${scoreBg(ld.pct)}; color:${scoreColor(ld.pct)}; border: 1px solid ${scoreBorder(ld.pct)};">${ld.pct}%</span>
          </div>
          ${ld.issues || '<div class="no-issues">No outstanding issues — all factors performing well.</div>'}
        </div>
      `).join('')}
    </div>

    <div class="report-footer">
      <span>Generated by FlowGrid Layout Planner</span>
      <span>${project.name} — ${dateStr}</span>
      <span>For reference only — verify measurements on site</span>
    </div>
  </div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
