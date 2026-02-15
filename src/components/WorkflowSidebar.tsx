import { useState, useEffect } from 'react';
import { useGridStore } from '../store/gridStore';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, Circle, Lock } from 'lucide-react';
import { PaintModeControls } from './PaintModeControls';
import { FloorSettings } from './FloorSettings';
import { ActivityList } from './ActivityList';
import { VolumeTimingInput } from './VolumeTimingInput';
import { RelationshipRating } from './RelationshipRating';
import { LayoutBuilder } from './LayoutBuilder';
import { exportFloorPlanPDF } from '../utils/pdfExport';

const STEP_COLORS = {
  step1: 'border-red-500',
  step2: 'border-blue-500',
  step3: 'border-yellow-500',
  step4: 'border-green-500',
  step5: 'border-purple-500',
};

interface StepProps {
  stepNumber: number;
  stepKey: 'step1' | 'step2' | 'step3' | 'step4';
  title: string;
  colorClass: string;
  isCompleted: boolean;
  isLocked: boolean;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onComplete: () => void;
  coaching: string;
  children?: React.ReactNode;
  showCompletion?: boolean;
}

function Step({
  stepNumber,
  title,
  colorClass,
  isCompleted,
  isLocked,
  isActive,
  isExpanded,
  onToggle,
  onComplete,
  coaching,
  children,
  showCompletion = true,
}: StepProps) {
  return (
    <div className={`border-l-4 ${colorClass} bg-white rounded-r-lg shadow-sm mb-4`}>
      <button
        onClick={() => !isLocked && onToggle()}
        disabled={isLocked}
        className={`w-full px-4 py-3 flex items-center justify-between ${
          isLocked ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'
        } transition-colors`}
      >
        <div className="flex items-center gap-3">
          {isLocked ? (
            <Lock className="w-5 h-5 text-gray-400" />
          ) : isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-900">
              Step {stepNumber}: {title}
            </div>
            {isLocked && (
              <div className="text-xs text-gray-500">Complete previous step first</div>
            )}
          </div>
        </div>
        {!isLocked && (isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />)}
      </button>

      {isExpanded && !isLocked && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-sm text-gray-600 italic">{coaching}</p>
          {children}
          {showCompletion && !isCompleted && (
            <button
              onClick={onComplete}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Yes, this step is complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkflowSidebar() {
  const {
    sidebarOpen,
    setSidebarOpen,
    stepCompletion,
    completeStep,
    isDrawingZone,
    setIsDrawingZone,
    setZoneDrawStart,
    paintMode,
    setPaintMode,
    isDrawingCorridor,
    setIsDrawingCorridor,
    setCorridorDrawStart,
    setSelectedCorridorType,
  } = useGridStore();
  const [expandedSubStep, setExpandedSubStep] = useState<string>('2a');
  const [step1Checklist, setStep1Checklist] = useState({
    walked: false,
    removed: false,
    onlyNeeded: false,
  });
  const [step3Checklist, setStep3Checklist] = useState({
    swept: false,
    removedOld: false,
    ready: false,
  });
  const [expandedSteps, setExpandedSteps] = useState<{[key: string]: boolean}>({
    step1: false,
    step2: false,
    step3: false,
    step4: false,
  });

  const currentStep = !stepCompletion.step1
    ? 1
    : !stepCompletion.step2
    ? 2
    : !stepCompletion.step3
    ? 3
    : !stepCompletion.step4
    ? 4
    : 5;

  useEffect(() => {
    setExpandedSteps({
      step1: currentStep === 1,
      step2: currentStep === 2,
      step3: currentStep === 3,
      step4: currentStep === 4,
    });
  }, [currentStep]);

  useEffect(() => {
    if (expandedSubStep !== '2f' && isDrawingZone) {
      setIsDrawingZone(false);
      setZoneDrawStart(null);
    }
    if (expandedSubStep !== '2f' && isDrawingCorridor) {
      setIsDrawingCorridor(false);
      setCorridorDrawStart(null);
      setSelectedCorridorType(null);
    }
    if (expandedSubStep !== '2b' && paintMode) {
      setPaintMode(null);
    }
  }, [expandedSubStep, isDrawingZone, isDrawingCorridor, paintMode, setIsDrawingZone, setZoneDrawStart, setIsDrawingCorridor, setCorridorDrawStart, setSelectedCorridorType, setPaintMode]);

  useEffect(() => {
    if (!expandedSteps.step2) {
      if (isDrawingZone) {
        setIsDrawingZone(false);
        setZoneDrawStart(null);
      }
      if (isDrawingCorridor) {
        setIsDrawingCorridor(false);
        setCorridorDrawStart(null);
        setSelectedCorridorType(null);
      }
      if (paintMode) {
        setPaintMode(null);
      }
    }
  }, [expandedSteps.step2, isDrawingZone, isDrawingCorridor, paintMode, setIsDrawingZone, setZoneDrawStart, setIsDrawingCorridor, setCorridorDrawStart, setSelectedCorridorType, setPaintMode]);

  const handleStepComplete = (step: 'step1' | 'step2' | 'step3' | 'step4') => {
    completeStep(step);
  };

  return (
    <>
      <div
        className={`fixed left-0 top-0 h-full bg-gray-50 border-r border-gray-200 transition-transform duration-300 ease-in-out z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '380px' }}
      >
        <div className="h-full flex flex-col">
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <h1 className="text-lg font-bold text-gray-900">Sensei Bot FlowGrid</h1>
            <p className="text-sm text-gray-600">Step {currentStep} of 5</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <Step
              stepNumber={1}
              stepKey="step1"
              title="SORT - REMOVE WHAT DOESN'T BELONG"
              colorClass={STEP_COLORS.step1}
              isCompleted={stepCompletion.step1}
              isLocked={false}
              isActive={currentStep === 1}
              isExpanded={expandedSteps.step1}
              onToggle={() => setExpandedSteps({...expandedSteps, step1: !expandedSteps.step1})}
              onComplete={() => handleStepComplete('step1')}
              coaching="Before organizing, walk your floor and remove anything that does not need to be there — broken equipment, unused pallets, stored junk, items that belong somewhere else. Only things that NEED to be on this floor should remain."
            >
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What good looks like:</h4>
                <ul className="text-sm text-gray-600 space-y-1 mb-4 list-disc pl-5">
                  <li>Every item on the floor has a clear purpose</li>
                  <li>Broken or unused items have been removed or relocated</li>
                  <li>Only what is needed for daily operations remains</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={step1Checklist.walked}
                    onChange={(e) =>
                      setStep1Checklist({ ...step1Checklist, walked: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>We walked the floor and identified unneeded items</span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={step1Checklist.removed}
                    onChange={(e) =>
                      setStep1Checklist({ ...step1Checklist, removed: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>Unneeded items have been removed or relocated</span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={step1Checklist.onlyNeeded}
                    onChange={(e) =>
                      setStep1Checklist({ ...step1Checklist, onlyNeeded: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>Only items required for operations remain on the floor</span>
                </label>
              </div>
            </Step>

            <Step
              stepNumber={2}
              stepKey="step2"
              title="SET IN ORDER - A PLACE FOR EVERYTHING"
              colorClass={STEP_COLORS.step2}
              isCompleted={stepCompletion.step2}
              isLocked={!stepCompletion.step1}
              isActive={currentStep === 2}
              isExpanded={expandedSteps.step2}
              onToggle={() => setExpandedSteps({...expandedSteps, step2: !expandedSteps.step2})}
              onComplete={() => handleStepComplete('step2')}
              coaching="Now that only needed items remain, organize them. Define your space, decide what is fixed and what can move, place your equipment, and create clear work zones."
              showCompletion={false}
            >
              <div className="space-y-3">
                <SubStep
                  title="2A: SET UP YOUR FLOOR"
                  isExpanded={expandedSubStep === '2a'}
                  onToggle={() => setExpandedSubStep(expandedSubStep === '2a' ? '' : '2a')}
                >
                  <FloorSettings />
                </SubStep>

                <SubStep
                  title="2B: MARK WHAT STAYS AND WHAT MOVES"
                  isExpanded={expandedSubStep === '2b'}
                  onToggle={() => {
                    const newValue = expandedSubStep === '2b' ? '' : '2b';
                    setExpandedSubStep(newValue);
                    if (newValue !== '2b' && paintMode) {
                      setPaintMode(null);
                    }
                  }}
                >
                  <PaintModeControls />
                </SubStep>

                <SubStep
                  title="2C: LIST YOUR WORK ACTIVITIES"
                  isExpanded={expandedSubStep === '2c'}
                  onToggle={() => setExpandedSubStep(expandedSubStep === '2c' ? '' : '2c')}
                >
                  <ActivityList />
                </SubStep>

                <SubStep
                  title="2D: ENTER VOLUMES AND TIMING"
                  isExpanded={expandedSubStep === '2d'}
                  onToggle={() => setExpandedSubStep(expandedSubStep === '2d' ? '' : '2d')}
                >
                  <VolumeTimingInput />
                </SubStep>

                <SubStep
                  title="2E: RATE WHICH AREAS NEED TO BE CLOSE"
                  isExpanded={expandedSubStep === '2e'}
                  onToggle={() => setExpandedSubStep(expandedSubStep === '2e' ? '' : '2e')}
                >
                  <RelationshipRating />
                </SubStep>

                <SubStep
                  title="2F: BUILD YOUR LAYOUT"
                  isExpanded={expandedSubStep === '2f'}
                  onToggle={() => {
                    const newValue = expandedSubStep === '2f' ? '' : '2f';
                    setExpandedSubStep(newValue);
                    if (newValue !== '2f' && isDrawingZone) {
                      setIsDrawingZone(false);
                      setZoneDrawStart(null);
                    }
                    if (newValue !== '2f' && paintMode) {
                      setPaintMode(null);
                    }
                  }}
                >
                  <LayoutBuilder />
                </SubStep>
              </div>

              {!stepCompletion.step2 && (
                <button
                  onClick={() => handleStepComplete('step2')}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-md transition-colors mt-4"
                >
                  Yes, this step is complete
                </button>
              )}
            </Step>

            <Step
              stepNumber={3}
              stepKey="step3"
              title="SHINE - CLEAN AND PREPARE THE FLOOR"
              colorClass={STEP_COLORS.step3}
              isCompleted={stepCompletion.step3}
              isLocked={!stepCompletion.step2}
              isActive={currentStep === 3}
              isExpanded={expandedSteps.step3}
              onToggle={() => setExpandedSteps({...expandedSteps, step3: !expandedSteps.step3})}
              onComplete={() => handleStepComplete('step3')}
              coaching="Your layout is planned. Before implementing it, clean the floor. Remove old tape, sweep the surface, clear debris from the areas where you will place equipment and mark lanes."
            >
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What good looks like:</h4>
                <ul className="text-sm text-gray-600 space-y-1 mb-4 list-disc pl-5">
                  <li>The floor is clean and clear of debris in all work zones</li>
                  <li>Old markings, tape, or paint that conflict with the new layout are removed</li>
                  <li>The floor surface is ready for new grid markings and lane tape</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={step3Checklist.swept}
                    onChange={(e) =>
                      setStep3Checklist({ ...step3Checklist, swept: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>Floor has been swept and cleaned</span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={step3Checklist.removedOld}
                    onChange={(e) =>
                      setStep3Checklist({ ...step3Checklist, removedOld: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>Old conflicting markings have been removed</span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={step3Checklist.ready}
                    onChange={(e) =>
                      setStep3Checklist({ ...step3Checklist, ready: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>Floor is ready for new layout markings</span>
                </label>
              </div>
            </Step>

            <Step
              stepNumber={4}
              stepKey="step4"
              title="STANDARDIZE - MAKE IT THE RULE"
              colorClass={STEP_COLORS.step4}
              isCompleted={stepCompletion.step4}
              isLocked={!stepCompletion.step3}
              isActive={currentStep === 4}
              isExpanded={expandedSteps.step4}
              onToggle={() => setExpandedSteps({...expandedSteps, step4: !expandedSteps.step4})}
              onComplete={() => handleStepComplete('step4')}
              coaching="Your layout is now your standard — the way the floor should look every day. Document it so everyone knows what right looks like."
            >
              <div className="space-y-3">
                <button
                  onClick={exportFloorPlanPDF}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors text-sm"
                >
                  Export Floor Plan (PDF)
                </button>
                <button
                  disabled
                  className="w-full bg-gray-300 text-gray-500 font-medium py-2 px-4 rounded-md cursor-not-allowed text-sm"
                >
                  Export Setup Instructions (Coming Soon)
                </button>
                <button
                  disabled
                  className="w-full bg-gray-300 text-gray-500 font-medium py-2 px-4 rounded-md cursor-not-allowed text-sm"
                >
                  Save as Standard Layout (Coming Soon)
                </button>
              </div>
            </Step>

            <div className={`border-l-4 ${STEP_COLORS.step5} bg-white rounded-r-lg shadow-sm mb-4`}>
              <button
                onClick={() => {}}
                disabled={!stepCompletion.step4}
                className={`w-full px-4 py-3 flex items-center justify-between ${
                  !stepCompletion.step4 ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'
                } transition-colors`}
              >
                <div className="flex items-center gap-3">
                  {!stepCompletion.step4 ? (
                    <Lock className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-purple-500" />
                  )}
                  <div className="text-left">
                    <div className="text-sm font-semibold text-gray-900">
                      Step 5: SUSTAIN - KEEP IT GOING
                    </div>
                    {!stepCompletion.step4 && (
                      <div className="text-xs text-gray-500">Complete previous step first</div>
                    )}
                  </div>
                </div>
              </button>

              {stepCompletion.step4 && (
                <div className="px-4 pb-4 space-y-4">
                  <p className="text-sm text-gray-600 italic">
                    The hardest part of any improvement is making it last. Use this tool regularly to
                    check that your floor still matches the standard and to plan adjustments when
                    things change.
                  </p>
                  <div className="space-y-3">
                    <button
                      disabled
                      className="w-full bg-gray-300 text-gray-500 font-medium py-2 px-4 rounded-md cursor-not-allowed text-sm"
                    >
                      Compare to Standard (Coming Soon)
                    </button>
                    <button
                      disabled
                      className="w-full bg-gray-300 text-gray-500 font-medium py-2 px-4 rounded-md cursor-not-allowed text-sm"
                    >
                      Schedule a Review (Coming Soon)
                    </button>
                    <button
                      disabled
                      className="w-full bg-gray-300 text-gray-500 font-medium py-2 px-4 rounded-md cursor-not-allowed text-sm"
                    >
                      Improvement Log (Coming Soon)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed top-4 z-50 bg-white border border-gray-300 rounded-md p-2 shadow-md hover:bg-gray-50 transition-all ${
          sidebarOpen ? 'left-[388px]' : 'left-4'
        }`}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-600" />
        )}
      </button>
    </>
  );
}

function SubStep({
  title,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-md bg-gray-50">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors rounded-md"
      >
        <span className="text-sm font-medium text-gray-900">{title}</span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {isExpanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
