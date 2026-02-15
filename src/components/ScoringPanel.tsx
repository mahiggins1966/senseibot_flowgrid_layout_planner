import { useEffect, useState, useMemo } from 'react';
import { useGridStore } from '../store/gridStore';
import { X, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Download, CheckCircle2 } from 'lucide-react';
import { calculateLayoutScore, LayoutScore } from '../utils/scoring';
import { runAllSafetyChecks } from '../utils/safetyAnalysis';

export function ScoringPanel() {
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
    undismissFlag,
    isFlagDismissed,
  } = useGridStore();

  const [score, setScore] = useState<LayoutScore | null>(null);
  const [bestScore, setBestScore] = useState<{ total: number; maxTotal: number; percentage: number }>({ total: 0, maxTotal: 115, percentage: 0 });
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());
  const [safetyAuditExpanded, setSafetyAuditExpanded] = useState(true);

  // Calculate safety rules directly
  const safetyRules = useMemo(() => {
    const gridDims = getGridDimensions();
    return runAllSafetyChecks(gridDims, zones, corridors, doors, paintedSquares, activities);
  }, [zones, corridors, doors, paintedSquares, activities, getGridDimensions]);

  useEffect(() => {
    const gridDims = getGridDimensions();
    const newScore = calculateLayoutScore(
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

    setScore(newScore);

    if (newScore.percentage > bestScore.percentage) {
      setBestScore({ total: newScore.total, maxTotal: newScore.maxTotal, percentage: newScore.percentage });
    }
  }, [zones, activities, settings, activityRelationships, volumeTiming, doors, corridors, paintedSquares, dismissedFlags]);

  if (!score) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg p-4 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-gray-500">Calculating score...</div>
        </div>
      </div>
    );
  }

  const toggleFactor = (factorName: string) => {
    const newExpanded = new Set(expandedFactors);
    if (newExpanded.has(factorName)) {
      newExpanded.delete(factorName);
    } else {
      newExpanded.add(factorName);
    }
    setExpandedFactors(newExpanded);
  };

  const getPercentageColor = (percentage: number): string => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPercentageBackgroundColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-green-50';
    if (percentage >= 60) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'MEDIUM':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'LOW':
        return <Info className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'HIGH':
        return 'text-red-600';
      case 'MEDIUM':
        return 'text-orange-600';
      case 'LOW':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'good':
        return 'text-green-600';
      case 'warning':
        return 'text-orange-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const safetyFactor = score.factors.find(f => f.name === 'safety');

  // Sort safety flags by severity: HIGH > MEDIUM > LOW
  const severityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sortBySeverity = (a: any, b: any) => {
    const orderA = severityOrder[a.severity] ?? 999;
    const orderB = severityOrder[b.severity] ?? 999;
    return orderA - orderB;
  };

  const activeSafetyFlags = safetyFactor?.flags?.filter(f => !f.isDismissed).sort(sortBySeverity) || [];
  const dismissedSafetyFlags = safetyFactor?.flags?.filter(f => f.isDismissed).sort(sortBySeverity) || [];

  const exportSafetyReport = () => {
    if (!safetyFactor) return;

    // Check if we're using the new rule-based system or old flag system
    if (safetyFactor.safetyRules && safetyFactor.safetyRules.length > 0) {
      // New system: export safety rules
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      let report = `SAFETY AUDIT REPORT\n`;
      report += `Generated: ${new Date().toLocaleString()}\n`;
      report += `Layout Score: ${score.percentage}% (${score.total}/${score.maxTotal} points)\n`;
      report += `Safety Score: ${safetyFactor.score}/${safetyFactor.maxScore} points\n`;
      report += `\n${'='.repeat(80)}\n\n`;

      report += `SAFETY RULES EVALUATION\n`;
      report += `${'='.repeat(80)}\n\n`;

      safetyFactor.safetyRules.forEach((rule, idx) => {
        report += `${idx + 1}. ${rule.rule}\n`;
        report += `   Status: ${rule.status.toUpperCase()}\n`;
        report += `   Score: ${rule.score}/${rule.maxScore} points\n`;
        report += `   ${rule.message}\n`;
        if (rule.locations && rule.locations.length > 0) {
          report += `   Locations: ${rule.locations.join(', ')}\n`;
        }
        report += `\n`;
      });

      report += `\n${'='.repeat(80)}\n`;
      report += `END OF REPORT\n`;

      const blob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safety-audit-${timestamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (safetyFactor.flags && safetyFactor.flags.length > 0) {
      // Old system: export flags
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      let report = `SAFETY AUDIT REPORT\n`;
      report += `Generated: ${new Date().toLocaleString()}\n`;
      report += `Layout Score: ${score.percentage}% (${score.total}/${score.maxTotal} points)\n`;
      report += `Safety Score: ${safetyFactor.score}/${safetyFactor.maxScore} points\n`;
      report += `\n${'='.repeat(80)}\n\n`;

      const activeFlags = safetyFactor.flags.filter(f => !f.isDismissed).sort(sortBySeverity);
      if (activeFlags.length > 0) {
        report += `ACTIVE SAFETY FLAGS (${activeFlags.length})\n`;
        report += `${'='.repeat(80)}\n\n`;

        ['HIGH', 'MEDIUM', 'LOW'].forEach(severity => {
          const flagsOfSeverity = activeFlags.filter(f => f.severity === severity);
          if (flagsOfSeverity.length > 0) {
            report += `${severity} SEVERITY (${flagsOfSeverity.length})\n`;
            report += `${'-'.repeat(80)}\n`;
            flagsOfSeverity.forEach((flag, idx) => {
              report += `${idx + 1}. ${flag.message}\n`;
              report += `   Rule ID: ${flag.id}\n`;
              report += `   Recommendation: ${flag.recommendation}\n`;
              report += `   Point Deduction: -${flag.pointsDeduction}\n\n`;
            });
          }
        });
      }

      const dismissedFlags = safetyFactor.flags.filter(f => f.isDismissed).sort(sortBySeverity);
      if (dismissedFlags.length > 0) {
        report += `\n${'='.repeat(80)}\n\n`;
        report += `DISMISSED FLAGS (${dismissedFlags.length})\n`;
        report += `${'='.repeat(80)}\n\n`;
        dismissedFlags.forEach((flag, idx) => {
          report += `${idx + 1}. [${flag.severity}] ${flag.message}\n`;
          report += `   Rule ID: ${flag.id}\n`;
          report += `   Note: Dismissed by user\n\n`;
        });
      }

      report += `\n${'='.repeat(80)}\n`;
      report += `END OF REPORT\n`;

      const blob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safety-audit-${timestamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-gray-800 shadow-2xl z-40 max-h-[60vh] overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6">

        {/* Overall Score Header */}
        <div className={`${getPercentageBackgroundColor(score.percentage)} border-2 border-gray-300 rounded-lg p-6 mb-6`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Layout Score</div>
              <div className={`text-6xl font-bold ${getPercentageColor(score.percentage)}`}>
                {score.percentage}%
              </div>
              <div className="text-lg text-gray-700 mt-1">
                {score.total} / {score.maxTotal} points
              </div>
              <div className="text-sm text-gray-600 mt-2">{score.verdict}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-600">Best this session</div>
              <div className="text-3xl font-bold text-gray-800">{bestScore.percentage}%</div>
              <div className="text-sm text-gray-600">
                {bestScore.total} / {bestScore.maxTotal}
              </div>
            </div>
          </div>
        </div>

        {/* 7 Scoring Factors */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {score.factors.map((factor) => {
            const isExpanded = expandedFactors.has(factor.name);
            const percentage = factor.maxScore > 0 ? Math.round(((factor.score || 0) / factor.maxScore) * 100) : 0;

            return (
              <div
                key={factor.name}
                className="border-2 border-gray-300 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => toggleFactor(factor.name)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 pr-2">
                      <div className="text-sm font-bold text-gray-900 leading-tight">{factor.label}</div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-600 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold ${percentage >= 80 ? 'text-green-600' : percentage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {factor.score}
                    </span>
                    <span className="text-lg text-gray-500">/ {factor.maxScore}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{factor.display}</div>
                </button>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-700 mb-2">{factor.suggestion}</div>

                    {/* Show safety rules if they exist (new system) */}
                    {factor.name === 'safety' && safetyRules && safetyRules.length > 0 && (
                      <>
                        <div className="mb-3">
                          <button
                            onClick={exportSafetyReport}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                          >
                            <Download className="w-3 h-3" />
                            Export Safety Report
                          </button>
                        </div>
                        <div className="space-y-0 mt-3 border-t border-gray-200">
                          {safetyRules.map((rule, idx) => {
                            const needsDismiss = rule.status === 'warning' || rule.status === 'critical';
                            const isGood = rule.status === 'good';

                            return (
                              <div
                                key={idx}
                                className={`py-2 border-b border-gray-200 ${isGood ? 'opacity-70' : ''}`}
                              >
                                <div className="flex items-start gap-2">
                                  {getStatusIcon(rule.status)}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                      <span className={`font-semibold text-sm ${isGood ? 'text-gray-700' : 'text-gray-900'}`}>
                                        {rule.rule}
                                      </span>
                                      <span className={`font-semibold text-sm whitespace-nowrap ${getStatusColor(rule.status)}`}>
                                        {rule.score} / {rule.maxScore}
                                      </span>
                                    </div>
                                    <div className={`text-xs leading-relaxed ${isGood ? 'text-gray-500' : 'text-gray-700'}`}>
                                      {rule.message || <span className="italic text-gray-400">No details available</span>}
                                      {rule.locations && rule.locations.length > 0 && (
                                        <span className="block mt-1">
                                          <span className="font-medium">Locations: </span>
                                          {rule.locations.join(', ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {needsDismiss && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Note: Dismiss functionality would need to be implemented
                                        console.log('Dismiss rule:', rule.rule);
                                      }}
                                      className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors whitespace-nowrap"
                                    >
                                      Dismiss
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Show flags if they exist (old system for non-safety factors) */}
                    {factor.flags && factor.flags.length > 0 && factor.name !== 'safety' && (
                      <div className="space-y-2 mt-3">
                        {/* Active flags */}
                        {factor.flags.filter(f => !f.isDismissed).sort(sortBySeverity).map((flag) => (
                          <div
                            key={flag.id}
                            className="bg-gray-50 border border-gray-300 rounded p-2 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                {getSeverityIcon(flag.severity)}
                                <span className={`font-bold ${getSeverityColor(flag.severity)}`}>
                                  {flag.severity}
                                </span>
                              </div>
                              <span className="text-red-600 font-medium">
                                -{flag.pointsDeduction} pt{flag.pointsDeduction !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="text-gray-900 mb-1">{flag.message}</div>
                            <div className="text-gray-600 mb-2">{flag.recommendation}</div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                dismissFlag(flag.id);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                            >
                              <X className="w-3 h-3" />
                              Dismiss
                            </button>
                          </div>
                        ))}

                        {/* Dismissed flags */}
                        {factor.flags.filter(f => f.isDismissed).length > 0 && (
                          <div className="pt-2 border-t border-gray-200">
                            <div className="text-xs font-semibold text-gray-600 mb-2">Dismissed</div>
                            {factor.flags.filter(f => f.isDismissed).sort(sortBySeverity).map((flag) => (
                              <div
                                key={flag.id}
                                className="bg-gray-100 border border-gray-200 rounded p-2 text-xs opacity-60 mb-1"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="text-gray-600 line-through mb-1">{flag.message}</div>
                                    <div className="text-gray-500 italic">Dismissed by user</div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      undismissFlag(flag.id);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-300 rounded transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                    Restore
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Show old-style details if they exist and no flags or safety rules */}
                    {factor.details && factor.details.length > 0 && (!factor.flags || factor.flags.length === 0) && !factor.safetyRules && (
                      <ul className="text-xs text-gray-600 space-y-1 pl-4 list-disc">
                        {factor.details.map((detail, idx) => (
                          <li key={idx}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Safety Audit Log - Only show for old flag-based system */}
        {safetyFactor && (safetyFactor.flags && safetyFactor.flags.length > 0) && !safetyFactor.safetyRules && (
          <div className="border-2 border-orange-300 rounded-lg bg-orange-50 mt-6">
            <div className="px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => setSafetyAuditExpanded(!safetyAuditExpanded)}
                className="flex-1 flex items-center justify-between hover:bg-orange-100 transition-colors rounded-lg px-3 py-2 -ml-3"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="font-bold text-orange-900">Safety Audit Log</div>
                    <div className="text-xs text-orange-700">
                      Rule-Based Safety Audit — each flag traces to a specific rule and grid coordinate
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-orange-800">
                    {activeSafetyFlags.filter(f => f.severity === 'HIGH').length} HIGH |{' '}
                    {activeSafetyFlags.filter(f => f.severity === 'MEDIUM').length} MEDIUM |{' '}
                    {activeSafetyFlags.filter(f => f.severity === 'LOW').length} LOW
                    {dismissedSafetyFlags.length > 0 && ` — ${dismissedSafetyFlags.length} dismissed`}
                  </div>
                  {safetyAuditExpanded ? (
                    <ChevronUp className="w-5 h-5 text-orange-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-orange-600" />
                  )}
                </div>
              </button>
              <button
                onClick={exportSafetyReport}
                className="ml-3 flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>

            {safetyAuditExpanded && (
              <div className="p-4 space-y-2">
                {/* Active Flags */}
                {activeSafetyFlags.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {activeSafetyFlags.map((flag) => (
                      <div
                        key={flag.id}
                        className="bg-white border border-gray-300 rounded-lg p-3 flex items-start gap-3"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getSeverityIcon(flag.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <span className={`text-sm font-bold ${getSeverityColor(flag.severity)}`}>
                                {flag.severity}
                              </span>
                              <span className="text-sm text-gray-600 ml-2">
                                {flag.id.split('-').slice(1).join('-')}
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-900 mb-1">{flag.message}</div>
                          <div className="text-xs text-gray-600 mb-2">{flag.recommendation}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-red-600 font-medium">
                              -{flag.pointsDeduction} point{flag.pointsDeduction !== 1 ? 's' : ''}
                            </span>
                            <button
                              onClick={() => dismissFlag(flag.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            >
                              <X className="w-3 h-3" />
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dismissed Flags */}
                {dismissedSafetyFlags.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-orange-200">
                    <div className="text-xs font-semibold text-gray-600 mb-2">Dismissed Flags</div>
                    {dismissedSafetyFlags.map((flag) => (
                      <div
                        key={flag.id}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-3 opacity-60"
                      >
                        <div className="flex-shrink-0 mt-0.5 opacity-50">
                          {getSeverityIcon(flag.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <span className="text-sm font-bold text-gray-500 line-through">
                                {flag.severity}
                              </span>
                              <span className="text-sm text-gray-500 ml-2 line-through">
                                {flag.id.split('-').slice(1).join('-')}
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 line-through mb-1">{flag.message}</div>
                          <div className="text-xs text-gray-500 italic mb-2">Dismissed by user</div>
                          <button
                            onClick={() => undismissFlag(flag.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs text-orange-700 italic pt-3 border-t border-orange-200">
                  You know your process best. Dismissed flags do not affect your score.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
