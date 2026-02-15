import { FlowUnitSelector } from '../FlowUnitSelector';
import { VolumeTimingInput } from '../VolumeTimingInput';

interface Step2DVolumesProps {
  onNext: () => void;
}

export function Step2DVolumes({ onNext }: Step2DVolumesProps) {
  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            2D: Enter Volumes and Timing
          </h1>
          <p className="text-lg text-gray-600">
            How much material goes through each activity? This data tells the tool which areas need the
            most space and which need to be closest to the doors.
          </p>
        </div>

        <FlowUnitSelector />

        <VolumeTimingInput />

        <div className="flex justify-end pt-4">
          <button
            onClick={onNext}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg"
          >
            Next: Rate Closeness →
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
