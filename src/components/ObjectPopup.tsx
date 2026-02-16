import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { Move, RotateCw, Copy, Trash2, X, Minus, Plus } from 'lucide-react';

export function ObjectPopup() {
  const { selectedObject, setSelectedObject, updatePlacedObject, deletePlacedObject, addPlacedObject, getGridDimensions } = useGridStore();

  if (!selectedObject) return null;

  const handleRotate = async () => {
    const newRotation = (selectedObject.rotation + 90) % 360;
    const swapDimensions = newRotation === 90 || newRotation === 270;

    const updates = swapDimensions
      ? {
          rotation: newRotation,
          grid_width: selectedObject.grid_height,
          grid_height: selectedObject.grid_width,
        }
      : {
          rotation: newRotation,
        };

    const { error } = await supabase
      .from('placed_objects')
      .update(updates)
      .eq('id', selectedObject.id);

    if (error) {
      console.error('Error rotating object:', error);
      return;
    }

    updatePlacedObject(selectedObject.id, updates);
  };

  const handleDuplicate = async () => {
    const { activeLayoutId } = useGridStore.getState();
    const { data, error } = await supabase
      .from('placed_objects')
      .insert([{
        object_name: selectedObject.object_name,
        grid_x: selectedObject.grid_x + 1,
        grid_y: selectedObject.grid_y,
        grid_width: selectedObject.grid_width,
        grid_height: selectedObject.grid_height,
        color: selectedObject.color,
        rotation: selectedObject.rotation,
        layout_id: activeLayoutId,
      }])
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error duplicating object:', error);
      return;
    }

    if (data) {
      addPlacedObject(data);
      setSelectedObject(null);
    }
  };

  const handleDelete = async () => {
    const { error } = await supabase
      .from('placed_objects')
      .delete()
      .eq('id', selectedObject.id);

    if (error) {
      console.error('Error deleting object:', error);
      return;
    }

    deletePlacedObject(selectedObject.id);
  };

  const handleClose = () => {
    setSelectedObject(null);
  };

  const gridDimensions = getGridDimensions();

  const canResize = (widthChange: number, heightChange: number) => {
    const newWidth = selectedObject.grid_width + widthChange;
    const newHeight = selectedObject.grid_height + heightChange;

    if (newWidth < 1 || newHeight < 1) return false;
    if (selectedObject.grid_x + newWidth > gridDimensions.cols) return false;
    if (selectedObject.grid_y + newHeight > gridDimensions.rows) return false;

    return true;
  };

  const handleResize = async (widthChange: number, heightChange: number) => {
    if (!canResize(widthChange, heightChange)) return;

    const newWidth = selectedObject.grid_width + widthChange;
    const newHeight = selectedObject.grid_height + heightChange;

    const { error } = await supabase
      .from('placed_objects')
      .update({
        grid_width: newWidth,
        grid_height: newHeight,
      })
      .eq('id', selectedObject.id);

    if (error) {
      console.error('Error resizing object:', error);
      return;
    }

    updatePlacedObject(selectedObject.id, {
      grid_width: newWidth,
      grid_height: newHeight,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedObject.object_name}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleRotate}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <RotateCw className="w-5 h-5" />
            <span className="font-medium">Rotate 90°</span>
          </button>

          <button
            onClick={handleDuplicate}
            className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
          >
            <Copy className="w-5 h-5" />
            <span className="font-medium">Duplicate</span>
          </button>

          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            <span className="font-medium">Delete</span>
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-500">
            Position: {selectedObject.grid_x}, {selectedObject.grid_y}
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-blue-900 mb-2">Resize Object</div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Width:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleResize(-1, 0)}
                  disabled={!canResize(-1, 0)}
                  className="p-1 rounded bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-8 text-center text-sm font-medium">{selectedObject.grid_width}</span>
                <button
                  onClick={() => handleResize(1, 0)}
                  disabled={!canResize(1, 0)}
                  className="p-1 rounded bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
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
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-8 text-center text-sm font-medium">{selectedObject.grid_height}</span>
                <button
                  onClick={() => handleResize(0, 1)}
                  disabled={!canResize(0, 1)}
                  className="p-1 rounded bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
