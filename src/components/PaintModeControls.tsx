import { useGridStore } from '../store/gridStore';
import { Square, Minus, Eraser } from 'lucide-react';

export function PaintModeControls() {
  const { paintMode, setPaintMode, getPaintedSquareCounts, canPaintSquares } = useGridStore();
  const counts = getPaintedSquareCounts();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => {
            if (!canPaintSquares()) return;
            setPaintMode(paintMode === 'permanent' ? null : 'permanent');
          }}
          className={`flex flex-col items-center gap-2 px-3 py-3 text-sm font-medium rounded-md transition-colors ${
            paintMode === 'permanent'
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          <Square className="w-5 h-5 fill-current" />
          <span className="text-xs">Permanent</span>
        </button>

        <button
          onClick={() => {
            if (!canPaintSquares()) return;
            setPaintMode(paintMode === 'semi-fixed' ? null : 'semi-fixed');
          }}
          className={`flex flex-col items-center gap-2 px-3 py-3 text-sm font-medium rounded-md transition-colors ${
            paintMode === 'semi-fixed'
              ? 'bg-gray-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          <Minus className="w-5 h-5" />
          <span className="text-xs">Semi-Fixed</span>
        </button>

        <button
          onClick={() => {
            if (!canPaintSquares()) return;
            setPaintMode(paintMode === 'clear' ? null : 'clear');
          }}
          className={`flex flex-col items-center gap-2 px-3 py-3 text-sm font-medium rounded-md transition-colors ${
            paintMode === 'clear'
              ? 'bg-red-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          <Eraser className="w-5 h-5" />
          <span className="text-xs">Clear</span>
        </button>
      </div>

      {paintMode && (
        <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-md p-3">
          {paintMode === 'permanent' && (
            <p>Click and drag across the grid to paint squares as <strong>permanent</strong> (never moves)</p>
          )}
          {paintMode === 'semi-fixed' && (
            <p>Click and drag across the grid to paint squares as <strong>semi-fixed</strong> (rarely moves)</p>
          )}
          {paintMode === 'clear' && (
            <p>Click and drag across the grid to <strong>clear</strong> painted squares</p>
          )}
        </div>
      )}

      <div className="pt-3 border-t border-gray-200">
        <div className="text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Permanent:</span>
            <span className="font-semibold text-gray-900">{counts.permanent} squares</span>
          </div>
          <div className="flex justify-between">
            <span>Semi-Fixed:</span>
            <span className="font-semibold text-gray-900">{counts.semFixed} squares</span>
          </div>
          <div className="flex justify-between">
            <span>Available:</span>
            <span className="font-semibold text-gray-900">{counts.available} squares</span>
          </div>
        </div>
      </div>
    </div>
  );
}
