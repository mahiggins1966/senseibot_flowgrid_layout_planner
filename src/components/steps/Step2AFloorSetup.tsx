import { FloorSettings } from '../FloorSettings';
import { GridCanvas } from '../GridCanvas';

interface Step2AFloorSetupProps {
  onNext: () => void;
}

export function Step2AFloorSetup({ onNext }: Step2AFloorSetupProps) {
  return (
    <div className="flex h-full w-full">
      <div className="w-96 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">2A: Set Up Your Floor</h2>
            <p className="text-sm text-gray-600">
              Define your facility dimensions, choose your grid size, and add doors or openings.
            </p>
          </div>

          <FloorSettings />

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={onNext}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Next: Mark What Stays →
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-gray-100 overflow-hidden">
        <GridCanvas />
      </div>
    </div>
  );
}
