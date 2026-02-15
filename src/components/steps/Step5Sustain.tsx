export function Step5Sustain() {
  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Step 5: Sustain - Keep It Going
          </h1>
          <p className="text-lg text-gray-600">
            The hardest part of any improvement is making it last. Use this tool regularly to check that
            your floor still matches the standard and to plan adjustments when things change.
          </p>
        </div>

        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold text-purple-900 mb-3 text-lg">Sustain Tools:</h3>
          <p className="text-purple-800 mb-4">
            These features will help you maintain your standard over time and continuously improve your
            layout.
          </p>
          <div className="space-y-3">
            <button
              disabled
              className="w-full bg-gray-300 text-gray-500 font-semibold py-3 px-4 rounded-lg cursor-not-allowed"
            >
              Compare to Standard (Coming Soon)
            </button>
            <button
              disabled
              className="w-full bg-gray-300 text-gray-500 font-semibold py-3 px-4 rounded-lg cursor-not-allowed"
            >
              Schedule a Review (Coming Soon)
            </button>
            <button
              disabled
              className="w-full bg-gray-300 text-gray-500 font-semibold py-3 px-4 rounded-lg cursor-not-allowed"
            >
              Improvement Log (Coming Soon)
            </button>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-3 text-lg">Best practices for sustaining:</h3>
          <ul className="text-gray-700 space-y-2 list-disc pl-6">
            <li>Review the floor layout monthly or when major changes occur</li>
            <li>Train new team members on the standard layout</li>
            <li>Document any approved changes to the layout</li>
            <li>Use the comparison tool to identify drift from the standard</li>
            <li>Celebrate wins and recognize teams that maintain the standard</li>
          </ul>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
          <h3 className="font-semibold text-green-900 mb-2 text-xl">Congratulations!</h3>
          <p className="text-green-800">
            You have completed all 5S steps. Your floor is now organized, standardized, and ready for
            continuous improvement.
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}
