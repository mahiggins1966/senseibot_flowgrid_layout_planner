import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, FolderOpen, Clock, Layers, ArrowRight, Trash2 } from 'lucide-react';
import { CONSUSONE_LOGO } from '../constants/branding';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface LayoutSummary {
  id: string;
  name: string;
  score_percentage: number | null;
}

interface ProjectWithMeta extends Project {
  layouts: LayoutSummary[];
  facility_width: number | null;
  facility_height: number | null;
  square_size: number | null;
  activity_count: number;
}

interface HomeScreenProps {
  onOpenProject: (projectId: string) => void;
}

export function HomeScreen({ onOpenProject }: HomeScreenProps) {
  const [projects, setProjects] = useState<ProjectWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);

    const { data: projectRows, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (projectError || !projectRows) {
      console.error('Error loading projects:', projectError);
      setLoading(false);
      return;
    }

    // For each project, load layouts, settings, and activity count
    const enriched: ProjectWithMeta[] = await Promise.all(
      projectRows.map(async (project) => {
        const [layoutsRes, settingsRes, activitiesRes] = await Promise.all([
          supabase.from('layouts').select('id, name, score_percentage').eq('project_id', project.id).order('created_at', { ascending: true }),
          supabase.from('app_settings').select('facility_width, facility_height, square_size').eq('project_id', project.id).maybeSingle(),
          supabase.from('activities').select('id').eq('project_id', project.id),
        ]);

        return {
          ...project,
          layouts: (layoutsRes.data || []) as LayoutSummary[],
          facility_width: settingsRes.data?.facility_width ?? null,
          facility_height: settingsRes.data?.facility_height ?? null,
          square_size: settingsRes.data?.square_size ?? null,
          activity_count: activitiesRes.data?.length ?? 0,
        };
      })
    );

    setProjects(enriched);
    setLoading(false);
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim() || 'New Project';

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({ name })
      .select()
      .single();

    if (projectError || !project) {
      console.error('Error creating project:', projectError);
      return;
    }

    // Create default settings for the project
    await supabase.from('app_settings').insert({
      project_id: project.id,
      facility_width: 155,
      facility_height: 155,
      square_size: 5,
      measurement_system: 'US',
      typical_flow_unit: 'box',
      unit_footprint_sqft: 4,
      stacking_height: 1,
      access_factor: 1.3,
    });

    // Create "Layout 1" for the project
    const { data: layout, error: layoutError } = await supabase
      .from('layouts')
      .insert({ project_id: project.id, name: 'Layout 1' })
      .select()
      .single();

    if (layoutError || !layout) {
      console.error('Error creating layout:', layoutError);
      return;
    }

    setCreatingProject(false);
    setNewProjectName('');

    // Open the new project dashboard immediately
    onOpenProject(project.id);
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this project and all its layouts? This cannot be undone.')) return;

    await supabase.from('projects').delete().eq('id', projectId);
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const handleOpenProject = (project: ProjectWithMeta) => {
    onOpenProject(project.id);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getBestScore = (layouts: LayoutSummary[]) => {
    const scores = layouts.map(l => l.score_percentage).filter((s): s is number => s !== null);
    return scores.length > 0 ? Math.max(...scores) : null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 w-56">
              <img src={CONSUSONE_LOGO} alt="ConsusOne" className="h-11" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">FlowGrid Layout Planner</h1>
            <div className="w-56" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Your Projects</h2>
          <button
            onClick={() => setCreatingProject(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* New Project Dialog */}
        {creatingProject && (
          <div className="mb-8 bg-white border-2 border-blue-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Create New Project</h3>
            <p className="text-sm text-gray-600 mb-4">
              A project represents one facility. You'll set up the floor, list activities, and build layouts inside it.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                placeholder="Project name (e.g., Kamaka Air HNL)"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                autoFocus
              />
              <button
                onClick={handleCreateProject}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => { setCreatingProject(false); setNewProjectName(''); }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-gray-500">
            Loading projects...
          </div>
        )}

        {/* Empty State */}
        {!loading && projects.length === 0 && (
          <div className="text-center py-16">
            <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No projects yet</h2>
            <p className="text-gray-500 mb-6">Create your first project to start planning a facility layout.</p>
            <button
              onClick={() => setCreatingProject(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        )}

        {/* Project Cards */}
        {!loading && projects.length > 0 && (
          <div className="grid gap-4">
            {projects.map((project) => {
              const bestScore = getBestScore(project.layouts);

              return (
                <div
                  key={project.id}
                  onClick={() => handleOpenProject(project)}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Top row: name + meta */}
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h3>
                      </div>

                      {/* Details row */}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {project.facility_width && project.facility_height && (
                          <span>{project.facility_width} × {project.facility_height} ft</span>
                        )}
                        {project.activity_count > 0 && (
                          <span>{project.activity_count} activities</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          {project.layouts.length} {project.layouts.length === 1 ? 'layout' : 'layouts'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(project.updated_at)}
                        </span>
                      </div>

                      {/* Layout pills */}
                      {project.layouts.length > 0 && (
                        <div className="flex items-center gap-2 mt-3">
                          {project.layouts.map((layout) => (
                            <span
                              key={layout.id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
                            >
                              {layout.name}
                              {layout.score_percentage !== null && (
                                <span className={`font-bold ${
                                  layout.score_percentage >= 85 ? 'text-green-600' :
                                  layout.score_percentage >= 60 ? 'text-amber-600' :
                                  'text-red-600'
                                }`}>
                                  {layout.score_percentage}%
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right side: actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
