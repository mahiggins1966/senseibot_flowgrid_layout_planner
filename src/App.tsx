import { useEffect, useState } from 'react';
import { StepBar } from './components/StepBar';
import { StepRouter } from './components/StepRouter';
import { ObjectPopup } from './components/ObjectPopup';
import { ZoneEditor } from './components/ZoneEditor';
import { useGridStore } from './store/gridStore';

type SubStep = '2a' | '2b' | '2c' | '2d' | '2e' | '2f';

function App() {
  const { loadSettings, loadActivities, loadVolumeTiming, loadActivityRelationships, stepCompletion, setCurrentStep: setStoreStep, setCurrentSubStep: setStoreSubStep } = useGridStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentSubStep, setCurrentSubStep] = useState<SubStep>('2a');

  useEffect(() => {
    loadSettings();
    loadActivities();
    loadVolumeTiming();
    loadActivityRelationships();
  }, [loadSettings, loadActivities, loadVolumeTiming, loadActivityRelationships]);

  useEffect(() => {
    setStoreStep(currentStep);
  }, [currentStep, setStoreStep]);

  useEffect(() => {
    setStoreSubStep(currentSubStep);
  }, [currentSubStep, setStoreSubStep]);

  useEffect(() => {
    if (!stepCompletion.step1) {
      setCurrentStep(1);
    } else if (!stepCompletion.step2) {
      setCurrentStep(2);
    } else if (!stepCompletion.step3) {
      setCurrentStep(3);
    } else if (!stepCompletion.step4) {
      setCurrentStep(4);
    } else {
      setCurrentStep(5);
    }
  }, [stepCompletion]);

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
    if (step === 2) {
      setCurrentSubStep('2a');
    }
  };

  const handleSubStepChange = (subStep: SubStep) => {
    setCurrentSubStep(subStep);
  };

  const handleStepComplete = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      if (currentStep + 1 === 2) {
        setCurrentSubStep('2a');
      }
    }
  };

  const needsGrid = currentStep === 2 && ['2a', '2b', '2f'].includes(currentSubStep);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden">
      <StepBar
        currentStep={currentStep}
        currentSubStep={currentSubStep}
        onStepChange={handleStepChange}
        onSubStepChange={handleSubStepChange}
      />

      <div className="flex-1 overflow-hidden">
        <StepRouter
          currentStep={currentStep}
          currentSubStep={currentSubStep}
          onSubStepChange={handleSubStepChange}
          onStepComplete={handleStepComplete}
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
