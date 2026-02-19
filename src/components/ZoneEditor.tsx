import { useState, useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { Trash2, X, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, EyeOff } from 'lucide-react';
import { LabelAlign } from '../types';

export function ZoneEditor() {
  const { selectedZone, setSelectedZone, updateZone, deleteZone, canInteractWithZones, settings } = useGridStore();
  const [formData, setFormData] = useState({
    color: selectedZone?.color || '#3B82F6',
    label_align: (selectedZone?.label_align || 'center') as LabelAlign,
  });

  useEffect(() => {
    if (selectedZone) {
      setFormData({
        color: selectedZone.color,
        label_align: selectedZone.label_align || 'center',
      });
    }
  }, [selectedZone]);

  if (!selectedZone) return null;

  const handleSave = async () => {
    if (!canInteractWithZones()) return;
    const updates = {
      color: formData.color,
      label_align: formData.label_align as LabelAlign,
    };

    const { error } = await supabase
      .from('zones')
      .update(updates)
      .eq('id', selectedZone.id);

    if (error) {
      console.error('Error updating zone:', error);
      return;
    }

    updateZone(selectedZone.id, updates);
    setSelectedZone(null);
  };

  const handleDelete = async () => {
    if (!canInteractWithZones()) return;
    if (!confirm('Delete this zone? You can redraw it later.')) return;

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

  const totalSquares = selectedZone.grid_width * selectedZone.grid_height;
  const sqFt = totalSquares * settings.squareSize * settings.squareSize;

  return (
    <div className="fixed inset-0 z-50" onClick={handleClose}>
      <div
        className="absolute top-1/2 right-4 -translate-y-1/2 bg-white rounded-lg shadow-xl border border-gray-200 w-72"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Zone</div>
            <div className="text-base font-semibold text-gray-900 truncate">{selectedZone.name}</div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Info row */}
          <div className="flex gap-2 text-xs text-gray-500">
            <span>{selectedZone.grid_width}×{selectedZone.grid_height}</span>
            <span>·</span>
            <span>{totalSquares} sq</span>
            <span>·</span>
            <span>{sqFt.toLocaleString()} ft²</span>
          </div>

          {/* Label Position */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Label Position</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { value: 'top' as LabelAlign, label: 'Top', icon: AlignVerticalJustifyStart },
                { value: 'center' as LabelAlign, label: 'Center', icon: AlignVerticalJustifyCenter },
                { value: 'bottom' as LabelAlign, label: 'Bottom', icon: AlignVerticalJustifyEnd },
                { value: 'hidden' as LabelAlign, label: 'Hide', icon: EyeOff },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setFormData({ ...formData, label_align: value })}
                  className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                    formData.label_align === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Color</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full h-8 border border-gray-300 rounded cursor-pointer"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Save
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
