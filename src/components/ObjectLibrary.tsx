import { useEffect, useState } from 'react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { CustomObject } from '../types';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';

export function ObjectLibrary() {
  const { customObjects, setCustomObjects, setDraggingObject } = useGridStore();
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    loadObjects();
  }, []);

  const loadObjects = async () => {
    const { data, error } = await supabase
      .from('custom_objects')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading objects:', error);
      return;
    }

    if (data) {
      setCustomObjects(data as CustomObject[]);
    }
  };

  const handleDragStart = (e: React.DragEvent, object: CustomObject) => {
    setDraggingObject(object);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(object));
  };

  const handleDragEnd = () => {
    setDraggingObject(null);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg"
      >
        <h3 className="font-semibold text-gray-900">Equipment Library</h3>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            {customObjects.length} {customObjects.length === 1 ? 'item' : 'items'}
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="space-y-2">
          {customObjects.map((object) => (
            <div
              key={object.id}
              draggable
              onDragStart={(e) => handleDragStart(e, object)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-move hover:bg-gray-100 hover:border-gray-300 transition-colors"
            >
              <div
                className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: object.color }}
              >
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {object.name}
                </div>
                <div className="text-xs text-gray-500">
                  {object.grid_width} × {object.grid_length} squares
                </div>
              </div>
            </div>
          ))}
          {customObjects.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-4">
              No objects available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
