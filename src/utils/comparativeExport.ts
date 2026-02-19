import { supabase } from '../lib/supabase';
import { calculateLayoutScore, LayoutScore } from './scoring';
import { Activity, ActivityRelationship, Corridor, Door, VolumeTiming, Zone } from '../types';
import { generateLayoutSvg } from './layoutThumbnail';

interface LayoutAnalysis {
  id: string;
  name: string;
  score: LayoutScore;
  zoneCount: number;
  corridorCount: number;
  objectCount: number;
  zoneSqFt: number;
  corridorSqFt: number;
  materialTravelFt: number;
  created_at: string;
  updated_at: string;
  zones: Zone[];
  corridors: Corridor[];
  svgMarkup: string;
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

    const flowPaths = (layout.flow_paths || {}) as Record<string, Array<{ x: number; y: number }>>;

    const zones = (zonesRes.data || []) as Zone[];
    const corridors = (corridorsRes.data || []) as Corridor[];

    const dismissedFlags = new Set<string>(
      Array.isArray(layout.dismissed_flags) ? layout.dismissed_flags : []
    );

    const score = calculateLayoutScore(
      zones, activities, settings, activityRelationships,
      volumeTiming, doors, corridors, paintedSquares, gridDims, dismissedFlags
    );

    const zoneSqFt = zones.reduce((sum, z) => sum + z.grid_width * z.grid_height * sqFt, 0);
    let corridorSqFt = 0;
    corridors.forEach(c => {
      const len = Math.abs(c.end_grid_x - c.start_grid_x) + Math.abs(c.end_grid_y - c.start_grid_y) + 1;
      corridorSqFt += len * c.width * sqFt;
    });

    // Generate SVG thumbnail
    const svgMarkup = generateLayoutSvg({
      zones, corridors, doors, activities, paintedSquares,
      gridRows: gridDims.rows, gridCols: gridDims.cols,
      squareSize: s.square_size,
      facilityWidth: s.facility_width,
      facilityHeight: s.facility_height,
      flowPaths,
    });

