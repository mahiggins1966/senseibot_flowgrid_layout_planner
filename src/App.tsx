import { useEffect, useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { ProjectDashboard } from './components/ProjectDashboard';
import { StepBar } from './components/StepBar';
import { StepRouter } from './components/StepRouter';
import { ObjectPopup } from './components/ObjectPopup';
import { ZoneEditor } from './components/ZoneEditor';
import { useGridStore } from './store/gridStore';
import { supabase } from './lib/supabase';
import { Route } from 'lucide-react';
import { CONSUSONE_LOGO } from './constants/branding';

type SubStep = '2a' | '2b' | '2c' | '2d' | '2e' | '2f';
type AppView = 'home' | 'dashboard' | 'editor';

function App() {
  const {
    loadSettings,
    loadActivities,
    loadVolumeTiming,
    loadActivityRelationships,
    setCurrentSubStep: setStoreSubStep,
    setActiveProject,
    setActiveLayout,
    flowOverlayEnabled,
    toggleFlowOverlay,
  } = useGridStore();

  const [view, setView] = useState<AppView>('home');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [currentSubStep, setCurrentSubStep] = useState<SubStep>('2a');
  const [gridHelpDismissed, setGridHelpDismissed] = useState(true);

  useEffect(() => {
    setStoreSubStep(currentSubStep);
    // Turn off flow overlay when leaving layout page
    if (currentSubStep !== '2f') {
      useGridStore.setState({ flowOverlayEnabled: false });
    }
  }, [currentSubStep, setStoreSubStep]);

  // Home → Dashboard
  const handleOpenProjectDashboard = (projectId: string) => {
    setActiveProjectId(projectId);
    setView('dashboard');
  };

  // Dashboard → Editor (or Home → Editor shortcut)
  const handleOpenLayout = (projectId: string, layoutId: string, startStep?: '2a' | '2f') => {
    setActiveProjectId(projectId);
    setActiveProject(projectId);
    setActiveLayout(layoutId);
    setCurrentSubStep(startStep || '2a');
    // Reset flow overlay to OFF — layout-specific paths loaded in useEffect
    useGridStore.setState({ flowOverlayEnabled: false });
    setView('editor');
  };

  // Load data when we enter the editor
  useEffect(() => {
    if (view === 'editor') {
      loadSettings();
      loadActivities();
      loadVolumeTiming();
      loadActivityRelationships();

      // Load dismissed flags and flow paths for this layout
      const layoutId = useGridStore.getState().activeLayoutId;
      const projectId = useGridStore.getState().activeProjectId;
      if (layoutId) {
        // Load layout data (flags + flow paths) and doors in parallel, then apply
        Promise.all([
          supabase.from('layouts').select('dismissed_flags, flow_paths').eq('id', layoutId).single(),
          supabase.from('doors').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
        ]).then(([layoutRes, doorsRes]) => {
          // Apply dismissed flags
          if (layoutRes.data?.dismissed_flags && Array.isArray(layoutRes.data.dismissed_flags)) {
            useGridStore.setState({ dismissedFlags: new Set(layoutRes.data.dismissed_flags) });
          }

          // Set doors first (with flow points cleared)
          if (doorsRes.data) {
            const cleanDoors = doorsRes.data.map((d: any) => ({
              ...d,
              inbound_flow_points: null,
              outbound_flow_points: null,
            }));
            useGridStore.getState().setDoors(cleanDoors);

            // Then apply layout-specific flow paths
            const flowPaths = (layoutRes.data?.flow_paths || {}) as Record<string, Array<{ x: number; y: number }>>;
            for (const door of cleanDoors) {
              const inKey = `${door.id}_inbound`;
              const outKey = `${door.id}_outbound`;
              if (flowPaths[inKey] || flowPaths[outKey]) {
                useGridStore.getState().updateDoor(door.id, {
                  inbound_flow_points: flowPaths[inKey] || null,
                  outbound_flow_points: flowPaths[outKey] || null,
                } as any);
              }
            }
          }
        });
      }
    }
  }, [view, loadSettings, loadActivities, loadVolumeTiming, loadActivityRelationships]);

  const handleBackToHome = () => {
    setView('home');
    setActiveProjectId(null);
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
  };

  const handleTryAnotherLayout = async () => {
    if (!activeProjectId) return;

    // Count existing layouts to name the new one
    const { data: existingLayouts } = await supabase
      .from('layouts')
      .select('id')
      .eq('project_id', activeProjectId);

    const nextNum = (existingLayouts?.length || 0) + 1;

    const { data: layout, error } = await supabase
      .from('layouts')
      .insert({ project_id: activeProjectId, name: `Layout ${nextNum}` })
      .select()
      .single();

    if (error || !layout) {
      console.error('Error creating layout:', error);
      return;
    }

    // Switch to the new layout
    setActiveLayout(layout.id);
    setCurrentSubStep('2f');

    // Reset flow overlay to OFF and clear flow paths from doors in memory (new layout has none)
    useGridStore.setState({ flowOverlayEnabled: false });
    const currentDoors = useGridStore.getState().doors;
    for (const door of currentDoors) {
      useGridStore.getState().updateDoor(door.id, {
        inbound_flow_points: null,
        outbound_flow_points: null,
      } as any);
    }

    // Reload data for new layout (foundation stays, layout data resets)
    loadSettings();
    loadActivities();
    loadVolumeTiming();
    loadActivityRelationships();
  };

  const handleSubStepChange = (subStep: SubStep) => {
    setCurrentSubStep(subStep);
  };

  // Home screen
  if (view === 'home') {
    return <HomeScreen onOpenProject={handleOpenProjectDashboard} />;
  }

  // Project dashboard
  if (view === 'dashboard' && activeProjectId) {
    return (
      <ProjectDashboard
        projectId={activeProjectId}
        onOpenLayout={handleOpenLayout}
        onBackToHome={handleBackToHome}
      />
    );
  }

  // Editor view
  const needsGrid = ['2a', '2b', '2f'].includes(currentSubStep);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden">
      {/* Brand header */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center">
        <div className="w-56">
          <button onClick={handleBackToHome} className="cursor-pointer" title="Back to Home">
            <img src={CONSUSONE_LOGO} alt="ConsusOne" className="h-11" />
          </button>
        </div>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-gray-900">FlowGrid Layout Planner</h1>
        </div>
        <div className="w-56" />
      </div>

      <StepBar
        currentSubStep={currentSubStep}
        onSubStepChange={handleSubStepChange}
        onBackToHome={handleBackToDashboard}
      />

      <div className="flex-1 overflow-hidden">
        <StepRouter
          currentSubStep={currentSubStep}
          onSubStepChange={handleSubStepChange}
          onTryAnotherLayout={handleTryAnotherLayout}
        />
      </div>

      <ObjectPopup />
      <ZoneEditor />

      {needsGrid && gridHelpDismissed && (
        <button
          onClick={() => setGridHelpDismissed(false)}
          className="absolute top-[7.5rem] left-[340px] z-40 flex items-center px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-white transition-colors text-xs font-semibold"
          title="Show grid controls"
        >
          Grid Controls
        </button>
      )}

      {currentSubStep === '2f' && (
        <button
          onClick={toggleFlowOverlay}
          className={`absolute top-[7.5rem] z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg border text-xs font-semibold transition-colors ${
            flowOverlayEnabled
              ? 'bg-slate-700 text-white border-slate-600 hover:bg-slate-800'
              : 'bg-white/95 backdrop-blur-sm text-gray-500 border-gray-200 hover:text-gray-800 hover:bg-white'
          }`}
          style={{ left: gridHelpDismissed ? '470px' : '615px' }}
          title="Toggle material flow overlay"
        >
          <Route className="w-3.5 h-3.5" />
          Flow
        </button>
      )}

      {needsGrid && !gridHelpDismissed && (
        <div className="absolute top-[7.5rem] left-[340px] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-3 text-xs text-gray-700 border border-gray-200 z-40" style={{ maxWidth: '260px' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-900 text-sm">Grid Controls</span>
            <button
              onClick={() => setGridHelpDismissed(true)}
              className="text-gray-400 hover:text-gray-600 transition-colors leading-none text-base"
              title="Dismiss"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-[11px] text-gray-600">
            <div>
              <div className="font-semibold text-gray-800 mb-0.5">Move Around</div>
              <div>Scroll to pan up &amp; down</div>
              <div>Shift + Scroll to pan left &amp; right</div>
              <div>Space + Drag for free movement</div>
            </div>
            <div>
              <div className="font-semibold text-gray-800 mb-0.5">Zoom In / Out</div>
              <div>Ctrl + Scroll (Cmd on Mac)</div>
              <div>Trackpad pinch gesture</div>
            </div>
            <div>
              <div className="font-semibold text-gray-800 mb-0.5">Zones &amp; Objects</div>
              <div>Click to select</div>
              <div>Hold + Drag to move</div>
              <div>Hover a zone to show resize handles</div>
            </div>
            <div className="pt-1 border-t border-gray-200 text-gray-400">
              Press <strong className="text-gray-600">Esc</strong> to cancel any active tool
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
