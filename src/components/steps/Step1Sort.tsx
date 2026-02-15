import { useState } from 'react';
import { useGridStore } from '../../store/gridStore';

export function Step1Sort() {
  const { completeStep } = useGridStore();
  const [checklist, setChecklist] = useState({
    walked: false,
    removed: false,
    onlyNeeded: false,
  });

  const handleComplete = () => {
    completeStep('step1');
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Step 1: Sort - Remove What Doesn't Belong
          </h1>
          <p className="text-lg text-gray-600">
            Before organizing, walk your floor and remove anything that does not need to be there — broken
            equipment, unused pallets, stored junk, items that belong somewhere else. Only things that NEED
            to be on this floor should remain.
          </p>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3 text-lg">What good looks like:</h3>
          <ul className="text-blue-800 space-y-2 list-disc pl-6">
            <li>Every item on the floor has a clear purpose</li>
            <li>Broken or unused items have been removed or relocated</li>
            <li>Only what is needed for daily operations remains</li>
          </ul>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4 text-lg">Checklist:</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-gray-700 cursor-pointer hover:bg-gray-50 p-3 rounded transition-colors">
              <input
                type="checkbox"
                checked={checklist.walked}
                onChange={(e) => setChecklist({ ...checklist, walked: e.target.checked })}
                className="mt-1 w-5 h-5"
              />
              <span className="text-base">We walked the floor and identified unneeded items</span>
            </label>
            <label className="flex items-start gap-3 text-gray-700 cursor-pointer hover:bg-gray-50 p-3 rounded transition-colors">
              <input
                type="checkbox"
                checked={checklist.removed}
                onChange={(e) => setChecklist({ ...checklist, removed: e.target.checked })}
                className="mt-1 w-5 h-5"
              />
              <span className="text-base">Unneeded items have been removed or relocated</span>
            </label>
            <label className="flex items-start gap-3 text-gray-700 cursor-pointer hover:bg-gray-50 p-3 rounded transition-colors">
              <input
                type="checkbox"
                checked={checklist.onlyNeeded}
                onChange={(e) => setChecklist({ ...checklist, onlyNeeded: e.target.checked })}
                className="mt-1 w-5 h-5"
              />
              <span className="text-base">Only items required for operations remain on the floor</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleComplete}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors text-lg"
          >
            Next Step →
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
