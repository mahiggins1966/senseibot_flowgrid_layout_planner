import { X, Trash2 } from 'lucide-react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';

export function CorridorPopup() {
  const { selectedCorridor, setSelectedCorridor, deleteCorridor, settings } = useGridStore();

  if (!selectedCorridor) return null;

  const handleDelete = async () => {
    if (!selectedCorridor) return;

    const { error } = await supabase
      .from('corridors')
      .delete()
      .eq('id', selectedCorridor.id);

    if (!error) {
      deleteCorridor(selectedCorridor.id);
      setSelectedCorridor(null);
    }
  };

  const handleClose = () => {
    setSelectedCorridor(null);
  };

  const isHorizontal = selectedCorridor.start_grid_y === selectedCorridor.end_grid_y;
  const length = isHorizontal
    ? Math.abs(selectedCorridor.end_grid_x - selectedCorridor.start_grid_x) + 1
    : Math.abs(selectedCorridor.end_grid_y - selectedCorridor.start_grid_y) + 1;

  const lengthFeet = length * settings.squareSize;
  const widthFeet = selectedCorridor.width * settings.squareSize;
  const typeName = selectedCorridor.type === 'pedestrian' ? 'Pedestrian Walkway' : 'Forklift / Cart Path';

  return (
    <div className="fixed top-20 right-4 w-80 bg-white rounded-lg shadow-xl border-2 border-gray-300 z-40">
      <div
        className="p-4 rounded-t-lg"
        style={{
          backgroundColor: `${selectedCorridor.color}20`,
          borderBottom: `2px solid ${selectedCorridor.color}`,
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900">{selectedCorridor.name}</h3>
            <div className="text-sm text-gray-600 mt-1">{typeName}</div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Length</div>
            <div className="text-lg font-bold text-gray-900">
              {lengthFeet} ft
            </div>
            <div className="text-xs text-gray-600">
              {length} squares
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Width</div>
            <div className="text-lg font-bold text-gray-900">
              {widthFeet} ft
            </div>
            <div className="text-xs text-gray-600">
              {selectedCorridor.width} {selectedCorridor.width === 1 ? 'square' : 'squares'}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Orientation</div>
          <div className="text-sm font-medium text-gray-900">
            {isHorizontal ? 'Horizontal' : 'Vertical'}
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Corridor
        </button>
      </div>
    </div>
  );
}
