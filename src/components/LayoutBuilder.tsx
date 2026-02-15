import { ObjectLibrary } from './ObjectLibrary';
import { ZoneControls } from './ZoneControls';

export function LayoutBuilder() {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-medium mb-2">Now you have the data — build your layout</p>
        <p>
          Place your work areas and equipment on the grid. The scoring panel on the right will tell
          you how good your layout is and what to improve — in real time as you move things.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Draw Work Area Zones</h3>
          <ZoneControls />
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Place Equipment & Objects</h3>
          <ObjectLibrary />
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
        <p className="font-medium mb-1">Your goal:</p>
        <p>
          Arrange zones and objects to get the highest score possible. Watch the scoring panel on
          the right as you make changes — it updates in real time.
        </p>
      </div>
    </div>
  );
}
