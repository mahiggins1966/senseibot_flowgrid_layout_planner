import { useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { CustomObject } from '../types';
import {
  Package,
  Grip,
  ShoppingCart,
  Box,
  Truck,
  ArrowRightLeft,
  Table2,
  Scale,
  Construction,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';

/**
 * Match equipment name to a recognisable icon.
 * Falls back to Package for anything unrecognised.
 */
export function getEquipmentIcon(name: string) {
  const n = name.toLowerCase();

  if (n.includes('pallet') && !n.includes('jack'))
    return Grip;
  if (n.includes('rolling') || n.includes('bin'))
    return ShoppingCart;
  if (n.includes('uld') || n.includes('container'))
    return Box;
  if (n.includes('forklift'))
    return Truck;
  if (n.includes('jack'))
    return ArrowRightLeft;
  if (n.includes('table'))
    return Table2;
  if (n.includes('scale') || n.includes('weight'))
    return Scale;
  if (n.includes('cone'))
    return Construction;
  if (n.includes('barrier') || n.includes('divider'))
    return Minus;

  return Package;
}

export function ObjectLibrary() {
  const { customObjects, setCustomObjects, setDraggingObject, setShowCustomEquipmentForm } = useGridStore();

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

  const handleDeleteCustom = async (id: string) => {
    const { error } = await supabase
      .from('custom_objects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting object:', error);
      return;
    }

    setCustomObjects(customObjects.filter((o) => o.id !== id));
  };

  return (
    <div className="space-y-2">
      {customObjects.map((object) => {
        const Icon = getEquipmentIcon(object.name);
        return (
          <div
            key={object.id}
            draggable
            onDragStart={(e) => handleDragStart(e, object)}
            onDragEnd={handleDragEnd}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-move hover:bg-gray-100 hover:border-gray-300 transition-colors group"
          >
            <div
              className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: object.color }}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">
                {object.name}
              </div>
              <div className="text-xs text-gray-500">
                {object.grid_width} × {object.grid_length} squares
              </div>
            </div>
            {!object.is_default && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCustom(object.id);
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="Delete custom item"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {customObjects.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-4">
          No objects available
        </div>
      )}

      <button
        onClick={() => setShowCustomEquipmentForm(true)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Add Custom Equipment
      </button>
    </div>
  );
}
