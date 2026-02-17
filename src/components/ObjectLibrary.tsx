import { useEffect, useState } from 'react';
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
  X,
  Check,
} from 'lucide-react';

/**
 * Match equipment name to a recognisable icon.
 * Falls back to Package for anything unrecognised.
 */
function getEquipmentIcon(name: string) {
  const n = name.toLowerCase();

  if (n.includes('pallet') && !n.includes('jack'))
    return Grip;            // grid of dots — pallet slats
  if (n.includes('rolling') || n.includes('bin'))
    return ShoppingCart;    // wheeled bin / cart
  if (n.includes('uld') || n.includes('container'))
    return Box;             // air‑cargo container
  if (n.includes('forklift'))
    return Truck;           // vehicle
  if (n.includes('jack'))
    return ArrowRightLeft;  // push / pull
  if (n.includes('table'))
    return Table2;          // flat surface
  if (n.includes('scale') || n.includes('weight'))
    return Scale;           // weighing
  if (n.includes('cone'))
    return Construction;    // safety cone
  if (n.includes('barrier') || n.includes('divider'))
    return Minus;           // horizontal bar

  return Package;           // generic fallback
}

const DEFAULT_COLORS = [
  '#6B7280', '#EF4444', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
];

export function ObjectLibrary() {
  const { customObjects, setCustomObjects, setDraggingObject } = useGridStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    grid_width: 1,
    grid_length: 1,
    color: '#6B7280',
  });
  const [saving, setSaving] = useState(false);

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

  const handleSaveCustom = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const { data, error } = await supabase
      .from('custom_objects')
      .insert({
        name: form.name.trim(),
        width_inches: form.grid_width * 48,
        length_inches: form.grid_length * 48,
        height_inches: 48,
        color: form.color,
        grid_width: form.grid_width,
        grid_length: form.grid_length,
        is_default: false,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error('Error creating custom object:', error);
      return;
    }

    if (data) {
      setCustomObjects([...customObjects, data as CustomObject]);
      setForm({ name: '', grid_width: 1, grid_length: 1, color: '#6B7280' });
      setShowForm(false);
    }
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
            {/* Delete button — custom items only */}
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

      {/* Add Custom Equipment */}
      {showForm ? (
        <div className="border border-blue-300 bg-blue-50 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">New Custom Equipment</span>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Conveyor Belt"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Width (squares)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={form.grid_width}
                onChange={(e) => setForm({ ...form, grid_width: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Length (squares)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={form.grid_length}
                onChange={(e) => setForm({ ...form, grid_length: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Color</label>
            <div className="flex items-center gap-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    form.color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-7 h-7 border border-gray-300 rounded cursor-pointer"
                title="Custom color"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-2 bg-white rounded border border-gray-200">
            <div
              className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: form.color }}
            >
              {(() => {
                const PreviewIcon = getEquipmentIcon(form.name);
                return <PreviewIcon className="w-5 h-5 text-white" />;
              })()}
            </div>
            <div className="text-xs text-gray-500">
              {form.name || 'Equipment'} — {form.grid_width} × {form.grid_length}
            </div>
          </div>

          <button
            onClick={handleSaveCustom}
            disabled={!form.name.trim() || saving}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Saving...' : 'Add to Library'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Custom Equipment
        </button>
      )}
    </div>
  );
}
