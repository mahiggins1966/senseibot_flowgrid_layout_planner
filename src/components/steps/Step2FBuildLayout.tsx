import { GridCanvas } from '../GridCanvas';
import { ObjectLibrary } from '../ObjectLibrary';
import { ActivityZoneDrawer } from '../ActivityZoneDrawer';
import { ActivityZonePopup } from '../ActivityZonePopup';
import { ScoringPanel } from '../ScoringPanel';
import { CorridorDrawer } from '../CorridorDrawer';
import { FlowPathDrawer } from '../FlowPathDrawer';
import { CorridorPopup } from '../CorridorPopup';
import { useGridStore } from '../../store/gridStore';
import { Eye, EyeOff } from 'lucide-react';
import { OSHA_LEGEND } from '../../utils/oshaColors';

interface Step2FBuildLayoutProps {
  onComplete: () => void;
}

export function Step2FBuildLayout({ onComplete }: Step2FBuildLayoutProps) {
  const { completeStep, safetyOverlayEnabled, toggleSafetyOverlay } = useGridStore();

  const handleComplete = () => {
    completeStep('step2');
    onComplete();
  };

  return (
    <>
      <ActivityZonePopup />
      <CorridorPopup />

      <div className="flex h-full w-full">
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
        <div className="p-4 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">2F: Build Your Layout</h2>
            <p className="text-sm text-gray-600">
              Draw work areas for each activity, then place equipment. The grid shows everything from your floor setup.
            </p>
          </div>

          <div className="space-y-4" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
            <ActivityZoneDrawer />
            <ObjectLibrary />
            <CorridorDrawer />
            <FlowPathDrawer />
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleComplete}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              Complete Step 2 →
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-gray-100 overflow-hidden relative flex flex-col">
        {/* Safety Overlay Toggle and Color Legend */}
        <div className="bg-white border-b border-gray-300 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSafetyOverlay}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                safetyOverlayEnabled
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {safetyOverlayEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span>Safety View</span>
            </button>

            <div className="text-xs text-gray-600">
              <div className="font-semibold mb-1">Colors follow OSHA/ANSI workplace safety standards</div>
              <div className="flex flex-wrap gap-3">
                {OSHA_LEGEND.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded border"
                      style={{ backgroundColor: item.color, borderColor: item.border }}
                    />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <GridCanvas />
        </div>
      </div>

      <ScoringPanel />
    </div>
    </>
  );
}
