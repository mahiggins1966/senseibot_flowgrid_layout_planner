import { useEffect, useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { ProjectDashboard } from './components/ProjectDashboard';
import { StepBar } from './components/StepBar';
import { StepRouter } from './components/StepRouter';
import { ObjectPopup } from './components/ObjectPopup';
import { ZoneEditor } from './components/ZoneEditor';
import { useGridStore } from './store/gridStore';
import { supabase } from './lib/supabase';

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
  } = useGridStore();

  const [view, setView] = useState<AppView>('home');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [currentSubStep, setCurrentSubStep] = useState<SubStep>('2a');
  const [gridHelpDismissed, setGridHelpDismissed] = useState(false);

  useEffect(() => {
    setStoreSubStep(currentSubStep);
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
    setView('editor');
  };

  // Load data when we enter the editor
  useEffect(() => {
    if (view === 'editor') {
      loadSettings();
      loadActivities();
      loadVolumeTiming();
      loadActivityRelationships();

      // Load dismissed flags for this layout
      const layoutId = useGridStore.getState().activeLayoutId;
      if (layoutId) {
        supabase
          .from('layouts')
          .select('dismissed_flags')
          .eq('id', layoutId)
          .single()
          .then(({ data }) => {
            if (data?.dismissed_flags && Array.isArray(data.dismissed_flags)) {
              useGridStore.setState({ dismissedFlags: new Set(data.dismissed_flags) });
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

      {needsGrid && !gridHelpDismissed && (
        <div className="absolute top-14 left-[340px] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-3 text-xs text-gray-700 border border-gray-200 z-40" style={{ maxWidth: '260px' }}>
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