    // Calculate material travel distance for this layout
    const pathDistSquares = (pts: Array<{ x: number; y: number }>) => {
      let d = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        d += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
      }
      return d;
    };

    let weightedInbound = 0;
    doors.filter(d => d.has_inbound_material).forEach(door => {
      const pts = flowPaths[`${door.id}_inbound`];
      if (pts && pts.length >= 2) {
        weightedInbound += pathDistSquares(pts) * ((door.inbound_percentage ?? 0) / 100);
      }
    });

    let weightedOutbound = 0;
    doors.filter(d => d.has_outbound_material).forEach(door => {
      const pts = flowPaths[`${door.id}_outbound`];
      if (pts && pts.length >= 2) {
        weightedOutbound += pathDistSquares(pts) * ((door.outbound_percentage ?? 0) / 100);
      }
    });

    // Process flow: centroid-to-centroid along sequence
    const seqActs = activities
      .filter(a => a.sequence_order != null && (a.sequence_order as number) > 0)
      .sort((a, b) => ((a.sequence_order as number) || 0) - ((b.sequence_order as number) || 0));
    const seqGroups = new Map<number, { cx: number; cy: number }>();
    for (const act of seqActs) {
      const actZones = zones.filter(z => z.activity_id === act.id);
      if (actZones.length === 0) continue;
      const seq = act.sequence_order as number;
      if (!seqGroups.has(seq)) {
        let cx = 0, cy = 0;
        for (const z of actZones) { cx += z.grid_x + z.grid_width / 2; cy += z.grid_y + z.grid_height / 2; }
        seqGroups.set(seq, { cx: cx / actZones.length, cy: cy / actZones.length });
      }
    }
    const sortedSeqs = Array.from(seqGroups.keys()).sort((a, b) => a - b);
    let processSquares = 0;
    for (let i = 0; i < sortedSeqs.length - 1; i++) {
      const from = seqGroups.get(sortedSeqs[i])!;
      const to = seqGroups.get(sortedSeqs[i + 1])!;
      processSquares += Math.sqrt(Math.pow(to.cx - from.cx, 2) + Math.pow(to.cy - from.cy, 2));
    }

    const materialTravelFt = Math.round((weightedInbound + processSquares + weightedOutbound) * s.square_size);

    layoutAnalyses.push({
      id: layout.id,
      name: layout.name,
      score,
      zoneCount: zones.filter(z => z.activity_id).length,
      corridorCount: corridors.length,
      objectCount: objectsRes.data?.length || 0,
      zoneSqFt,
      corridorSqFt,
      materialTravelFt,
      created_at: layout.created_at,
      updated_at: layout.updated_at,
      zones,
      corridors,
      svgMarkup,
    });
  }

  // ── Sort by score descending ──
  layoutAnalyses.sort((a, b) => b.score.percentage - a.score.percentage);
  const best = layoutAnalyses[0];
  const factorNames = best.score.factors.map(f => f.name);

  // ── Open print window ──
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Please allow popups to export the report.'); return; }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const facilityArea = s.facility_width * s.facility_height;

  // ── Helpers ──
  const scoreColor = (pct: number) => pct >= 85 ? '#047857' : pct >= 60 ? '#b45309' : '#b91c1c';
  const scoreBg = (pct: number) => pct >= 85 ? '#ecfdf5' : pct >= 60 ? '#fffbeb' : '#fef2f2';
  const scoreBorder = (pct: number) => pct >= 85 ? '#6ee7b7' : pct >= 60 ? '#fcd34d' : '#fca5a5';
  const barColor = (pct: number) => pct >= 85 ? '#059669' : pct >= 60 ? '#d97706' : '#dc2626';

  const colCount = layoutAnalyses.length;

  // ── Executive narrative ──
  const scoreDiff = layoutAnalyses.length >= 2
    ? layoutAnalyses[0].score.percentage - layoutAnalyses[1].score.percentage
    : 0;

  let execNarrative = '';
  if (scoreDiff === 0) {
    execNarrative = `<strong>${layoutAnalyses[0].name}</strong> and <strong>${layoutAnalyses[1].name}</strong> are tied at ${layoutAnalyses[0].score.percentage}%. Review the factor breakdown below to determine which layout best serves your operational priorities.`;
  } else if (scoreDiff <= 5) {
    execNarrative = `<strong>${best.name}</strong> leads by ${scoreDiff} point${scoreDiff > 1 ? 's' : ''} (${best.score.percentage}% vs. ${layoutAnalyses[1].score.percentage}%). The layouts are closely matched. The deciding factor should be which trade-offs align with your priorities.`;
  } else if (scoreDiff <= 15) {
    execNarrative = `<strong>${best.name}</strong> outperforms the next layout by ${scoreDiff} points (${best.score.percentage}% vs. ${layoutAnalyses[1].score.percentage}%). This is a meaningful gap that will affect daily operations.`;
  } else {
    execNarrative = `<strong>${best.name}</strong> is the clear frontrunner at ${best.score.percentage}%, leading by ${scoreDiff} points. The performance gap is significant.`;
  }

  // ── Factor winners ──
  const factorWinners = factorNames.map(fname => {
    let topScore = -1;
    let winnerName = '';
    layoutAnalyses.forEach(la => {
      const f = la.score.factors.find(f => f.name === fname);
      if (f && f.score > topScore) { topScore = f.score; winnerName = la.name; }
    });
    return winnerName;
  });

  // ── Key findings ──
  const findings: string[] = [];
  factorNames.forEach((fname, fi) => {
    const scores = layoutAnalyses.map(la => {
      const f = la.score.factors.find(f => f.name === fname)!;
      return { name: la.name, score: f.score, maxScore: f.maxScore, display: f.display };
    });
    const max = Math.max(...scores.map(s => s.score));
    const min = Math.min(...scores.map(s => s.score));
    if (max - min > 0) {
      const winner = scores.find(s => s.score === max)!;
      const loser = scores.find(s => s.score === min)!;
      const factorLabel = best.score.factors[fi].label.split(':')[0];
      findings.push(
        `<strong>${factorLabel}:</strong> ${winner.name} scores ${winner.score}/${winner.maxScore} vs. ${loser.name} at ${loser.score}/${loser.maxScore}. ${winner.display}.`
      );
    }
  });

  // Material travel distance finding
  const travelDistances = layoutAnalyses.map(la => ({ name: la.name, ft: la.materialTravelFt }));
  const hasAnyTravel = travelDistances.some(t => t.ft > 0);
  if (hasAnyTravel && travelDistances.length > 1) {
    const sorted = [...travelDistances].sort((a, b) => a.ft - b.ft);
    const shortest = sorted[0];
    const longest = sorted[sorted.length - 1];
    if (shortest.ft !== longest.ft) {
      const savings = longest.ft - shortest.ft;
      const pctSavings = longest.ft > 0 ? Math.round((savings / longest.ft) * 100) : 0;
      findings.push(
        `<strong>Material Travel Distance:</strong> ${shortest.name} has the shortest weighted path at ${shortest.ft.toLocaleString()} ${unit} vs. ${longest.name} at ${longest.ft.toLocaleString()} ${unit} — a ${pctSavings}% reduction (${savings.toLocaleString()} ${unit} shorter).`
      );
    }
  }

  // ── Factor comparison rows ──
  const factorRows = factorNames.map((fname, fi) => {
    const factorLabel = best.score.factors[fi].label.split(':')[0];
    const maxPts = best.score.factors[fi].maxScore;

    const cells = layoutAnalyses.map(la => {
      const f = la.score.factors.find(f => f.name === fname)!;
      const pct = f.maxScore > 0 ? (f.score / f.maxScore) * 100 : 0;
      const isWinner = factorWinners[fi] === la.name && colCount > 1;
      return `
        <td class="fc">
          <div class="fc-score">
            <span style="color:${barColor(pct)}; font-weight:700;">${f.score}</span>
            <span class="fc-max">/${f.maxScore}</span>
            ${isWinner ? '<span class="fc-best">●</span>' : ''}
          </div>
          <div class="fc-bar"><div class="fc-fill" style="width:${pct}%; background:${barColor(pct)};"></div></div>
          <div class="fc-detail">${f.display}</div>
        </td>
      `;
    }).join('');

    return `<tr><td class="fl"><div class="fl-name">${factorLabel}</div><div class="fl-wt">${maxPts} pts</div></td>${cells}</tr>`;
  }).join('');

  // ── Detail issues per layout (for side-by-side) ──
  const detailColumns = layoutAnalyses.map(la => {
    const issues = la.score.factors
      .filter(f => f.details.length > 0 || (f.flags && f.flags.filter(fl => !fl.isDismissed).length > 0))
      .map(f => {
        const fLabel = f.label.split(':')[0];
        const items = [
          ...f.details.map(d => `<li>${d}</li>`),
          ...(f.flags || []).filter(fl => !fl.isDismissed).map(fl =>
            `<li><span class="sev sev-${fl.severity.toLowerCase()}">${fl.severity}</span> ${fl.message}</li>`
          ),
        ];
        if (items.length === 0) return '';
        return `<div class="ig"><div class="ig-label">${fLabel}</div><ul class="ig-list">${items.join('')}</ul></div>`;
      }).filter(Boolean).join('');

    return { name: la.name, pct: la.score.percentage, issues };
  });

  // ═══════════════════════ HTML ═══════════════════════
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Layout Comparison — ${project.name}</title>
<style>
@page { size: landscape; margin: 0.5in 0.65in; }
@media print {
  .no-print { display: none !important; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
:root {
  --g50:#f9fafb;--g100:#f3f4f6;--g200:#e5e7eb;--g300:#d1d5db;
  --g400:#9ca3af;--g500:#6b7280;--g600:#4b5563;--g700:#374151;--g800:#1f2937;--g900:#111827;
  --blue:#2563eb;--blue50:#eff6ff;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--g800);line-height:1.55;background:#fff;}

/* Print bar */
.pbar{position:fixed;top:0;left:0;right:0;z-index:100;background:var(--g900);color:#fff;padding:10px 28px;display:flex;justify-content:space-between;align-items:center;font-size:13px;}
.pbar button{padding:7px 22px;background:var(--blue);color:#fff;border:none;border-radius:5px;font-size:13px;font-weight:600;cursor:pointer;}
.pbar button:hover{background:#1d4ed8;}
.pbar-spacer{height:46px;}

/* ─── Page frame ─── */
.page{padding:40px 52px;position:relative;}

/* ─── Cover ─── */
.cover{display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 46px);padding:60px 72px;}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:64px;}
.cover-logo{font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:var(--g400);}
.cover-date{font-size:12px;color:var(--g400);text-align:right;line-height:1.7;}
.cover-rule{width:48px;height:3px;background:var(--g900);margin-bottom:20px;}
.cover h1{font-size:38px;font-weight:800;letter-spacing:-0.025em;line-height:1.15;color:var(--g900);margin-bottom:8px;}
.cover-sub{font-size:20px;font-weight:400;color:var(--g500);margin-bottom:48px;}
.cover-meta{font-size:13px;color:var(--g400);line-height:1.8;}
.cover-kpis{display:flex;gap:48px;margin-top:56px;padding-top:28px;border-top:1px solid var(--g200);}
.kpi-val{font-size:32px;font-weight:700;color:var(--g900);letter-spacing:-0.02em;}
.kpi-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--g400);margin-top:2px;}

/* ─── Section headers ─── */
.sh{margin-bottom:24px;}
.sh-num{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--blue);margin-bottom:4px;}
.sh-title{font-size:20px;font-weight:700;color:var(--g900);letter-spacing:-0.01em;}
.sh-sub{font-size:12px;color:var(--g500);margin-top:3px;}
.sh-rule{width:32px;height:2px;background:var(--g900);margin-top:10px;}

/* ─── Page footer ─── */
.pf{position:absolute;bottom:28px;left:52px;right:52px;display:flex;justify-content:space-between;font-size:9px;color:var(--g400);border-top:1px solid var(--g200);padding-top:8px;}

/* ─── Executive box ─── */
.ebox{padding:20px 24px;background:var(--g50);border:1px solid var(--g200);border-radius:8px;font-size:14px;line-height:1.7;color:var(--g700);}
.ebox strong{color:var(--g900);}

/* ─── Scorecard strip ─── */
.sc-strip{display:flex;gap:20px;margin-top:28px;}
.sc{flex:1;border:1.5px solid var(--g200);border-radius:8px;padding:20px;text-align:center;position:relative;}
.sc-best{border-color:#6ee7b7;background:#f0fdf4;}
.sc-rank{display:inline-block;padding:2px 10px;border-radius:8px;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;}
.sc-rank-1{background:#fef3c7;color:#92400e;}
.sc-rank-n{background:var(--g100);color:var(--g500);}
.sc-name{font-size:14px;font-weight:700;color:var(--g800);margin-bottom:8px;}
.sc-pct{font-size:42px;font-weight:800;line-height:1;letter-spacing:-0.03em;}
.sc-pts{font-size:12px;color:var(--g400);margin-top:4px;margin-bottom:12px;}
.sc-verdict{font-size:11px;color:var(--g600);font-style:italic;padding-top:10px;border-top:1px solid var(--g200);}
.sc-best .sc-verdict{border-color:#a7f3d0;}

/* ─── Quick stats under scorecards ─── */
.qs{display:flex;gap:20px;margin-top:16px;}
.qs-col{flex:1;display:flex;gap:8px;}
.qs-item{flex:1;text-align:center;padding:8px;background:var(--g50);border-radius:6px;}
.qs-val{font-size:15px;font-weight:700;color:var(--g800);}
.qs-label{font-size:9px;color:var(--g400);text-transform:uppercase;letter-spacing:0.06em;margin-top:1px;}

/* ─── Floor plan strip ─── */
.fp-strip{display:flex;gap:24px;margin-top:8px;}
.fp-card{flex:1;border:1.5px solid var(--g200);border-radius:8px;padding:16px;text-align:center;}
.fp-card-best{border-color:#6ee7b7;}
.fp-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.fp-card-name{font-size:13px;font-weight:700;color:var(--g800);}
.fp-card-score{padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;}
.fp-card-svg{display:flex;justify-content:center;align-items:center;}
.fp-card-svg svg{width:100%;height:auto;max-height:320px;}

/* ─── Factor table ─── */
.ft{width:100%;border-collapse:separate;border-spacing:0;}
.ft thead th{padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--g500);background:var(--g50);border-bottom:2px solid var(--g200);text-align:left;}
.ft thead th:first-child{width:160px;}
.fl{padding:12px;border-bottom:1px solid var(--g100);vertical-align:top;}
.fl-name{font-weight:600;font-size:12px;color:var(--g800);}
.fl-wt{font-size:10px;color:var(--g400);margin-top:1px;}
.fc{padding:12px;border-bottom:1px solid var(--g100);vertical-align:top;}
.fc-score{display:flex;align-items:baseline;gap:2px;margin-bottom:5px;font-size:14px;}
.fc-max{font-size:11px;color:var(--g400);}
.fc-best{color:#059669;font-size:8px;margin-left:3px;}
.fc-bar{width:100%;height:5px;background:var(--g100);border-radius:3px;overflow:hidden;margin-bottom:5px;}
.fc-fill{height:100%;border-radius:3px;}
.fc-detail{font-size:10px;color:var(--g500);line-height:1.35;}
.ft-total td{background:var(--g50);border-bottom:none;padding:10px 12px;}
.ft-total .fl-name{font-size:13px;}

/* ─── Findings ─── */
.flist{list-style:none;counter-reset:fi;}
.flist li{padding:12px 14px 12px 44px;position:relative;border-bottom:1px solid var(--g100);font-size:12px;color:var(--g700);line-height:1.6;}
.flist li::before{counter-increment:fi;content:counter(fi);position:absolute;left:12px;top:12px;width:20px;height:20px;border-radius:50%;background:var(--blue50);color:var(--blue);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.flist li strong{color:var(--g900);}

/* ─── Side-by-side detail issues ─── */
.issues-grid{display:flex;gap:24px;}
.issues-col{flex:1;min-width:0;}
.issues-col-header{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--g200);}
.issues-col-name{font-size:14px;font-weight:700;color:var(--g800);}
.issues-col-badge{padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;}
.ig{margin-bottom:10px;}
.ig-label{font-size:10px;font-weight:600;color:var(--g600);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;}
.ig-list{list-style:none;padding-left:10px;}
.ig-list li{font-size:11px;color:var(--g600);line-height:1.55;padding:2px 0 2px 10px;border-left:2px solid var(--g200);margin-bottom:2px;}
.sev{font-weight:700;font-size:9px;text-transform:uppercase;margin-right:3px;}
.sev-high{color:#b91c1c;}.sev-medium{color:#b45309;}.sev-low{color:#2563eb;}
.no-iss{font-size:12px;color:#059669;font-style:italic;padding:6px 10px;background:#f0fdf4;border-radius:4px;}
</style>
</head>
<body>
<div class="no-print pbar">
  <span>Comparative Layout Analysis — ${project.name}</span>
  <button onclick="window.print()">Print / Save PDF</button>
</div>
<div class="no-print pbar-spacer"></div>

<!-- ════════════════════ PAGE 1: COVER ════════════════════ -->
<div class="page cover">
  <div class="cover-top">
    <div class="cover-logo">FlowGrid Layout Planner</div>
    <div class="cover-date">${dateStr}<br>${timeStr}</div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
    <div class="cover-rule"></div>
    <h1>Comparative Layout Analysis</h1>
    <div class="cover-sub">${project.name}</div>
    <div class="cover-meta">
      ${s.facility_width} × ${s.facility_height} ${unit} facility — ${facilityArea.toLocaleString()} ${areaUnit}<br>
      ${layoutAnalyses.length} layouts evaluated across ${factorNames.length} scoring factors, ${best.score.maxTotal} total points
    </div>
    <div class="cover-kpis">
      <div><div class="kpi-val">${layoutAnalyses.length}</div><div class="kpi-label">Layouts Compared</div></div>
      <div><div class="kpi-val">${best.score.percentage}%</div><div class="kpi-label">Highest Score</div></div>
      <div><div class="kpi-val">${activities.length}</div><div class="kpi-label">Activities Defined</div></div>
      <div><div class="kpi-val">${doors.length}</div><div class="kpi-label">Door Openings</div></div>
      <div><div class="kpi-val">${activityRelationships.length}</div><div class="kpi-label">Relationships Rated</div></div>
    </div>
  </div>
  <div class="pf">
    <span>Confidential — For internal planning use only</span>
    <span>Page 1</span>
  </div>
</div>

<!-- ════════════════════ PAGE 2: EXECUTIVE SUMMARY + SCORES ════════════════════ -->
<div class="page">
  <div class="sh">
    <div class="sh-num">01</div>
    <div class="sh-title">Executive Summary</div>
    <div class="sh-rule"></div>
  </div>
  <div class="ebox">${execNarrative}</div>

  <div style="margin-top:36px;">
    <div class="sh">
      <div class="sh-num">02</div>
      <div class="sh-title">Overall Scores</div>
      <div class="sh-sub">${factorNames.length} weighted factors · ${best.score.maxTotal} total points</div>
      <div class="sh-rule"></div>
    </div>

    <div class="sc-strip">
      ${layoutAnalyses.map((la, i) => `
        <div class="sc ${i === 0 ? 'sc-best' : ''}">
          <div class="sc-rank ${i === 0 ? 'sc-rank-1' : 'sc-rank-n'}">${i === 0 ? '★ Recommended' : (i + 1) + (i === 1 ? 'nd' : i === 2 ? 'rd' : 'th')}</div>
          <div class="sc-name">${la.name}</div>
          <div class="sc-pct" style="color:${scoreColor(la.score.percentage)}">${la.score.percentage}%</div>
          <div class="sc-pts">${la.score.total} / ${la.score.maxTotal} pts</div>
          <div class="sc-verdict">${la.score.verdict}</div>
        </div>
      `).join('')}
    </div>

    <div class="qs">
      ${layoutAnalyses.map(la => `
        <div class="qs-col">
          <div class="qs-item"><div class="qs-val">${la.zoneCount}</div><div class="qs-label">Zones</div></div>
          <div class="qs-item"><div class="qs-val">${la.corridorCount}</div><div class="qs-label">Corridors</div></div>
          <div class="qs-item"><div class="qs-val">${la.zoneSqFt.toLocaleString()}</div><div class="qs-label">${areaUnit}</div></div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="pf">
    <span>${project.name} — Comparative Layout Analysis</span>
    <span>Page 2</span>
  </div>
</div>

<!-- ════════════════════ PAGE 3: FLOOR PLANS ════════════════════ -->
<div class="page">
  <div class="sh">
    <div class="sh-num">03</div>
    <div class="sh-title">Floor Plan Comparison</div>
    <div class="sh-sub">Side-by-side view of zone placement, corridors, and door positions</div>
    <div class="sh-rule"></div>
  </div>

  <div class="fp-strip">
    ${layoutAnalyses.map((la, i) => `
      <div class="fp-card ${i === 0 ? 'fp-card-best' : ''}">
        <div class="fp-card-header">
          <span class="fp-card-name">${la.name}</span>
          <span class="fp-card-score" style="background:${scoreBg(la.score.percentage)};color:${scoreColor(la.score.percentage)};border:1px solid ${scoreBorder(la.score.percentage)};">${la.score.percentage}%</span>
        </div>
        <div class="fp-card-svg">${la.svgMarkup}</div>
      </div>
    `).join('')}
  </div>

  <div class="pf">
    <span>${project.name} — Comparative Layout Analysis</span>
    <span>Page 3</span>
  </div>
</div>

<!-- ════════════════════ PAGE 4: FACTOR COMPARISON ════════════════════ -->
<div class="page">
  <div class="sh">
    <div class="sh-num">04</div>
    <div class="sh-title">Factor-by-Factor Comparison</div>
    <div class="sh-sub"><span style="color:#059669;">●</span> marks the leading layout in each category</div>
    <div class="sh-rule"></div>
  </div>

  <table class="ft">
    <thead>
      <tr>
        <th>Factor</th>
        ${layoutAnalyses.map(la => `<th>${la.name}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${factorRows}
      <tr class="ft-total">
        <td class="fl"><div class="fl-name">TOTAL SCORE</div></td>
        ${layoutAnalyses.map(la => `
          <td class="fc">
            <div class="fc-score">
              <span style="color:${scoreColor(la.score.percentage)};font-weight:800;font-size:18px;">${la.score.total}</span>
              <span class="fc-max">/ ${la.score.maxTotal}</span>
            </div>
          </td>
        `).join('')}
      </tr>
    </tbody>
  </table>

  <div class="pf">
    <span>${project.name} — Comparative Layout Analysis</span>
    <span>Page 4</span>
  </div>
</div>

<!-- ════════════════════ PAGE 5: FINDINGS + ISSUES ════════════════════ -->
<div class="page">
  ${findings.length > 0 ? `
  <div class="sh">
    <div class="sh-num">05</div>
    <div class="sh-title">Key Differences</div>
    <div class="sh-sub">Factors where layouts diverge in performance</div>
    <div class="sh-rule"></div>
  </div>
  <ol class="flist">${findings.map(f => `<li>${f}</li>`).join('')}</ol>
  <div style="margin-top:36px;"></div>
  ` : ''}

  <div class="sh">
    <div class="sh-num">${findings.length > 0 ? '06' : '05'}</div>
    <div class="sh-title">Detailed Issues by Layout</div>
    <div class="sh-sub">Side-by-side warnings and improvement opportunities</div>
    <div class="sh-rule"></div>
  </div>

  <div class="issues-grid">
    ${detailColumns.map(dc => `
      <div class="issues-col">
        <div class="issues-col-header">
          <span class="issues-col-name">${dc.name}</span>
          <span class="issues-col-badge" style="background:${scoreBg(dc.pct)};color:${scoreColor(dc.pct)};border:1px solid ${scoreBorder(dc.pct)};">${dc.pct}%</span>
        </div>
        ${dc.issues || '<div class="no-iss">No outstanding issues — all factors performing well.</div>'}
      </div>
    `).join('')}
  </div>

  <div class="pf">
    <span>${project.name} — Comparative Layout Analysis</span>
    <span>Page 5</span>
  </div>
</div>

</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
