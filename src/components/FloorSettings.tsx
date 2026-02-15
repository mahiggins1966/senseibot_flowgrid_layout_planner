import { useState, useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { US_SQUARE_SIZE_OPTIONS, METRIC_SQUARE_SIZE_OPTIONS, DimensionUnit, MeasurementSystem } from '../types';
import { DoorControls } from './DoorControls';

const FEET_TO_METERS = 0.3048;
const METERS_TO_FEET = 3.28084;

export function FloorSettings() {
  const { settings, updateSettings, getGridDimensions } = useGridStore();
  const gridDimensions = getGridDimensions();

  const [widthUnit, setWidthUnit] = useState<DimensionUnit>(
    settings.measurementSystem === 'US' ? 'feet' : 'meters'
  );
  const [heightUnit, setHeightUnit] = useState<DimensionUnit>(
    settings.measurementSystem === 'US' ? 'feet' : 'meters'
  );

  useEffect(() => {
    if (settings.measurementSystem === 'US') {
      setWidthUnit('feet');
      setHeightUnit('feet');
    } else {
      setWidthUnit('meters');
      setHeightUnit('meters');
    }
  }, [settings.measurementSystem]);

  const getDisplayValue = (feet: number, unit: DimensionUnit) => {
    switch (unit) {
      case 'feet':
        return Math.round(feet);
      case 'inches':
        return Math.round(feet * 12);
      case 'meters':
        return parseFloat((feet * FEET_TO_METERS).toFixed(1));
      case 'millimeters':
        return Math.round(feet * FEET_TO_METERS * 1000);
      default:
        return feet;
    }
  };

  const getFeetFromDisplay = (value: number, unit: DimensionUnit) => {
    switch (unit) {
      case 'feet':
        return value;
      case 'inches':
        return value / 12;
      case 'meters':
        return value * METERS_TO_FEET;
      case 'millimeters':
        return (value / 1000) * METERS_TO_FEET;
      default:
        return value;
    }
  };

  const handleMeasurementSystemChange = (system: MeasurementSystem) => {
    const defaultSquareSize = system === 'US' ? 5 : 3.93701;
    updateSettings({
      measurementSystem: system,
      squareSize: defaultSquareSize
    });
  };

  const [editingWidth, setEditingWidth] = useState<string | null>(null);
  const [editingHeight, setEditingHeight] = useState<string | null>(null);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
    setEditingWidth(sanitized);
  };

  const handleWidthBlur = () => {
    if (editingWidth !== null) {
      const value = parseFloat(editingWidth);
      if (!isNaN(value) && value > 0) {
        const feetValue = getFeetFromDisplay(value, widthUnit);
        updateSettings({ facilityWidth: feetValue });
      }
      setEditingWidth(null);
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
    setEditingHeight(sanitized);
  };

  const handleHeightBlur = () => {
    if (editingHeight !== null) {
      const value = parseFloat(editingHeight);
      if (!isNaN(value) && value > 0) {
        const feetValue = getFeetFromDisplay(value, heightUnit);
        updateSettings({ facilityHeight: feetValue });
      }
      setEditingHeight(null);
    }
  };

  const handleSquareSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseFloat(e.target.value);
    updateSettings({ squareSize: value });
  };

  const squareOptions = settings.measurementSystem === 'US'
    ? US_SQUARE_SIZE_OPTIONS
    : METRIC_SQUARE_SIZE_OPTIONS;

  const usableFloorSqFt = settings.facilityWidth * settings.facilityHeight;
  const usableFloorDisplay = settings.measurementSystem === 'US'
    ? `~${Math.round(usableFloorSqFt).toLocaleString()} sq ft`
    : `~${Math.round(usableFloorSqFt * FEET_TO_METERS * FEET_TO_METERS).toLocaleString()} sq m`;

  const totalSquares = gridDimensions.cols * gridDimensions.rows;

  const primaryUnit = settings.measurementSystem === 'US' ? 'feet' : 'meters';
  const secondaryUnit = settings.measurementSystem === 'US' ? 'inches' : 'millimeters';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Measurement System
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleMeasurementSystemChange('US')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              settings.measurementSystem === 'US'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            US
          </button>
          <button
            onClick={() => handleMeasurementSystemChange('Metric')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              settings.measurementSystem === 'Metric'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            Metric
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Facility Width
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={editingWidth ?? getDisplayValue(settings.facilityWidth, widthUnit).toString()}
            onChange={handleWidthChange}
            onBlur={handleWidthBlur}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            <button
              onClick={() => setWidthUnit(primaryUnit)}
              className={`px-2 py-2 text-xs font-medium transition-colors ${
                widthUnit === primaryUnit
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {primaryUnit === 'feet' ? 'ft' : 'm'}
            </button>
            <button
              onClick={() => setWidthUnit(secondaryUnit)}
              className={`px-2 py-2 text-xs font-medium transition-colors border-l border-gray-300 ${
                widthUnit === secondaryUnit
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {secondaryUnit === 'inches' ? 'in' : 'mm'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Facility Height
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={editingHeight ?? getDisplayValue(settings.facilityHeight, heightUnit).toString()}
            onChange={handleHeightChange}
            onBlur={handleHeightBlur}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            <button
              onClick={() => setHeightUnit(primaryUnit)}
              className={`px-2 py-2 text-xs font-medium transition-colors ${
                heightUnit === primaryUnit
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {primaryUnit === 'feet' ? 'ft' : 'm'}
            </button>
            <button
              onClick={() => setHeightUnit(secondaryUnit)}
              className={`px-2 py-2 text-xs font-medium transition-colors border-l border-gray-300 ${
                heightUnit === secondaryUnit
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {secondaryUnit === 'inches' ? 'in' : 'mm'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Grid Square Size
        </label>
        <select
          value={settings.squareSize}
          onChange={handleSquareSizeChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
        >
          {squareOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-3 border-t border-gray-200">
        <div className="text-sm text-gray-600 space-y-1">
          <div>
            <span className="font-semibold text-gray-900 text-xs">
              Grid: {gridDimensions.cols} × {gridDimensions.rows} ({totalSquares} squares)
            </span>
          </div>
          <div>
            <span className="font-semibold text-gray-900 text-xs">
              Usable Floor: {usableFloorDisplay}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <DoorControls />
      </div>
    </div>
  );
}
