import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { useGridStore } from '../store/gridStore';

type SubStep = '2a' | '2b' | '2c' | '2d' | '2e' | '2f';

interface StepBarProps {
  currentStep: number;
  currentSubStep: SubStep;
  onStepChange: (step: number) => void;
  onSubStepChange: (subStep: SubStep) => void;
}

export function StepBar({ currentStep, currentSubStep, onStepChange, onSubStepChange }: StepBarProps) {
  const { stepCompletion } = useGridStore();

  const steps = [
    { number: 1, name: 'Sort', key: 'step1' as const },
    { number: 2, name: 'Set in Order', key: 'step2' as const },
    { number: 3, name: 'Shine', key: 'step3' as const },
    { number: 4, name: 'Standardize', key: 'step4' as const },
    { number: 5, name: 'Sustain', key: 'step5' as const },
  ];

  const subSteps = [
    { id: '2a' as SubStep, name: 'Floor Setup' },
    { id: '2b' as SubStep, name: 'What Stays' },
    { id: '2c' as SubStep, name: 'Activities' },
    { id: '2d' as SubStep, name: 'Volumes' },
    { id: '2e' as SubStep, name: 'Closeness' },
    { id: '2f' as SubStep, name: 'Layout' },
  ];

  const isStepCompleted = (stepNumber: number) => {
    if (stepNumber === 1) return stepCompletion.step1;
    if (stepNumber === 2) return stepCompletion.step2;
    if (stepNumber === 3) return stepCompletion.step3;
    if (stepNumber === 4) return stepCompletion.step4;
    return false;
  };

  const isStepLocked = (stepNumber: number) => {
    if (stepNumber === 1) return false;
    if (stepNumber === 2) return !stepCompletion.step1;
    if (stepNumber === 3) return !stepCompletion.step2;
    if (stepNumber === 4) return !stepCompletion.step3;
    if (stepNumber === 5) return !stepCompletion.step4;
    return true;
  };

  const getStepStatus = (stepNumber: number) => {
    if (isStepLocked(stepNumber)) return 'locked';
    if (isStepCompleted(stepNumber)) return 'completed';
    if (stepNumber === currentStep) return 'current';
    return 'available';
  };

  const handleStepClick = (stepNumber: number) => {
    if (isStepLocked(stepNumber)) return;
    onStepChange(stepNumber);
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-2 py-3 overflow-x-auto">
          {steps.map((step, index) => {
            const status = getStepStatus(step.number);
            const isActive = step.number === currentStep;

            return (
              <div key={step.number} className="flex items-center">
                <button
                  onClick={() => handleStepClick(step.number)}
                  disabled={status === 'locked'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                    status === 'locked'
                      ? 'cursor-not-allowed opacity-50 bg-gray-100'
                      : isActive
                      ? 'bg-blue-100 text-blue-900 font-semibold'
                      : status === 'completed'
                      ? 'bg-green-50 text-green-900 hover:bg-green-100'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {status === 'locked' ? (
                    <Lock className="w-4 h-4" />
                  ) : status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Circle className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  )}
                  <span className="text-sm">
                    Step {step.number}: {step.name}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <div className="w-6 h-0.5 bg-gray-300 mx-1" />
                )}
              </div>
            );
          })}
        </div>

        {currentStep === 2 && (
          <div className="flex items-center gap-2 pb-3 pt-1 overflow-x-auto border-t border-gray-100">
            {subSteps.map((subStep, index) => {
              const isActive = subStep.id === currentSubStep;

              return (
                <div key={subStep.id} className="flex items-center">
                  <button
                    onClick={() => onSubStepChange(subStep.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    2{subStep.id.toUpperCase()}: {subStep.name}
                  </button>
                  {index < subSteps.length - 1 && (
                    <div className="w-4 h-0.5 bg-gray-200 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
