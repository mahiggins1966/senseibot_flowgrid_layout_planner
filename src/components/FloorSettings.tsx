import { useState, useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { US_SQUARE_SIZE_OPTIONS, METRIC_SQUARE_SIZE_OPTIONS, DimensionUnit, MeasurementSystem, UNIT_FOOTPRINT_OPTIONS, STACKING_HEIGHT_OPTIONS, ACCESS_FACTOR_OPTIONS } from '../types';
import { DoorControls } from './DoorControls';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FEET_TO_METERS = 0.3048;
const METERS_TO_FEET = 3.28084;

export function FloorSettings() {
  const { settings, updateSettings, getGridDimensions, doors } = useGridStore();
  const gridDimensions = getGridDimensions();

  const [facilityOpen, setFacilityOpen] = useState(true);
  const [doorsOpen, setDoorsOpen] = useState(true);

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
      case 'feet': return Math.round(feet);
      case 'inches': return Math.round(feet * 12);
      case 'meters': return parseFloat((feet * FEET_TO_METERS).toFixed(1));
      case 'millimeters': return Math.round(feet * FEET_TO_METERS * 1000);
      default: return feet;
    }
  };

  const getFeetFromDisplay = (value: number, unit: DimensionUnit) => {
    switch (unit) {
      case 'feet': return value;
      case 'inches': return value / 12;
      case 'meters': return value * METERS_TO_FEET;
      case 'millimeters': return (value / 1000) * METERS_TO_FEET;
      default: return value;
    }
  };

  const handleMeasurementSystemChange = (system: MeasurementSystem) => {
    const defaultSquareSize = system === 'US' ? 5 : 3.93701;
    updateSettings({ measurementSystem: system, squareSize: defaultSquareSize });
  };

  const [editingWidth, setEditingWidth] = useState<string | null>(null);
  const [editingHeight, setEditingHeight] = useState<string | null>(null);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    setEditingWidth(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value);
  };

  const handleWidthBlur = () => {
    if (editingWidth !== null) {
      const value = parseFloat(editingWidth);
      if (!isNaN(value) && value > 0) {
        updateSettings({ facilityWidth: getFeetFromDisplay(value, widthUnit) });
      }
      setEditingWidth(null);
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    setEditingHeight(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value);
  };

  const handleHeightBlur = () => {
    if (editingHeight !== null) {
      const value = parseFloat(editingHeight);
      if (!isNaN(value) && value > 0) {
        updateSettings({ facilityHeight: getFeetFromDisplay(value, heightUnit) });
      }
      setEditingHeight(null);
    }
  };

  const handleSquareSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ squareSize: parseFloat(e.target.value) });
  };

  const handleTypicalFlowUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const selectedOption = UNIT_FOOTPRINT_OPTIONS.find(opt => opt.value === value);
    if (selectedOption && value !== 'custom') {
      updateSettings({ typicalFlowUnit: value, unitFootprintSqFt: selectedOption.sqFt });
    } else {
      updateSettings({ typicalFlowUnit: value });
    }
  };

  const handleStackingHeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ stackingHeight: parseInt(e.target.value) });
  };

  const handleAccessFactorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ accessFactor: parseFloat(e.target.value) });
  };

  const handleCustomUnitFootprintChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      updateSettings({ unitFootprintSqFt: value });
    }
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

  const effectiveSqFt = ((settings.unitFootprintSqFt || 4) * (settings.accessFactor || 1.3) / (settings.stackingHeight || 1));

  return (
    <div className="space-y-3">

      {/* ── Facility Settings ── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setFacilityOpen(!facilityOpen)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Facility Settings</span>
            <span className="text-xs text-gray-500">
              {gridDimensions.cols}×{gridDimensions.rows} grid • {usableFloorDisplay}
            </span>
          </div>
          {facilityOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {facilityOpen && (
          <div className="p-4 space-y-4">
            {/* Measurement System */}
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

            {/* Width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facility Width</label>
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

            {/* Height */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facility Height</label>
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

            {/* Grid Square Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grid Square Size</label>
              <select
                value={settings.squareSize}
                onChange={handleSquareSizeChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
              >
                {squareOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Grid</span>
                <span className="font-semibold text-gray-900">{gridDimensions.cols} × {gridDimensions.rows} ({totalSquares} squares)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Usable floor</span>
                <span className="font-semibold text-gray-900">{usableFloorDisplay}</span>
              </div>
            </div>

            {/* Zone Sizing */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Zone Sizing</h3>
              <p className="text-xs text-gray-500 mb-3">
                How much floor space does one unit of freight claim? Used to recommend zone sizes in Step 2F.
              </p>

              <div className="space-y-3">
                {/* Flow Unit */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">What flows through your facility?</label>
                  <select
                    value={settings.typicalFlowUnit || 'box'}
                    onChange={handleTypicalFlowUnitChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                  >
                    {UNIT_FOOTPRINT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {settings.typicalFlowUnit === 'custom' ? (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 mb-1">Floor space per unit (sq ft)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.unitFootprintSqFt || 0}
                        onChange={handleCustomUnitFootprintChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter sq ft per unit"
                      />
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">
                      {UNIT_FOOTPRINT_OPTIONS.find(opt => opt.value === (settings.typicalFlowUnit || 'box'))?.description}
                    </p>
                  )}
                </div>

                {/* Stacking */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Stacking</label>
                  <select
                    value={settings.stackingHeight || 1}
                    onChange={handleStackingHeightChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                  >
                    {STACKING_HEIGHT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {/* Access */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Aisle / Access Space</label>
                  <select
                    value={settings.accessFactor || 1.3}
                    onChange={handleAccessFactorChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                  >
                    {ACCESS_FACTOR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {/* Effective footprint */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-700">Effective floor claim per unit</span>
                    <span className="text-sm font-bold text-blue-900">{effectiveSqFt.toFixed(1)} sq ft</span>
                  </div>
                  <p className="text-xs text-blue-500 mt-1">
                    {settings.unitFootprintSqFt || 4} sq ft × {settings.accessFactor || 1.3}x access
                    {(settings.stackingHeight || 1) > 1 ? ` ÷ ${settings.stackingHeight} high` : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Doors & Openings ── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setDoorsOpen(!doorsOpen)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Doors & Openings</span>
            {doors.length > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-600">
                {doors.length}
              </span>
            )}
          </div>
          {doorsOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {doorsOpen && (
          <div className="p-4">
            <DoorControls />
          </div>
        )}
      </div>
    </div>
  );
}
