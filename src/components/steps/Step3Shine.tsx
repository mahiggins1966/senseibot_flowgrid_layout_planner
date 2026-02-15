import { useState } from 'react';
import { useGridStore } from '../../store/gridStore';

export function Step3Shine() {
  const { completeStep } = useGridStore();
  const [checklist, setChecklist] = useState({
    swept: false,
    removedOld: false,
    ready: false,
  });

  const handleComplete = () => {
    completeStep('step3');
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Step 3: Shine - Clean and Prepare the Floor
          </h1>
          <p className="text-lg text-gray-600">
            Your layout is planned. Before implementing it, clean the floor. Remove old tape, sweep the
            surface, clear debris from the areas where you will place equipment and mark lanes.
          </p>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-3 text-lg">What good looks like:</h3>
          <ul className="text-yellow-800 space-y-2 list-disc pl-6">
            <li>The floor is clean and clear of debris in all work zones</li>
            <li>Old markings, tape, or paint that conflict with the new layout are removed</li>
            <li>The floor surface is ready for new grid markings and lane tape</li>
          </ul>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4 text-lg">Checklist:</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-gray-700 cursor-pointer hover:bg-gray-50 p-3 rounded transition-colors">
              <input
                type="checkbox"
                checked={checklist.swept}
                onChange={(e) => setChecklist({ ...checklist, swept: e.target.checked })}
                className="mt-1 w-5 h-5"
              />
              <span className="text-base">Floor has been swept and cleaned</span>
            </label>
            <label className="flex items-start gap-3 text-gray-700 cursor-pointer hover:bg-gray-50 p-3 rounded transition-colors">
              <input
                type="checkbox"
                checked={checklist.removedOld}
                onChange={(e) => setChecklist({ ...checklist, removedOld: e.target.checked })}
                className="mt-1 w-5 h-5"
              />
              <span className="text-base">Old conflicting markings have been removed</span>
            </label>
            <label className="flex items-start gap-3 text-gray-700 cursor-pointer hover:bg-gray-50 p-3 rounded transition-colors">
              <input
                type="checkbox"
                checked={checklist.ready}
                onChange={(e) => setChecklist({ ...checklist, ready: e.target.checked })}
                className="mt-1 w-5 h-5"
              />
              <span className="text-base">Floor is ready for new layout markings</span>
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
