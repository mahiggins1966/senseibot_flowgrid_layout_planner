import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, Layers, Clock, Trash2, Play, Pencil } from 'lucide-react';

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
  onOpenLayout: (projectId: string, layoutId: string) => void;
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
      setLayouts(prev => [...prev, data]);
    }
  };

  const handleDeleteLayout = async (e: React.MouseEvent, layoutId: string) => {
    e.stopPropagation();
    if (layouts.length <= 1) {
      alert('Cannot delete the only layout. A project must have at least one.');
      return;
    }
    if (!confirm('Delete this layout and all its zones/corridors/objects? This cannot be undone.')) return;

    // Delete layout-scoped data first, then the layout
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
                <div className="flex items-center gap-2 group/name">
                  <h1
                    className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => { setEditingProjectName(true); setTempProjectName(project.name); }}
                  >
                    {project.name}
                  </h1>
                  <button
                    onClick={() => { setEditingProjectName(true); setTempProjectName(project.name); }}
                    className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors opacity-0 group-hover/name:opacity-100"
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
            <button
              onClick={handleCreateLayout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Blank Layout
            </button>
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
                        <h3
                          className="text-lg font-semibold text-gray-900 truncate"
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingName(layout.id); setTempName(layout.name); }}
                          title="Double-click to rename"
                        >
                          {layout.name}
                        </h3>
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
