import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, Layers, Clock, Trash2, Play, Pencil, FileText, ClipboardList, BarChart3 } from 'lucide-react';
import { exportComparativeAnalysis } from '../utils/comparativeExport';
import { exportSetupInstructions } from '../utils/setupInstructionsExport';
import { generateLayoutSvg } from '../utils/layoutThumbnail';
import { calculateLayoutScore } from '../utils/scoring';
import { Activity, ActivityRelationship, VolumeTiming, Zone, Corridor, Door } from '../types';

interface Layout {
  id: string;
  project_id: string;
  name: string;
  score_percentage: number | null;
  created_at: string;
  updated_at: string;
}

interface ProjectDetails {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface FoundationSummary {
  facility_width: number | null;
  facility_height: number | null;
  square_size: number | null;
  measurement_system: string | null;
  activity_count: number;
  door_count: number;
  relationship_count: number;
}

interface ProjectDashboardProps {
  projectId: string;
  onOpenLayout: (projectId: string, layoutId: string, startStep?: '2a' | '2f') => void;
  onBackToHome: () => void;
}

export function ProjectDashboard({ projectId, onOpenLayout, onBackToHome }: ProjectDashboardProps) {
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [foundation, setFoundation] = useState<FoundationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [tempProjectName, setTempProjectName] = useState('');
  const [exportingLayout, setExportingLayout] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [projectId]);

  const loadDashboard = async () => {
    setLoading(true);

    const [projectRes, layoutsRes, settingsRes, activitiesRes, doorsRes, relsRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('layouts').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('app_settings').select('facility_width, facility_height, square_size, measurement_system').eq('project_id', projectId).maybeSingle(),
      supabase.from('activities').select('id').eq('project_id', projectId),
      supabase.from('doors').select('id').eq('project_id', projectId),
      supabase.from('activity_relationships').select('id').eq('project_id', projectId),
    ]);

    if (projectRes.data) setProject(projectRes.data);
    if (layoutsRes.data) setLayouts(layoutsRes.data);

    setFoundation({
      facility_width: settingsRes.data?.facility_width ?? null,
      facility_height: settingsRes.data?.facility_height ?? null,
      square_size: settingsRes.data?.square_size ?? null,
      measurement_system: settingsRes.data?.measurement_system ?? null,
      activity_count: activitiesRes.data?.length ?? 0,
      door_count: doorsRes.data?.length ?? 0,
      relationship_count: relsRes.data?.length ?? 0,
    });

