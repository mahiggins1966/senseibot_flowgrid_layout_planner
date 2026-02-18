import { useEffect, useState } from 'react';
import { Step2AFloorSetup } from './steps/Step2AFloorSetup';
import { Step2BMarkStays } from './steps/Step2BMarkStays';
import { Step2CActivities } from './steps/Step2CActivities';
import { Step2DVolumes } from './steps/Step2DVolumes';
import { Step2ECloseness } from './steps/Step2ECloseness';
import { GridCanvas } from './GridCanvas';
import { FloorSettings } from './FloorSettings';
import { PaintModeControls } from './PaintModeControls';
import { ObjectLibrary } from './ObjectLibrary';
import { ActivityZoneDrawer } from './ActivityZoneDrawer';
import { ActivityZonePopup } from './ActivityZonePopup';
import { CorridorPopup } from './CorridorPopup';
import CorridorDrawingPanel from './CorridorDrawingPanel';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { calculateLayoutScore, LayoutScore } from '../utils/scoring';
import { exportFloorPlanPDF } from '../utils/pdfExport';
import { exportSetupInstructions } from '../utils/setupInstructionsExport';
import { X, CheckCircle, AlertTriangle, XCircle, ChevronRight, FileText, ClipboardList, PlusCircle, Check } from 'lucide-react';
import { getEquipmentIcon } from './ObjectLibrary';

type SubStep = '2a' | '2b' | '2c' | '2d' | '2e' | '2f';

interface StepRouterProps {
  currentSubStep: SubStep;
  onSubStepChange: (subStep: SubStep) => void;
  onTryAnotherLayout?: () => void;
}

