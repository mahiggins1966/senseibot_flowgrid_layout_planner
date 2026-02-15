import { useState, useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { Trash2, X } from 'lucide-react';
import { ZoneGroupType } from '../types';

export function ZoneEditor() {
  const { selectedZone, setSelectedZone, updateZone, deleteZone, canInteractWithZones } = useGridStore();
  const [formData, setFormData] = useState({
    name: selectedZone?.name || '',
    color: selectedZone?.color || '#3B82F6',
    group_type: selectedZone?.group_type || 'flexible',
  });

  useEffect(() => {
    if (selectedZone) {
      setFormData({
        name: selectedZone.name,
        color: selectedZone.color,
        group_type: selectedZone.group_type,
      });
    }
  }, [selectedZone]);

  if (!selectedZone) return null;

  const handleSave = async () => {
    if (!canInteractWithZones()) return;
    const updates = {
      name: formData.name,
      color: formData.color,
      group_type: formData.group_type as ZoneGroupType,
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

  const getGroupColor = (type: string) => {
    switch (type) {
      case 'permanent':
        return '#374151';
      case 'semi-fixed':
        return '#6B7280';
      case 'flexible':
        return formData.color;
      default:
        return formData.color;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit Zone
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setFormData({ ...formData, group_type: 'permanent' })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.group_type === 'permanent'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Permanent
              </button>
              <button
                onClick={() => setFormData({ ...formData, group_type: 'semi-fixed' })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.group_type === 'semi-fixed'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Semi-Fixed
              </button>
              <button
                onClick={() => setFormData({ ...formData, group_type: 'flexible' })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.group_type === 'flexible'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Flexible
              </button>
            </div>
          </div>

          {formData.group_type === 'flexible' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
            </div>
          )}

          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Position: {selectedZone.grid_x}, {selectedZone.grid_y}
            </p>
            <p className="text-sm text-gray-600">
              Size: {selectedZone.grid_width} × {selectedZone.grid_height} squares
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-600">Preview:</span>
              <div
                className="w-8 h-8 rounded border-2"
                style={{
                  backgroundColor: getGroupColor(formData.group_type),
                  borderColor: getGroupColor(formData.group_type),
                  opacity: 0.5,
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Save Changes
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
