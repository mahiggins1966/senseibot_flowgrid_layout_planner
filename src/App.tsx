import { useEffect, useState } from 'react';
import { StepBar } from './components/StepBar';
import { StepRouter } from './components/StepRouter';
import { ObjectPopup } from './components/ObjectPopup';
import { ZoneEditor } from './components/ZoneEditor';
import { useGridStore } from './store/gridStore';

type SubStep = '2a' | '2b' | '2c' | '2d' | '2e' | '2f';

function App() {
  const { loadSettings, loadActivities, loadVolumeTiming, loadActivityRelationships, setCurrentSubStep: setStoreSubStep } = useGridStore();
  const [currentSubStep, setCurrentSubStep] = useState<SubStep>('2a');

  useEffect(() => {
    loadSettings();
    loadActivities();
    loadVolumeTiming();
    loadActivityRelationships();
  }, [loadSettings, loadActivities, loadVolumeTiming, loadActivityRelationships]);

  useEffect(() => {
    setStoreSubStep(currentSubStep);
  }, [currentSubStep, setStoreSubStep]);

  const handleSubStepChange = (subStep: SubStep) => {
    setCurrentSubStep(subStep);
  };

  const needsGrid = ['2a', '2b', '2f'].includes(currentSubStep);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden">
      <StepBar
        currentSubStep={currentSubStep}
        onSubStepChange={handleSubStepChange}
      />

      <div className="flex-1 overflow-hidden">
        <StepRouter
          currentSubStep={currentSubStep}
          onSubStepChange={handleSubStepChange}
        />
      </div>

      <ObjectPopup />
      <ZoneEditor />

      {needsGrid && (
        <div className="absolute bottom-4 left-[400px] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 text-xs text-gray-700 border border-gray-200">
          <div className="font-medium mb-1">Grid Controls:</div>
          <div className="space-y-0.5 text-[10px]">
            <div>Scroll to zoom, Shift+Drag to pan</div>
            <div>Touch: Pinch zoom, Two-finger pan</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
