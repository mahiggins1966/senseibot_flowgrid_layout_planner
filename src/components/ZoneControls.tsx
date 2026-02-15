import { useGridStore } from '../store/gridStore';
import { Square } from 'lucide-react';

export function ZoneControls() {
  const { isDrawingZone, setIsDrawingZone, setZoneDrawStart } = useGridStore();

  const handleToggleDrawing = () => {
    const newState = !isDrawingZone;
    setIsDrawingZone(newState);
    if (!newState) {
      setZoneDrawStart(null);
    }
  };

  return (
    <div>
      <button
        onClick={handleToggleDrawing}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
          isDrawingZone
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-600 text-white hover:bg-gray-700'
        }`}
      >
        <Square className="w-4 h-4" />
        {isDrawingZone ? 'Drawing Mode Active' : 'Draw Zone'}
      </button>
      {isDrawingZone && (
        <p className="mt-2 text-sm text-gray-600">
          Click and drag on the grid to create a zone
        </p>
      )}
    </div>
  );
}