export function StepRouter({
  currentSubStep,
  onSubStepChange,
  onTryAnotherLayout,
}: StepRouterProps) {
  const {
    zones,
    activities,
    settings,
    activityRelationships,
    volumeTiming,
    doors,
    corridors,
    paintedSquares,
    getGridDimensions,
    dismissedFlags,
    dismissFlag,
    hoveredSquare,
    showCustomEquipmentForm,
    setShowCustomEquipmentForm,
    customObjects,
    setCustomObjects,
  } = useGridStore();

  const [scoreData, setScoreData] = useState<LayoutScore | null>(null);
  const [spaceMetrics, setSpaceMetrics] = useState<{ totalSpaceSqFt: number; availableSpaceSqFt: number }>({ totalSpaceSqFt: 0, availableSpaceSqFt: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());
  const [equipForm, setEquipForm] = useState({ name: '', grid_width: 1, grid_length: 1, color: '#6B7280' });
  const [equipSaving, setEquipSaving] = useState(false);

  useEffect(() => {
    if (currentSubStep === '2f') {
      const gridDims = getGridDimensions();
      const score = calculateLayoutScore(
        zones,
        activities,
        settings,
        activityRelationships,
        volumeTiming,
        doors,
        corridors,
        paintedSquares,
        gridDims,
        dismissedFlags
      );
      setScoreData(score);

      // Save score to layouts table so dashboard/home can show it
      const { activeLayoutId, activeProjectId } = useGridStore.getState();
      if (activeLayoutId) {
        const now = new Date().toISOString();
        supabase
          .from('layouts')
          .update({ score_percentage: score.percentage, updated_at: now })
          .eq('id', activeLayoutId)
          .then(({ error }) => {
            if (error) console.error('Error saving score:', error);
          });
        // Also bump project updated_at
        supabase
          .from('projects')
          .update({ updated_at: now })
          .eq('id', activeProjectId)
          .then(() => {});
      }

      if (score.percentage > bestScore) {
        setBestScore(score.percentage);
      }

      const totalSquares = gridDims.rows * gridDims.cols;
      const totalSpaceSqFt = settings.facilityWidth * settings.facilityHeight;

      let permanentCount = 0;
      let semiFixedCount = 0;

      paintedSquares.forEach((square) => {
        if (square.type === 'permanent') permanentCount++;
        else if (square.type === 'semi-fixed') semiFixedCount++;
      });

      const doorSquares = doors.reduce((sum, door) => sum + door.width, 0);
      const occupiedSquares = permanentCount + semiFixedCount + doorSquares;
      const availableSquares = totalSquares - occupiedSquares;
      const availableSpaceSqFt = availableSquares * (settings.squareSize * settings.squareSize);

      setSpaceMetrics({
        totalSpaceSqFt,
        availableSpaceSqFt,
      });
    }
  }, [currentSubStep, zones, activities, settings, activityRelationships, volumeTiming, doors, corridors, paintedSquares, dismissedFlags, getGridDimensions, bestScore]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        closeDrawer();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [drawerOpen]);

  const getScoreColor = (percentage: number): string => {
    if (percentage >= 85) return '#22c55e';
    if (percentage >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getFactorScoreColor = (score: number, maxScore: number): string => {
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    if (percentage >= 95) return '#22c55e';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getFactorStatusIcon = (score: number, maxScore: number) => {
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    if (percentage >= 90) return <CheckCircle size={20} color="#22c55e" />;
    if (percentage >= 50) return <AlertTriangle size={20} color="#f59e0b" />;
    return <XCircle size={20} color="#ef4444" />;
  };

  const toggleFactorExpanded = (factorName: string) => {
    setExpandedFactors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(factorName)) {
        newSet.delete(factorName);
      } else {
        newSet.add(factorName);
      }
      return newSet;
    });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setExpandedFactors(new Set());
  };

  const DEFAULT_EQUIP_COLORS = ['#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

  const handleSaveCustomEquipment = async () => {
    if (!equipForm.name.trim()) return;
    setEquipSaving(true);
    const { data, error } = await supabase
      .from('custom_objects')
      .insert({
        name: equipForm.name.trim(),
        width_inches: equipForm.grid_width * 48,
        length_inches: equipForm.grid_length * 48,
        height_inches: 48,
        color: equipForm.color,
        grid_width: equipForm.grid_width,
        grid_length: equipForm.grid_length,
        is_default: false,
      })
      .select()
      .single();
    setEquipSaving(false);
    if (error) { console.error('Error creating custom object:', error); return; }
    if (data) {
      setCustomObjects([...customObjects, data as any]);
      setEquipForm({ name: '', grid_width: 1, grid_length: 1, color: '#6B7280' });
      setShowCustomEquipmentForm(false);
    }
  };

  const showGrid = ['2a', '2b', '2f'].includes(currentSubStep);

  return (
    <>
      {currentSubStep === '2f' && <ActivityZonePopup />}
      {currentSubStep === '2f' && <CorridorPopup />}

      <div className="flex h-full w-full relative">
        <div className={`absolute inset-0 flex ${showGrid ? 'visible' : 'invisible pointer-events-none'}`}>
          <div className={`bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0 ${currentSubStep === '2f' ? 'w-80' : 'w-96'}`}>
            <div className={`space-y-6 ${currentSubStep === '2f' ? 'p-4' : 'p-6'}`}>
              {currentSubStep === '2a' && (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Floor Setup</h2>
                    <p className="text-sm text-gray-600">
                      Define your facility dimensions, choose your grid size, and add doors or openings.
                    </p>
                  </div>
                  <FloorSettings />
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => onSubStepChange('2b')}
                      className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Next: Mark What Stays →
                    </button>
                  </div>
                </>
              )}

              {currentSubStep === '2b' && (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Mark What Stays and What Moves</h2>
                    <p className="text-sm text-gray-600">
                      Paint the grid to show which areas are permanent (walls, fixed equipment) and which can be rearranged.
                    </p>
                  </div>
                  <PaintModeControls />
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => onSubStepChange('2c')}
                      className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Next: List Activities →
                    </button>
                  </div>
                </>
              )}

              {currentSubStep === '2f' && (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Build Your Layout</h2>
                    <p className="text-sm text-gray-600">
                      Draw work areas for each activity, then place equipment. The grid shows everything from your floor setup.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <details>
                      <summary style={{ fontWeight: 'bold', cursor: 'pointer', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Draw Work Areas</span>
                        <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#6b7280' }}>
                          {zones.filter(z => z.activity_id).length} of {activities.length} placed
                        </span>
                      </summary>
                      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <ActivityZoneDrawer />
                      </div>
                    </details>

                    <details>
                      <summary style={{ fontWeight: 'bold', cursor: 'pointer', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Equipment Library</span>
                      </summary>
                      <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        <ObjectLibrary />
                      </div>
                    </details>

                    <details>
                      <summary style={{ fontWeight: 'bold', cursor: 'pointer', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Draw Corridors and Paths</span>
                        <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#6b7280' }}>
                          {corridors.length} {corridors.length === 1 ? 'path' : 'paths'}
                        </span>
                      </summary>
                      <div style={{ padding: '8px' }}>
                        <CorridorDrawingPanel />
                      </div>
                    </details>
                  </div>

                  {/* Export buttons */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Export</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => exportFloorPlanPDF(scoreData ? {
                          scoreData,
                          facilityWidth: settings.facilityWidth,
                          facilityHeight: settings.facilityHeight,
                          squareSize: settings.squareSize,
                          zoneCount: zones.filter(z => z.activity_id).length,
                          corridorCount: corridors.length,
                          doorCount: doors.length,
                          activityCount: activities.length,
                        } : undefined)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Floor Plan PDF
                      </button>
                      <button
                        onClick={() => exportSetupInstructions({
                          zones,
                          activities,
                          corridors,
                          doors,
                          facilityWidth: settings.facilityWidth,
                          facilityHeight: settings.facilityHeight,
                          squareSize: settings.squareSize,
                        })}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Setup Instructions
                      </button>
                    </div>
                  </div>

                  {/* Try Another Layout */}
                  {onTryAnotherLayout && (
                    <div className="pt-3 border-t border-gray-200">
                      <button
                        onClick={onTryAnotherLayout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-lg transition-colors border border-blue-200"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Try Another Layout
                      </button>
                      <p className="text-[10px] text-gray-400 mt-1.5 text-center">Fresh grid, same foundation</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex-1 bg-gray-100 overflow-hidden relative">
            <GridCanvas />

            {/* Custom Equipment Form Popup */}
            {currentSubStep === '2f' && showCustomEquipmentForm && (
              <div
                className="absolute"
                style={{
                  top: '12px',
                  right: '244px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  padding: '16px',
                  width: '280px',
                  zIndex: 35,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-900">New Custom Equipment</span>
                  <button
                    onClick={() => setShowCustomEquipmentForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Name</label>
                    <input
                      type="text"
                      value={equipForm.name}
                      onChange={(e) => setEquipForm({ ...equipForm, name: e.target.value })}
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
                        value={equipForm.grid_width}
                        onChange={(e) => setEquipForm({ ...equipForm, grid_width: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Length (squares)</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={equipForm.grid_length}
                        onChange={(e) => setEquipForm({ ...equipForm, grid_length: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Color</label>
                    <div className="flex items-center gap-2">
                      {DEFAULT_EQUIP_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEquipForm({ ...equipForm, color: c })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            equipForm.color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <input
                        type="color"
                        value={equipForm.color}
                        onChange={(e) => setEquipForm({ ...equipForm, color: e.target.value })}
                        className="w-6 h-6 border border-gray-300 rounded cursor-pointer"
                        title="Custom color"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border border-gray-200">
                    <div
                      className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: equipForm.color }}
                    >
                      {(() => {
                        const PreviewIcon = getEquipmentIcon(equipForm.name);
                        return <PreviewIcon className="w-4 h-4 text-white" />;
                      })()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {equipForm.name || 'Equipment'} — {equipForm.grid_width} × {equipForm.grid_length}
                    </div>
                  </div>

                  <button
                    onClick={handleSaveCustomEquipment}
                    disabled={!equipForm.name.trim() || equipSaving}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check size={14} />
                    {equipSaving ? 'Saving...' : 'Add to Library'}
                  </button>
                </div>
              </div>
            )}

            {/* Dashboard Card */}
            {currentSubStep === '2f' && scoreData && (
              <div
                className="absolute"
                style={{
                  top: '12px',
                  right: '12px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  padding: '12px',
                  maxWidth: '220px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  zIndex: 30,
                }}
              >
                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
                  <div>
                    Position: {hoveredSquare ? hoveredSquare.label : '—'}
                  </div>
                  <div>
                    {spaceMetrics.totalSpaceSqFt.toLocaleString()} sq ft total
                  </div>
                  <div>
                    {spaceMetrics.availableSpaceSqFt.toLocaleString()} available
                  </div>
                </div>

                <div
                  onClick={() => {
                    if (!drawerOpen) {
                      setExpandedFactors(new Set());
                    }
                    setDrawerOpen(!drawerOpen);
                  }}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    border: `3px solid ${getScoreColor(scoreData.percentage)}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.3s ease',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#1f2937',
                    lineHeight: 1,
                  }}>
                    {scoreData.percentage}%
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#6b7280',
                    marginTop: '2px',
                  }}>
                    {scoreData.total}/{scoreData.maxTotal}
                  </div>
                </div>
              </div>
            )}

            {/* Overlay when drawer is open */}
            {currentSubStep === '2f' && drawerOpen && (
              <div
                onClick={closeDrawer}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  zIndex: 25,
                  cursor: 'pointer',
                }}
              />
            )}

            {/* Scoring Drawer */}
            {currentSubStep === '2f' && scoreData && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '40%',
                  backgroundColor: 'white',
                  borderTop: '1px solid #e5e7eb',
                  borderRadius: '12px 12px 0 0',
                  boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
                  transform: drawerOpen ? 'translateY(0)' : 'translateY(100%)',
                  transition: 'transform 300ms ease',
                  zIndex: 26,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Drawer Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Layout Score</span>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      {scoreData.percentage}% — {scoreData.total} / {scoreData.maxTotal} points
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      Best this session: {bestScore}%
                    </span>
                    <button
                      onClick={closeDrawer}
                      style={{
                        padding: '4px',
                        cursor: 'pointer',
                        border: 'none',
                        backgroundColor: 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6b7280',
                      }}
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Drawer Body */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {scoreData.factors.map((factor) => {
                    const isExpanded = expandedFactors.has(factor.name);
                    const percentage = factor.maxScore > 0 ? (factor.score / factor.maxScore) * 100 : 0;
                    const scoreColor = getFactorScoreColor(factor.score, factor.maxScore);

                    return (
                      <div key={factor.name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <div
                          onClick={() => toggleFactorExpanded(factor.name)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px 16px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease',
                            minHeight: '44px',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <div style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
                            {getFactorStatusIcon(factor.score, factor.maxScore)}
                          </div>
                          <div style={{ flex: 1, fontWeight: 'bold', fontSize: '14px', color: '#1f2937' }}>
                            {factor.label.split(':')[0]}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginRight: '12px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: scoreColor }}>
                              {factor.score}
                            </span>
                            <span style={{ fontSize: '14px', color: '#6b7280' }}>
                              / {factor.maxScore}
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                          }}>
                            <ChevronRight size={20} color="#6b7280" />
                          </div>
                        </div>

                        <div style={{
                          maxHeight: isExpanded ? '1000px' : '0',
                          overflow: 'hidden',
                          transition: 'max-height 0.2s ease',
                        }}>
                          <div style={{ padding: '0 16px 16px 48px' }}>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                              {factor.label.split(':')[1]?.trim() || ''}
                            </div>
                            <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '12px' }}>
                              {factor.display}
                            </div>

                            {percentage >= 95 && factor.details.length === 0 && (!factor.flags || factor.flags.filter(f => !f.isDismissed).length === 0) ? (
                              <div style={{ fontSize: '13px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle size={16} />
                                No issues found
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {factor.details.map((detail, idx) => (
                                  <div
                                    key={`detail-${idx}`}
                                    style={{
                                      borderLeft: `3px solid ${detail.startsWith('⚠') ? '#f59e0b' : detail.startsWith('ℹ') ? '#3b82f6' : '#ef4444'}`,
                                      padding: '8px 12px',
                                      backgroundColor: '#f9fafb',
                                      fontSize: '13px',
                                      color: '#4b5563',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'start',
                                    }}
                                  >
                                    <div style={{ flex: 1 }}>{detail}</div>
                                  </div>
                                ))}

                                {factor.name === 'safety' && factor.safetyRules && factor.safetyRules.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {factor.safetyRules.map((rule: any, ruleIdx: number) => {
                                      const isGood = rule.status === 'good';
                                      const statusIcon = rule.score >= rule.maxScore ? '✓' : rule.score === 0 ? '✗' : '⚠';
                                      const statusColor = rule.score >= rule.maxScore ? '#22c55e' : rule.score === 0 ? '#ef4444' : '#f59e0b';
                                      const borderColor = rule.score >= rule.maxScore ? '#22c55e' : rule.score === 0 ? '#ef4444' : '#f59e0b';
                                      return (
                                        <div
                                          key={ruleIdx}
                                          style={{
                                            borderLeft: `3px solid ${borderColor}`,
                                            padding: '8px 12px',
                                            backgroundColor: isGood ? '#f0fdf4' : '#f9fafb',
                                            opacity: isGood ? 0.8 : 1,
                                          }}
                                        >
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{ fontSize: '14px' }}>{statusIcon}</span>
                                              <span style={{ fontWeight: 600, fontSize: '13px', color: '#1f2937' }}>{rule.rule}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span style={{ fontWeight: 600, fontSize: '13px', color: statusColor }}>
                                                {rule.score} / {rule.maxScore}
                                              </span>
                                              {!isGood && (
                                                <button
                                                  onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    dismissFlag(`safety-${rule.rule.toLowerCase().replace(/\s+/g, '-')}`);
                                                  }}
                                                  style={{
                                                    fontSize: '11px',
                                                    color: '#9ca3af',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                  }}
                                                >Dismiss</button>
                                              )}
                                            </div>
                                          </div>
                                          <div style={{ fontSize: '12px', color: isGood ? '#6b7280' : '#4b5563', paddingLeft: '20px' }}>
                                            {rule.message || 'No details available'}
                                          </div>
                                          {rule.locations && rule.locations.length > 0 && (
                                            <div style={{ fontSize: '11px', color: '#9ca3af', paddingLeft: '20px', marginTop: '2px' }}>
                                              Locations: {rule.locations.join(', ')}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {factor.flags && factor.flags.filter(f => !f.isDismissed).map((flag) => (
                                  <div
                                    key={flag.id}
                                    style={{
                                      borderLeft: `3px solid ${flag.severity === 'HIGH' ? '#ef4444' : flag.severity === 'MEDIUM' ? '#f59e0b' : '#3b82f6'}`,
                                      padding: '8px 12px',
                                      backgroundColor: '#f9fafb',
                                      fontSize: '13px',
                                      color: '#4b5563',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'start',
                                    }}
                                  >
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>{flag.message}</div>
                                      <div>{flag.recommendation}</div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        dismissFlag(flag.id);
                                      }}
                                      style={{
                                        marginLeft: '12px',
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        color: '#6b7280',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                      }}
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                ))}

                                {factor.details.length === 0 && (!factor.flags || factor.flags.filter(f => !f.isDismissed).length === 0) && (
                                  <div style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>
                                    {factor.suggestion}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`flex-1 ${showGrid ? 'invisible pointer-events-none' : 'visible'}`}>
          {currentSubStep === '2c' && <Step2CActivities onNext={() => onSubStepChange('2d')} />}
          {currentSubStep === '2d' && <Step2DVolumes onNext={() => onSubStepChange('2e')} />}
          {currentSubStep === '2e' && <Step2ECloseness onNext={() => onSubStepChange('2f')} />}
        </div>
      </div>
    </>
  );
}
