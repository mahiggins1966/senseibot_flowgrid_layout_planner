import { useEffect, useState } from 'react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { Trash2, X, Minus, Plus } from 'lucide-react';

export function ActivityZonePopup() {
  const { selectedZone, setSelectedZone, deleteZone, activities, settings, updateZone, getGridDimensions, paintedSquares } = useGridStore();
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedZone) {
        setSelectedZone(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedZone, setSelectedZone]);

  if (!selectedZone) return null;

  const activity = selectedZone.activity_id
    ? activities.find(a => a.id === selectedZone.activity_id)
    : null;

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'work-area':
        return 'Work Area';
      case 'staging-lane':
        return 'Staging Lane';
      case 'corridor':
        return 'Corridor / Path';
      case 'support-area':
        return 'Support Area';
      default:
        return type;
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this zone? You can redraw it later if needed.')) {
      return;
    }

    const { error } = await supabase
      .from('zones')
      .delete()
      .eq('id', selectedZone.id);

    if (error) {
      console.error('Error deleting zone:', error);
      return;
    }

    deleteZone(selectedZone.id);
  };

  const handleClose = () => {
    setSelectedZone(null);
  };

  const gridDimensions = getGridDimensions();

  const canResize = (widthChange: number, heightChange: number) => {
    const newWidth = selectedZone.grid_width + widthChange;
    const newHeight = selectedZone.grid_height + heightChange;

    if (newWidth < 1 || newHeight < 1) return false;
    if (selectedZone.grid_x + newWidth > gridDimensions.cols) return false;
    if (selectedZone.grid_y + newHeight > gridDimensions.rows) return false;

    for (let r = selectedZone.grid_y; r < selectedZone.grid_y + newHeight; r++) {
      for (let c = selectedZone.grid_x; c < selectedZone.grid_x + newWidth; c++) {
        const key = `${r}-${c}`;
        const painted = paintedSquares.get(key);
        if (painted && painted.type === 'permanent') {
          return false;
        }
      }
    }

    return true;
  };

  const handleResize = async (widthChange: number, heightChange: number) => {
    if (!canResize(widthChange, heightChange)) return;

    const newWidth = selectedZone.grid_width + widthChange;
    const newHeight = selectedZone.grid_height + heightChange;

    const { error } = await supabase
      .from('zones')
      .update({
        grid_width: newWidth,
        grid_height: newHeight,
      })
      .eq('id', selectedZone.id);

    if (error) {
      console.error('Error resizing zone:', error);
      return;
    }

    updateZone(selectedZone.id, {
      grid_width: newWidth,
      grid_height: newHeight,
    });
  };

  const totalSquares = selectedZone.grid_width * selectedZone.grid_height;
  const sqFt = totalSquares * settings.squareSize * settings.squareSize;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedZone.name}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {activity && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs font-medium text-blue-600 mb-1">Activity Type</div>
              <div className="text-sm font-medium text-blue-900">
                {getActivityTypeLabel(activity.type)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Position</div>
              <div className="text-sm font-medium text-gray-900">
                ({selectedZone.grid_x}, {selectedZone.grid_y})
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Size</div>
              <div className="text-sm font-medium text-gray-900">
                {selectedZone.grid_width} × {selectedZone.grid_height}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Area</div>
            <div className="text-sm font-medium text-gray-900">
              {totalSquares} squares = {sqFt.toLocaleString()} sq ft
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Color:</span>
            <div
              className="w-8 h-8 rounded border-2 flex-shrink-0"
              style={{
                backgroundColor: selectedZone.color,
                borderColor: activity?.type === 'corridor' ? '#86EFAC' : selectedZone.color,
                borderStyle: activity?.type === 'corridor' ? 'dashed' : 'solid',
              }}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="text-xs font-medium text-blue-900 mb-2">Resize Zone</div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Width:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleResize(-1, 0)}
                  disabled={!canResize(-1, 0)}
                  className="p-1 rounded bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-medium">{selectedZone.grid_width}</span>
                <button
                  onClick={() => handleResize(1, 0)}
                  disabled={!canResize(1, 0)}
                  className="p-1 rounded bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Height:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleResize(0, -1)}
                  disabled={!canResize(0, -1)}
                  className="p-1 rounded bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-medium">{selectedZone.grid_height}</span>
                <button
                  onClick={() => handleResize(0, 1)}
                  disabled={!canResize(0, 1)}
                  className="p-1 rounded bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Delete Zone
            </button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Press Esc to close
          </div>
        </div>
      </div>
    </div>
  );
}
