import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useGridStore } from '../store/gridStore';

export function CorridorDrawer() {
  // Temporary minimal version for debugging
  return (
    <div style={{ border: '5px solid red', padding: '20px', backgroundColor: 'yellow' }}>
      <h1 style={{ fontSize: '30px', color: 'red' }}>CORRIDOR DRAWER TEST</h1>
      <p>If you see this, the component is rendering.</p>
    </div>
  );

  /*
  const {
    corridors,
    isDrawingCorridor,
    setIsDrawingCorridor,
    selectedCorridorType,
    setSelectedCorridorType,
    setCorridorDrawStart,
    settings,
  } = useGridStore();

  const [isOpen, setIsOpen] = useState(true);

  */
  /*
  const handleCorridorTypeClick = (type: 'pedestrian' | 'forklift') => {
    if (isDrawingCorridor && selectedCorridorType === type) {
      setIsDrawingCorridor(false);
      setCorridorDrawStart(null);
      setSelectedCorridorType(null);
    } else {
      setSelectedCorridorType(type);
      setIsDrawingCorridor(true);
      setCorridorDrawStart(null);
    }
  };

  const handleCancelDrawing = () => {
    setIsDrawingCorridor(false);
    setCorridorDrawStart(null);
    setSelectedCorridorType(null);
  };

  const pedestrianCorridors = corridors.filter(c => c.type === 'pedestrian');
  const forkliftCorridors = corridors.filter(c => c.type === 'forklift');

  const totalPedestrianLength = pedestrianCorridors.reduce((sum, c) => {
    const length = Math.max(
      Math.abs(c.end_grid_x - c.start_grid_x),
      Math.abs(c.end_grid_y - c.start_grid_y)
    ) + 1;
    return sum + length;
  }, 0);

  const totalForkliftLength = forkliftCorridors.reduce((sum, c) => {
    const length = Math.max(
      Math.abs(c.end_grid_x - c.start_grid_x),
      Math.abs(c.end_grid_y - c.start_grid_y)
    ) + 1;
    return sum + length;
  }, 0);

  const pedestrianFeet = totalPedestrianLength * settings.squareSize;
  const forkliftFeet = totalForkliftLength * settings.squareSize;
  */
  /*
  return (
    <div className="space-y-4" style={{ border: '3px solid red', padding: '8px' }}>
      <div className="text-2xl font-bold text-red-600 bg-yellow-200 p-4">
        🔴 CORRIDOR DRAWER IS HERE 🔴
      </div>
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg mb-3"
        >
          <h3 className="font-semibold text-gray-900">Draw Corridors and Paths</h3>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              {corridors.length} {corridors.length === 1 ? 'path' : 'paths'}
            </div>
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            )}
          </div>
        </button>

        {isOpen && (
          <>
        {isDrawingCorridor && selectedCorridorType && (
          <div className="mb-3 p-4 bg-amber-100 border-4 border-amber-600 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-xl font-bold text-amber-900 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-amber-600 rounded-full animate-pulse"></span>
                  CORRIDOR DRAWING ACTIVE
                </div>
                <div className="text-base text-amber-800 mt-1 font-medium">
                  Drawing: {selectedCorridorType === 'pedestrian' ? 'Pedestrian Walkway' : 'Forklift / Cart Path'}
                </div>
              </div>
              <button
                onClick={handleCancelDrawing}
                className="px-4 py-2 bg-white border-2 border-amber-600 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors text-sm font-bold shadow-md"
              >
                Cancel
              </button>
            </div>
            <div className="bg-white rounded-lg p-3 border-2 border-amber-300 shadow-sm">
              <div className="text-sm text-amber-900">
                <p className="font-medium mb-1">Instructions:</p>
                <ol className="list-decimal pl-4 space-y-1 text-xs">
                  <li>Click to set start point</li>
                  <li>Move cursor horizontally or vertically</li>
                  <li>Click again to place corridor</li>
                  <li>Press Escape to cancel</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => handleCorridorTypeClick('pedestrian')}
            className={`w-full p-3 rounded-lg transition-all text-left ${
              isDrawingCorridor && selectedCorridorType === 'pedestrian'
                ? 'border-4 border-green-600 bg-green-50 shadow-lg'
                : 'border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Pedestrian Walkway</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  1 square wide (5 ft) — light green dashed border
                </div>
              </div>
              <div
                className="w-12 h-8 rounded border-2 border-dashed"
                style={{
                  backgroundColor: 'white',
                  borderColor: '#86EFAC',
                }}
              />
            </div>
          </button>

          <button
            onClick={() => handleCorridorTypeClick('forklift')}
            className={`w-full p-3 rounded-lg transition-all text-left ${
              isDrawingCorridor && selectedCorridorType === 'forklift'
                ? 'border-4 border-orange-600 bg-orange-50 shadow-lg'
                : 'border-2 border-gray-300 hover:border-orange-500 hover:bg-orange-50 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Forklift / Cart Path</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  2 squares wide (10 ft) — light orange dashed border
                </div>
              </div>
              <div
                className="w-12 h-8 rounded border-2 border-dashed"
                style={{
                  backgroundColor: 'white',
                  borderColor: '#FFA96A',
                }}
              />
            </div>
          </button>
        </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-xs text-green-600 font-medium">Pedestrian</div>
          <div className="text-lg font-bold text-green-900 mt-1">
            {pedestrianCorridors.length} <span className="text-xs text-green-600">drawn</span>
          </div>
          <div className="text-xs text-green-700 mt-0.5">
            {pedestrianFeet} ft total
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="text-xs text-orange-600 font-medium">Forklift</div>
          <div className="text-lg font-bold text-orange-900 mt-1">
            {forkliftCorridors.length} <span className="text-xs text-orange-600">drawn</span>
          </div>
          <div className="text-xs text-orange-700 mt-0.5">
            {forkliftFeet} ft total
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
        <p className="font-medium mb-1">About corridors:</p>
        <ul className="space-y-1 list-disc pl-4">
          <li>Corridors are always straight (horizontal or vertical only)</li>
          <li>Can overlap with work areas (shows path through zone)</li>
          <li>Cannot cross permanent (dark gray) squares</li>
          <li>Click a corridor to select and delete if needed</li>
        </ul>
      </div>
      </>
        )}
      </div>
    </div>
  );
  */
}
