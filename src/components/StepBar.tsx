import { ArrowLeft, Check } from 'lucide-react';

type SubStep = '2a' | '2b' | '2c' | '2d' | '2e' | '2f';

interface StepBarProps {
  currentSubStep: SubStep;
  onSubStepChange: (subStep: SubStep) => void;
  onBackToHome: () => void;
}

const SUB_STEPS: { id: SubStep; label: string; subtitle: string }[] = [
  { id: '2a', label: 'Floor Setup', subtitle: 'Facility size & grid' },
  { id: '2b', label: 'What Stays', subtitle: 'Fixed obstacles' },
  { id: '2c', label: 'Activities', subtitle: 'Work areas & doors' },
  { id: '2d', label: 'Volumes', subtitle: 'Throughput & timing' },
  { id: '2e', label: 'Closeness', subtitle: 'Relationships' },
  { id: '2f', label: 'Layout', subtitle: 'Place zones & corridors' },
];

export function StepBar({ currentSubStep, onSubStepChange, onBackToHome }: StepBarProps) {
  const currentIndex = SUB_STEPS.findIndex(s => s.id === currentSubStep);

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Back button */}
        <button
          onClick={onBackToHome}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          title="Back to project dashboard"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Project</span>
        </button>

        <div className="w-px h-7 bg-gray-200 flex-shrink-0" />

        {/* Step cards — equal width grid */}
        <div className="grid grid-cols-6 gap-1.5 flex-1 min-w-0">
          {SUB_STEPS.map((step, index) => {
            const isActive = step.id === currentSubStep;
            const isPast = index < currentIndex;

            return (
              <button
                key={step.id}
                onClick={() => onSubStepChange(step.id)}
                className={`
                  relative flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all text-left min-w-0
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isPast
                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }
                `}
              >
                {/* Step number / check */}
                <span className={`
                  w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                  ${isActive
                    ? 'bg-white/20 text-white'
                    : isPast
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {isPast ? <Check className="w-3 h-3" /> : index + 1}
                </span>

                {/* Label + subtitle */}
                <div className="min-w-0 overflow-hidden">
                  <div className={`text-xs font-semibold truncate leading-tight ${
                    isActive ? 'text-white' : ''
                  }`}>
                    {step.label}
                  </div>
                  <div className={`text-[10px] truncate leading-tight ${
                    isActive
                      ? 'text-blue-100'
                      : isPast
                      ? 'text-blue-500'
                      : 'text-gray-400'
                  }`}>
                    {step.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
