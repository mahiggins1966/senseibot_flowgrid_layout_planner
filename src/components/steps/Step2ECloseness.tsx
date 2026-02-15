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
            2E: Rate Which Areas Need to Be Close
          </h1>
          <p className="text-lg text-gray-600">
            Some areas need to be near each other. Other areas should be kept apart. Rate each pair to
            guide the layout optimization.
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
