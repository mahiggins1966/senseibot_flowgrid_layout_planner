import { useState } from 'react';
import { useGridStore } from '../store/gridStore';

const UNIT_OPTIONS = [
  { value: 'lbs', label: 'Pounds (lbs)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'pallets', label: 'Pallets' },
  { value: 'units', label: 'Units / Items' },
  { value: 'orders', label: 'Orders' },
  { value: 'cases', label: 'Cases' },
  { value: 'containers', label: 'Containers' },
  { value: 'custom', label: 'Custom' },
];

export function FlowUnitSelector() {
  const { settings, updateSettings } = useGridStore();
  const [editingCapacity, setEditingCapacity] = useState<string | null>(null);

  const handlePrimaryUnitChange = (value: string) => {
    updateSettings({
      primaryFlowUnit: value,
      primaryFlowUnitCustom: value === 'custom' ? settings.primaryFlowUnitCustom : undefined,
    });
  };

  const handlePrimaryCustomChange = (value: string) => {
    updateSettings({ primaryFlowUnitCustom: value });
  };

  const handleVehicleNameChange = (value: string) => {
    updateSettings({ largestVehicleName: value });
  };

  const handleVehicleCapacityChange = (value: string) => {
    setEditingCapacity(value);
  };

  const handleVehicleCapacityBlur = () => {
    if (editingCapacity !== null) {
      const numValue = parseFloat(editingCapacity);
      updateSettings({ largestVehicleCapacity: isNaN(numValue) || editingCapacity === '' ? undefined : numValue });
      setEditingCapacity(null);
    }
  };

  const getPrimaryUnitLabel = () => {
    if (!settings.primaryFlowUnit) return 'units';
    if (settings.primaryFlowUnit === 'custom' && settings.primaryFlowUnitCustom) {
      return settings.primaryFlowUnitCustom.toLowerCase();
    }
    const unitMap: Record<string, string> = {
      lbs: 'lbs',
      kg: 'kg',
      pallets: 'pallets',
      units: 'units',
      orders: 'orders',
      cases: 'cases',
      containers: 'containers',
    };
    return unitMap[settings.primaryFlowUnit] || 'units';
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          How do you measure what flows through your operation?
        </h3>
        <p className="text-sm text-gray-600">
          Select the units you use to measure throughput. This will be used in all volume calculations.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Primary Unit <span className="text-red-600">*</span>
          </label>
          <select
            value={settings.primaryFlowUnit || ''}
            onChange={(e) => handlePrimaryUnitChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a unit...</option>
            {UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {settings.primaryFlowUnit === 'custom' && (
            <input
              type="text"
              value={settings.primaryFlowUnitCustom || ''}
              onChange={(e) => handlePrimaryCustomChange(e.target.value)}
              placeholder="Enter your unit name (e.g., pouches, totes, canisters)"
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          )}
          <p className="mt-2 text-xs text-gray-600">
            Pick the unit that matters most for your output. For cargo operations this is usually weight.
            For warehouses it might be pallets or orders.
          </p>
        </div>


      </div>

      <div className="border-t border-gray-200 pt-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            What is the largest vehicle or container you need to load?
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Enter your biggest vehicle. The tool will size staging areas to handle a full load for this vehicle.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Vehicle Name
            </label>
            <input
              type="text"
              value={settings.largestVehicleName || ''}
              onChange={(e) => handleVehicleNameChange(e.target.value)}
              placeholder='e.g., "Cessna SkyCourier", "53-ft Trailer"'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Max Payload ({getPrimaryUnitLabel()})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={editingCapacity ?? (settings.largestVehicleCapacity != null ? settings.largestVehicleCapacity.toString() : '')}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                const parts = value.split('.');
                const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                handleVehicleCapacityChange(sanitized);
              }}
              onBlur={handleVehicleCapacityBlur}
              placeholder="e.g., 5950"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <p className="mt-2 text-xs text-gray-600">
          If different vehicles show up on different days, always enter the largest one.
        </p>
      </div>
    </div>
  );
}
