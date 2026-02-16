type SubStep = '2a' | '2b' | '2c' | '2d' | '2e' | '2f';

interface StepBarProps {
  currentSubStep: SubStep;
  onSubStepChange: (subStep: SubStep) => void;
}

const SUB_STEPS: { id: SubStep; label: string }[] = [
  { id: '2a', label: 'Floor Setup' },
  { id: '2b', label: 'What Stays' },
  { id: '2c', label: 'Activities' },
  { id: '2d', label: 'Volumes' },
  { id: '2e', label: 'Closeness' },
  { id: '2f', label: 'Layout' },
];

export function StepBar({ currentSubStep, onSubStepChange }: StepBarProps) {
  const currentIndex = SUB_STEPS.findIndex(s => s.id === currentSubStep);

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-1 py-2.5 overflow-x-auto">
          {SUB_STEPS.map((step, index) => {
            const isActive = step.id === currentSubStep;
            const isPast = index < currentIndex;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => onSubStepChange(step.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all text-sm font-medium ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isPast
                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isActive
                      ? 'bg-white text-blue-600'
                      : isPast
                      ? 'bg-blue-200 text-blue-800'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {index + 1}
                  </span>
                  {step.label}
                </button>
                {index < SUB_STEPS.length - 1 && (
                  <div className={`w-6 h-0.5 mx-1 ${index < currentIndex ? 'bg-blue-300' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
