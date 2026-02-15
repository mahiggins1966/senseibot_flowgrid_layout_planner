import { useState } from 'react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { Plus } from 'lucide-react';

export function CreateObjectForm() {
  const { settings, customObjects, setCustomObjects } = useGridStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    width: '',
    length: '',
    height: '',
    color: '#3B82F6',
  });

  const calculateGridSize = (inches: number) => {
    const squareSizeInches = settings.squareSize * 12;
    return Math.ceil(inches / squareSizeInches);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const width = parseFloat(formData.width);
    const length = parseFloat(formData.length);
    const height = parseFloat(formData.height);

    if (!formData.name || isNaN(width) || isNaN(length) || isNaN(height)) {
      alert('Please fill in all fields with valid numbers');
      return;
    }

    const gridWidth = calculateGridSize(width);
    const gridLength = calculateGridSize(length);

    const { data, error } = await supabase
      .from('custom_objects')
      .insert([
        {
          name: formData.name,
          width_inches: width,
          length_inches: length,
          height_inches: height,
          color: formData.color,
          grid_width: gridWidth,
          grid_length: gridLength,
          is_default: false,
        },
      ])
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating object:', error);
      alert('Failed to create object');
      return;
    }

    if (data) {
      setCustomObjects([...customObjects, data]);
      setFormData({
        name: '',
        width: '',
        length: '',
        height: '',
        color: '#3B82F6',
      });
      setIsExpanded(false);
    }
  };

  const gridWidth = formData.width ? calculateGridSize(parseFloat(formData.width) || 0) : 0;
  const gridLength = formData.length ? calculateGridSize(parseFloat(formData.length) || 0) : 0;

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        {isExpanded ? 'Cancel' : 'Create Object'}
      </button>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter object name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Width (inches)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.width}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                const parts = value.split('.');
                const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                setFormData({ ...formData, width: sanitized });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Length (inches)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.length}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                const parts = value.split('.');
                const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                setFormData({ ...formData, length: sanitized });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Height (inches)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.height}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                const parts = value.split('.');
                const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                setFormData({ ...formData, height: sanitized });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0"
            />
          </div>

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

          {gridWidth > 0 && gridLength > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                This object takes up <strong>{gridWidth} × {gridLength}</strong> grid squares
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Add to Library
          </button>
        </form>
      )}
    </div>
  );
}
