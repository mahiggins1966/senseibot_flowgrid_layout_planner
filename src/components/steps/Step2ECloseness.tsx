import { RelationshipRating } from '../RelationshipRating';

interface Step2EClosenessProps {
  onNext: () => void;
}

export function Step2ECloseness({ onNext }: Step2EClosenessProps) {
  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            2E: Set Closeness Between Areas
          </h1>
          <p className="text-lg text-gray-600">
            This step tells the layout tool which activity areas to place next to each other
            and which ones to keep separated. The closeness levels you set here directly control
            how the floor plan gets arranged in the next step.
          </p>
        </div>

        <RelationshipRating />

        <div className="flex justify-end pt-4">
          <button
            onClick={onNext}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg"
          >
            Next: Build Layout →
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