    setLoading(false);
  };

  const handleCreateLayout = async () => {
    const nextNum = layouts.length + 1;
    const { data, error } = await supabase
      .from('layouts')
      .insert({ project_id: projectId, name: `Layout ${nextNum}` })
      .select()
      .single();

    if (error) {
      console.error('Error creating layout:', error);
      return;
    }

    if (data) {
      onOpenLayout(projectId, data.id, '2f');
    }
  };

  const handleDeleteLayout = async (e: React.MouseEvent, layoutId: string) => {
    e.stopPropagation();
    if (layouts.length <= 1) {
      alert('Cannot delete the only layout. A project must have at least one.');
      return;
    }
    if (!confirm('Delete this layout and all its zones/corridors/objects? This cannot be undone.')) return;

    await Promise.all([
      supabase.from('zones').delete().eq('layout_id', layoutId),
      supabase.from('corridors').delete().eq('layout_id', layoutId),
      supabase.from('placed_objects').delete().eq('layout_id', layoutId),
    ]);
    await supabase.from('layouts').delete().eq('id', layoutId);
    setLayouts(prev => prev.filter(l => l.id !== layoutId));
  };

  const handleRenameLayout = async (layoutId: string) => {
    const name = tempName.trim();
    if (!name) { setEditingName(null); return; }
    await supabase.from('layouts').update({ name }).eq('id', layoutId);
    setLayouts(prev => prev.map(l => l.id === layoutId ? { ...l, name } : l));
    setEditingName(null);
  };

  const handleRenameProject = async () => {
    const name = tempProjectName.trim();
    if (!name || !project) { setEditingProjectName(false); return; }
    await supabase.from('projects').update({ name }).eq('id', project.id);
    setProject(prev => prev ? { ...prev, name } : prev);
    setEditingProjectName(false);
  };

  // Load layout data from DB and export Setup Instructions
  const handleExportSetupInstructions = async (e: React.MouseEvent, layoutId: string) => {
    e.stopPropagation();
    setExportingLayout(layoutId);

    const [settingsRes, zonesRes, activitiesRes, corridorsRes, doorsRes] = await Promise.all([
      supabase.from('app_settings').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('zones').select('*').eq('layout_id', layoutId),
      supabase.from('activities').select('*').eq('project_id', projectId),
      supabase.from('corridors').select('*').eq('layout_id', layoutId),
      supabase.from('doors').select('*').eq('project_id', projectId),
    ]);

    const s = settingsRes.data;
    if (!s) { alert('No settings found.'); setExportingLayout(null); return; }

    exportSetupInstructions({
      zones: (zonesRes.data || []) as Zone[],
      activities: (activitiesRes.data || []) as Activity[],
      corridors: (corridorsRes.data || []) as Corridor[],
      doors: (doorsRes.data || []) as Door[],
      facilityWidth: s.facility_width,
      facilityHeight: s.facility_height,
      squareSize: s.square_size,
    });

    setExportingLayout(null);
  };

  // Export Floor Plan directly from DB data (no navigation needed)
  const handleExportFloorPlan = async (e: React.MouseEvent, layoutId: string) => {
    e.stopPropagation();
    setExportingLayout(layoutId);

    const [settingsRes, zonesRes, activitiesRes, corridorsRes, doorsRes, paintedRes, volumeRes, relsRes, layoutRes] = await Promise.all([
      supabase.from('app_settings').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('zones').select('*').eq('layout_id', layoutId),
      supabase.from('activities').select('*').eq('project_id', projectId),
      supabase.from('corridors').select('*').eq('layout_id', layoutId),
      supabase.from('doors').select('*').eq('project_id', projectId),
      supabase.from('painted_squares').select('*').eq('project_id', projectId),
      supabase.from('volume_timing').select('*').eq('project_id', projectId),
      supabase.from('activity_relationships').select('*').eq('project_id', projectId),
      supabase.from('layouts').select('dismissed_flags').eq('id', layoutId).single(),
    ]);

    const s = settingsRes.data;
    if (!s) { alert('No settings found.'); setExportingLayout(null); return; }

    const zones = (zonesRes.data || []) as Zone[];
    const activities = (activitiesRes.data || []) as Activity[];
    const corridors = (corridorsRes.data || []) as Corridor[];
    const doors = (doorsRes.data || []) as Door[];
    const volumeTiming = (volumeRes.data || []) as VolumeTiming[];
    const activityRelationships = (relsRes.data || []) as ActivityRelationship[];

    const paintedSquares = new Map<string, { type: 'permanent' | 'semi-fixed' }>();
    (paintedRes.data || []).forEach((sq: any) => {
      paintedSquares.set(`${sq.row}-${sq.col}`, { type: sq.type });
    });

    const gridDims = {
      rows: Math.floor(s.facility_height / s.square_size),
      cols: Math.floor(s.facility_width / s.square_size),
    };

    const dismissedFlags = new Set<string>(
      Array.isArray(layoutRes.data?.dismissed_flags) ? layoutRes.data.dismissed_flags : []
    );

    const scoreData = calculateLayoutScore(
      zones, activities,
      { squareSize: s.square_size, facilityWidth: s.facility_width, facilityHeight: s.facility_height },
      activityRelationships, volumeTiming, doors, corridors, paintedSquares, gridDims, dismissedFlags
    );

    // Generate SVG from data
    const svgMarkup = generateLayoutSvg({
      zones, corridors, doors, activities, paintedSquares,
      gridRows: gridDims.rows, gridCols: gridDims.cols,
      squareSize: s.square_size,
      facilityWidth: s.facility_width,
      facilityHeight: s.facility_height,
    });

    const layoutObj = layouts.find(l => l.id === layoutId);
    const layoutName = layoutObj?.name || 'Layout';

    // Build and open the print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow popups to export.'); setExportingLayout(null); return; }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const unit = s.measurement_system === 'Metric' ? 'm' : 'ft';
    const facilityDims = `${s.facility_width} × ${s.facility_height} ${unit}`;
    const gridSize = `${s.square_size} ${unit} per square`;

    const scoreColor = (pct: number) => pct >= 85 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
    const sd = scoreData;

    const html = `<!DOCTYPE html>
<html><head><title>Floor Plan — ${layoutName}</title>
<style>
@page { size: landscape; margin: 0.5in; }
@media print { .no-print { display: none !important; } .page { page-break-after: always; } .page:last-child { page-break-after: auto; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; }
.pbar { position: fixed; top: 0; left: 0; right: 0; background: #1f2937; color: white; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 100; font-size: 13px; }
.pbar button { padding: 7px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
.spacer { height: 46px; }
.page { padding: 40px 52px; position: relative; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #e5e7eb; }
.header h1 { font-size: 22px; font-weight: 700; }
.header .sub { font-size: 13px; color: #6b7280; margin-top: 2px; }
.meta { text-align: right; font-size: 12px; color: #6b7280; line-height: 1.7; }
.plan-svg { text-align: center; margin: 0 auto; }
.plan-svg svg { max-width: 100%; max-height: 60vh; height: auto; display: block; margin: 0 auto; }
.footer { position: absolute; bottom: 28px; left: 52px; right: 52px; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
.score-summary { display: flex; align-items: center; gap: 24px; margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; }
.score-circle { width: 80px; height: 80px; border-radius: 50%; border: 4px solid; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; background: white; }
.score-pct { font-size: 24px; font-weight: 700; }
.score-pts { font-size: 11px; color: #6b7280; }
.verdict-text { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.score-stats { font-size: 13px; color: #6b7280; }
.ft { width: 100%; border-collapse: collapse; font-size: 13px; }
.ft th { text-align: left; padding: 8px 10px; background: #f3f4f6; border-bottom: 2px solid #d1d5db; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
.ft td { padding: 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
.fn { font-weight: 600; }
.fq { font-size: 11px; color: #9ca3af; }
.sn { font-weight: 700; font-size: 14px; }
.sm { color: #9ca3af; }
.detail-list { padding: 4px 0 8px 0; }
.detail-item { font-size: 12px; color: #4b5563; padding: 3px 8px; border-left: 3px solid #d1d5db; margin-bottom: 4px; background: #f9fafb; }
.flag-item { font-size: 12px; padding: 6px 8px; margin-bottom: 4px; border-left: 3px solid; background: #f9fafb; }
.flag-high { border-color: #dc2626; } .flag-medium { border-color: #d97706; } .flag-low { border-color: #3b82f6; }
.flag-sev { font-weight: 700; font-size: 10px; text-transform: uppercase; margin-right: 6px; }
.flag-msg { font-weight: 600; }
.flag-rec { font-size: 11px; color: #6b7280; margin-top: 2px; }
</style></head><body>
<div class="no-print pbar"><span>Floor Plan — ${layoutName}</span><button onclick="window.print()">Print / Save PDF</button></div>
<div class="no-print spacer"></div>

<!-- PAGE 1: Floor Plan -->
<div class="page">
  <div class="header">
    <div><h1>${layoutName} — Floor Plan</h1><div class="sub">${project.name} · FlowGrid Layout Planner</div></div>
    <div class="meta">${dateStr}<br>${timeStr}<br>${facilityDims}<br>Grid: ${gridSize}</div>
  </div>
  <div class="plan-svg">${svgMarkup}</div>
  <div class="footer"><span>Generated by FlowGrid Layout Planner</span><span>Verify measurements on site</span></div>
</div>

<!-- PAGE 2: Score Report -->
<div class="page">
  <div class="header">
    <div><h1>${layoutName} — Score Report</h1><div class="sub">${project.name}</div></div>
    <div class="meta">${dateStr}<br>${timeStr}</div>
  </div>
  <div class="score-summary">
    <div class="score-circle" style="border-color:${scoreColor(sd.percentage)}">
      <div class="score-pct">${sd.percentage}%</div>
      <div class="score-pts">${sd.total} / ${sd.maxTotal}</div>
    </div>
    <div>
      <div class="verdict-text">${sd.verdict}</div>
      <div class="score-stats">${zones.filter(z => z.activity_id).length} zones · ${corridors.length} corridors · ${doors.length} doors · ${facilityDims}</div>
    </div>
  </div>
  <table class="ft"><thead><tr><th style="width:30px"></th><th>Factor</th><th style="width:80px">Score</th><th>Summary</th></tr></thead><tbody>
  ${sd.factors.map(f => {
    const pct = f.maxScore > 0 ? (f.score / f.maxScore) * 100 : 0;
    const icon = pct >= 90 ? '✓' : pct >= 50 ? '⚠' : '✗';
    const ic = pct >= 90 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
    const fName = f.label.split(':')[0];
    const fQ = f.label.split(':')[1]?.trim() || '';
    let rows = `<tr><td style="text-align:center"><span style="color:${ic};font-weight:bold;font-size:16px">${icon}</span></td><td><div class="fn">${fName}</div><div class="fq">${fQ}</div></td><td><span class="sn" style="color:${ic}">${f.score}</span> <span class="sm">/ ${f.maxScore}</span></td><td style="color:#4b5563">${f.display}</td></tr>`;
    if (f.details.length > 0) {
      rows += `<tr><td></td><td colspan="3"><div class="detail-list">${f.details.map(d => `<div class="detail-item">${d}</div>`).join('')}</div></td></tr>`;
    }
    if (f.flags && f.flags.filter(fl => !fl.isDismissed).length > 0) {
      rows += `<tr><td></td><td colspan="3"><div class="detail-list">${f.flags.filter(fl => !fl.isDismissed).map(fl => `<div class="flag-item flag-${fl.severity.toLowerCase()}"><span class="flag-sev">${fl.severity}</span><span class="flag-msg">${fl.message}</span><div class="flag-rec">${fl.recommendation}</div></div>`).join('')}</div></td></tr>`;
    }
    return rows;
  }).join('')}
  </tbody></table>
  <div class="footer"><span>${project.name} — ${layoutName}</span><span>Score Report</span></div>
</div>
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setExportingLayout(null);
  };

  const handleComparativeAnalysis = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await exportComparativeAnalysis(projectId);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 85) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const getUnit = () => foundation?.measurement_system === 'Metric' ? 'm' : 'ft';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="text-gray-500">Loading project...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="text-red-500">Project not found</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            All Projects
          </button>
          <div className="flex items-center justify-between">
            <div>
              {editingProjectName ? (
                <input
                  type="text"
                  value={tempProjectName}
                  onChange={(e) => setTempProjectName(e.target.value)}
                  onBlur={handleRenameProject}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameProject(); if (e.key === 'Escape') setEditingProjectName(false); }}
                  className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2">
                  <h1
                    className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => { setEditingProjectName(true); setTempProjectName(project.name); }}
                  >
                    {project.name}
                  </h1>
                  <button
                    onClick={() => { setEditingProjectName(true); setTempProjectName(project.name); }}
                    className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                    title="Rename project"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Created {formatDate(project.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Foundation Summary */}
        {foundation && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Foundation</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">Facility Size</div>
                <div className="text-lg font-bold text-gray-900">
                  {foundation.facility_width && foundation.facility_height
                    ? `${foundation.facility_width} × ${foundation.facility_height} ${getUnit()}`
                    : 'Not set'}
                </div>
                {foundation.square_size && (
                  <div className="text-xs text-gray-400 mt-0.5">{foundation.square_size} {getUnit()} squares</div>
                )}
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">Activities</div>
                <div className="text-lg font-bold text-gray-900">{foundation.activity_count}</div>
                <div className="text-xs text-gray-400 mt-0.5">defined</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">Doors</div>
                <div className="text-lg font-bold text-gray-900">{foundation.door_count}</div>
                <div className="text-xs text-gray-400 mt-0.5">marked</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">Relationships</div>
                <div className="text-lg font-bold text-gray-900">{foundation.relationship_count}</div>
                <div className="text-xs text-gray-400 mt-0.5">rated</div>
              </div>
            </div>
          </div>
        )}

        {/* Layouts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Layouts</h2>
            <div className="flex items-center gap-2">
              {layouts.length >= 2 && (
                <button
                  onClick={handleComparativeAnalysis}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Compare Layouts
                </button>
              )}
              <button
                onClick={handleCreateLayout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Blank Layout
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {layouts.map((layout) => (
              <div
                key={layout.id}
                onClick={() => onOpenLayout(projectId, layout.id)}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Score badge */}
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${getScoreColor(layout.score_percentage)}`}>
                      {layout.score_percentage !== null ? (
                        <span className="text-xl font-bold">{layout.score_percentage}%</span>
                      ) : (
                        <Layers className="w-6 h-6 opacity-50" />
                      )}
                    </div>

                    <div className="min-w-0">
                      {editingName === layout.id ? (
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onBlur={() => handleRenameLayout(layout.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameLayout(layout.id); if (e.key === 'Escape') setEditingName(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-lg font-semibold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {layout.name}
                          </h3>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingName(layout.id); setTempName(layout.name); }}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                            title="Rename layout"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(layout.updated_at)}
                        </span>
                        {layout.score_percentage === null && (
                          <span className="text-xs text-gray-400 italic">No score yet — open to build</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-4">
                    {/* Per-layout exports */}
                    <button
                      onClick={(e) => handleExportFloorPlan(e, layout.id)}
                      className={`p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${exportingLayout === layout.id ? 'animate-pulse' : ''}`}
                      title="Export Floor Plan PDF"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleExportSetupInstructions(e, layout.id)}
                      className={`p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${exportingLayout === layout.id ? 'animate-pulse' : ''}`}
                      title="Export Setup Instructions"
                    >
                      <ClipboardList className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteLayout(e, layout.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete layout"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenLayout(projectId, layout.id); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Open
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {layouts.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No layouts yet. Create one to start arranging zones.</p>
              <button
                onClick={handleCreateLayout}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Blank Layout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
