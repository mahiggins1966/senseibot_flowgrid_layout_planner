import { useGridStore } from '../../store/gridStore';

export function Step4Standardize() {
  const { completeStep } = useGridStore();

  const handleComplete = () => {
    completeStep('step4');
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Step 4: Standardize - Make It the Rule
          </h1>
          <p className="text-lg text-gray-600">
            Your layout is now your standard — the way the floor should look every day. Document it so
            everyone knows what right looks like.
          </p>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-3 text-lg">What happens next:</h3>
          <ul className="text-gray-700 space-y-2 list-disc pl-6">
            <li>Share the floor plan with your team — use the export buttons in Step 2F</li>
            <li>Train everyone on the new layout</li>
            <li>Post the floor plan in a visible location</li>
            <li>Set up regular reviews to maintain the standard</li>
          </ul>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-3 text-lg">Exports available in Step 2F:</h3>
          <p className="text-green-800 mb-3">
            Return to Step 2F at any time to export your floor plan PDF (layout + scoring breakdown)
            or the detailed setup instructions (work instruction for physically marking the floor).
          </p>
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
