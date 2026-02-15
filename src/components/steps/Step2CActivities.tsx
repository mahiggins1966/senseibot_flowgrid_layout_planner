import { ActivityList } from '../ActivityList';

interface Step2CActivitiesProps {
  onNext: () => void;
}

export function Step2CActivities({ onNext }: Step2CActivitiesProps) {
  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              2C: List Your Work Activities
            </h1>
            <p className="text-lg text-gray-600">
              List every activity that happens on your floor. Do not worry about where they go yet — just
              list what happens.
            </p>
          </div>

          <ActivityList />

          <div className="flex justify-end pt-4">
            <button
              onClick={onNext}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg"
            >
              Next: Enter Volumes →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
