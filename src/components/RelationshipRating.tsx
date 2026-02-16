import { useState, useMemo } from 'react';
import { Filter, ArrowUpDown, Sparkles, Zap, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useGridStore } from '../store/gridStore';
import { RelationshipRating as Rating, CLOSE_REASONS, KEEP_APART_REASONS } from '../types';

type RatingFilter = 'all' | 'must-be-close' | 'prefer-close' | 'keep-apart' | 'does-not-matter' | 'not-rated';
type SortOption = 'default' | 'by-rating' | 'unrated-first';

export function RelationshipRating() {
  const { activities, activityRelationships, updateRelationship } = useGridStore();

  const [selectedActivity, setSelectedActivity] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [showGuide, setShowGuide] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Check if we have sequence data to offer defaults
  const sequencedActivities = activities.filter(a => a.sequence_order != null);
  const hasSequenceData = sequencedActivities.length >= 2;

  const getActivityPairs = () => {
    const pairs: Array<{
      a: typeof activities[0];
      b: typeof activities[0];
      aIndex: number;
      bIndex: number;
      sequenceDistance: number | null;
      suggestedRating: Rating | null;
    }> = [];

    for (let i = 0; i < activities.length; i++) {
      for (let j = i + 1; j < activities.length; j++) {
        const activityA = activities[i];
        const activityB = activities[j];

        if (activityA.type === 'staging-lane' && activityB.type === 'staging-lane') {
          continue;
        }

        let sequenceDistance: number | null = null;
        let suggestedRating: Rating | null = null;

        const seqA = activityA.sequence_order;
        const seqB = activityB.sequence_order;

        if (seqA != null && seqB != null) {
          sequenceDistance = Math.abs(seqA - seqB);

          if (sequenceDistance === 0) {
            suggestedRating = 'does-not-matter';
          } else if (sequenceDistance === 1) {
            suggestedRating = 'must-be-close';
          } else if (sequenceDistance === 2) {
            suggestedRating = 'prefer-close';
          } else {
            suggestedRating = 'does-not-matter';
          }
        }

        pairs.push({ a: activityA, b: activityB, aIndex: i, bIndex: j, sequenceDistance, suggestedRating });
      }
    }

    return pairs;
  };

  const allPairs = getActivityPairs();

  const getRelationship = (aId: string, bId: string) => {
    return activityRelationships.find(
      (rel) =>
        (rel.activity_a_id === aId && rel.activity_b_id === bId) ||
        (rel.activity_a_id === bId && rel.activity_b_id === aId)
    );
  };

  const filteredAndSortedPairs = useMemo(() => {
    let filtered = allPairs;

    if (selectedActivity !== 'all') {
      filtered = filtered.filter(
        pair => pair.a.id === selectedActivity || pair.b.id === selectedActivity
      );
    }

    if (ratingFilter !== 'all') {
      filtered = filtered.filter(pair => {
        const rel = getRelationship(pair.a.id, pair.b.id);
        if (ratingFilter === 'not-rated') {
          return !rel || rel.rating === 'does-not-matter';
        }
        return rel?.rating === ratingFilter;
      });
    }

    const sorted = [...filtered];

    if (sortOption === 'by-rating') {
      const ratingOrder = { 'must-be-close': 0, 'prefer-close': 1, 'keep-apart': 2, 'does-not-matter': 3 };
      sorted.sort((pairA, pairB) => {
        const relA = getRelationship(pairA.a.id, pairA.b.id);
        const relB = getRelationship(pairB.a.id, pairB.b.id);
        const ratingA = relA?.rating || 'does-not-matter';
        const ratingB = relB?.rating || 'does-not-matter';
        return ratingOrder[ratingA] - ratingOrder[ratingB];
      });
    } else if (sortOption === 'unrated-first') {
      sorted.sort((pairA, pairB) => {
        const relA = getRelationship(pairA.a.id, pairA.b.id);
        const relB = getRelationship(pairB.a.id, pairB.b.id);
        const isRatedA = relA && relA.rating !== 'does-not-matter';
        const isRatedB = relB && relB.rating !== 'does-not-matter';
        if (isRatedA === isRatedB) return 0;
        return isRatedA ? 1 : -1;
      });
    }

    return sorted;
  }, [allPairs, selectedActivity, ratingFilter, sortOption, activityRelationships]);

  const ratedCount = allPairs.filter(pair => {
    const rel = getRelationship(pair.a.id, pair.b.id);
    return rel && rel.rating !== 'does-not-matter';
  }).length;

  const progressPercent = allPairs.length > 0 ? (ratedCount / allPairs.length) * 100 : 0;

  const handleRatingChange = (aId: string, bId: string, rating: Rating) => {
    const existing = getRelationship(aId, bId);

    let newReason = existing?.reason;
    if (rating === 'does-not-matter') {
      newReason = undefined;
    } else if (existing) {
      const oldIsClose = existing.rating === 'must-be-close' || existing.rating === 'prefer-close';
      const newIsClose = rating === 'must-be-close' || rating === 'prefer-close';
      if (oldIsClose !== newIsClose) {
        newReason = undefined;
      }
    }

    updateRelationship(aId, bId, rating, newReason);
  };

  const handleReasonChange = (aId: string, bId: string, reason: string) => {
    const existing = getRelationship(aId, bId);
    if (existing) {
      updateRelationship(aId, bId, existing.rating, reason);
    }
  };

  const applySequenceDefaults = () => {
    let appliedCount = 0;

    allPairs.forEach(pair => {
      if (!pair.suggestedRating) return;
      const existing = getRelationship(pair.a.id, pair.b.id);
      if (existing && existing.rating !== 'does-not-matter') return;

      if (pair.suggestedRating !== 'does-not-matter') {
        const reason = pair.sequenceDistance === 1 ? 'sequential-process' : 'heavy-material-flow';
        updateRelationship(pair.a.id, pair.b.id, pair.suggestedRating, reason);
        appliedCount++;
      }
    });

    return appliedCount;
  };

  const defaultableCount = allPairs.filter(pair => {
    if (!pair.suggestedRating || pair.suggestedRating === 'does-not-matter') return false;
    const existing = getRelationship(pair.a.id, pair.b.id);
    return !existing || existing.rating === 'does-not-matter';
  }).length;

  const getRatingBadgeColor = (rating: Rating) => {
    switch (rating) {
      case 'must-be-close': return 'bg-green-600 text-white';
      case 'prefer-close': return 'bg-green-200 text-green-900';
      case 'keep-apart': return 'bg-red-500 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getRatingLabel = (rating: Rating) => {
    switch (rating) {
      case 'must-be-close': return 'Must be close';
      case 'prefer-close': return 'Prefer close';
      case 'keep-apart': return 'Keep apart';
      default: return 'No preference';
    }
  };

  const getSequenceLabel = (pair: typeof allPairs[0]) => {
    if (pair.sequenceDistance === null) return null;
    if (pair.sequenceDistance === 0) return 'Same step (parallel)';
    if (pair.sequenceDistance === 1) return 'Adjacent steps';
    return `${pair.sequenceDistance} steps apart`;
  };

  const getRatingFilterCount = (filter: RatingFilter) => {
    if (filter === 'all') return allPairs.length;
    if (filter === 'not-rated') {
      return allPairs.filter(pair => {
        const rel = getRelationship(pair.a.id, pair.b.id);
        return !rel || rel.rating === 'does-not-matter';
      }).length;
    }
    return activityRelationships.filter((rel) => rel.rating === filter).length;
  };

  return (
    <div className="space-y-4">

      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 1: How It Works — collapsible rating guide       */}
      {/* ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">How It Works — Rating Definitions</span>
          </div>
          {showGuide ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>

        {showGuide && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-3">
            <p className="text-sm text-gray-600">
              For every pair of activities, you'll choose how close they need to be on the floor.
              Think about how material, people, and equipment move between them.
            </p>

            {/* Rating definitions */}
            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <span className="shrink-0 mt-0.5 px-2.5 py-1 rounded text-xs font-bold bg-green-600 text-white">Must be close</span>
                <div className="text-sm text-gray-700">
                  <p className="font-medium text-gray-900">Place directly next to each other</p>
                  <p className="text-gray-500 mt-0.5">These areas must be adjacent or within 1–2 squares. Material flows directly and continuously between them, or they share the same workers.</p>
                  <p className="text-gray-400 mt-0.5 italic">Example: Receiving → Breakdown & Sort — every incoming shipment moves straight from one to the other.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="shrink-0 mt-0.5 px-2.5 py-1 rounded text-xs font-bold bg-green-200 text-green-900">Prefer close</span>
                <div className="text-sm text-gray-700">
                  <p className="font-medium text-gray-900">Nearby is better, but some distance is OK</p>
                  <p className="text-gray-500 mt-0.5">Some material or people move between these areas, but it doesn't happen continuously. A few extra squares of walking distance won't cause problems.</p>
                  <p className="text-gray-400 mt-0.5 italic">Example: Weigh Station → Wrap Station — items go through weighing then wrapping, but there may be a short queue between them.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="shrink-0 mt-0.5 px-2.5 py-1 rounded text-xs font-bold bg-gray-200 text-gray-700">No preference</span>
                <div className="text-sm text-gray-700">
                  <p className="font-medium text-gray-900">Location doesn't matter</p>
                  <p className="text-gray-500 mt-0.5">These two areas don't interact. No material, people, or equipment moves between them during normal operations. Place them wherever makes the best use of space.</p>
                  <p className="text-gray-400 mt-0.5 italic">Example: Receiving → Break Room — no operational connection.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="shrink-0 mt-0.5 px-2.5 py-1 rounded text-xs font-bold bg-red-500 text-white">Keep apart</span>
                <div className="text-sm text-gray-700">
                  <p className="font-medium text-gray-900">Deliberately separate these areas</p>
                  <p className="text-gray-500 mt-0.5">Putting these areas next to each other would create safety hazards, noise problems, traffic conflicts, or contamination risks. Keep at least a corridor or buffer zone between them.</p>
                  <p className="text-gray-400 mt-0.5 italic">Example: Forklift charging area → Pedestrian break room — safety hazard if pedestrians cross forklift traffic.</p>
                </div>
              </div>
            </div>

            {/* How to approach it */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900 mb-2">Suggested approach:</p>
              <div className="space-y-1.5">
                <p>
                  <span className="font-semibold text-purple-700">Step 1:</span> If you assigned process sequence numbers in 2C, click "Apply Defaults" below. This auto-fills most pairs based on your process flow.
                </p>
                <p>
                  <span className="font-semibold text-green-700">Step 2:</span> Scan through the "Must be close" pairs — do they look right? Adjust any that don't match your operations.
                </p>
                <p>
                  <span className="font-semibold text-red-700">Step 3:</span> Look for pairs that should be "Keep apart" — safety, noise, or traffic conflicts the sequence doesn't know about.
                </p>
                <p>
                  <span className="font-semibold text-gray-500">Step 4:</span> Everything else can stay as "No preference" — that's perfectly fine for most pairs.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Tip: You don't have to rate every single pair. Focus on the ones that matter — the "Must be close" and "Keep apart" pairs have the biggest impact on your layout. "No preference" is the safe default.
            </p>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 2: Quick Start — Auto-fill from sequence         */}
      {/* ───────────────────────────────────────────────────────── */}
      {hasSequenceData && defaultableCount > 0 && (
        <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg shrink-0">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-purple-900 mb-1">
                Start Here — Auto-fill from Your Process Sequence
              </p>
              <p className="text-sm text-purple-700 mb-1">
                You assigned sequence numbers in Step 2C. Based on that flow order, the tool can
                auto-fill {defaultableCount} pair{defaultableCount !== 1 ? 's' : ''}:
              </p>
              <div className="text-sm text-purple-700 mb-3 space-y-0.5">
                <p>• Activities one step apart → <strong>Must be close</strong></p>
                <p>• Activities two steps apart → <strong>Prefer close</strong></p>
                <p>• Activities three or more steps apart → <strong>No preference</strong></p>
              </div>
              <p className="text-xs text-purple-600 mb-3">
                You can change any of them afterward — this just gives you a head start.
              </p>
              <button
                onClick={() => {
                  const count = applySequenceDefaults();
                  if (count > 0) {
                    setRatingFilter('all');
                    setShowGuide(false);
                  }
                }}
                className="px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
              >
                Apply Defaults ({defaultableCount} pair{defaultableCount !== 1 ? 's' : ''})
              </button>
            </div>
          </div>
        </div>
      )}

      {hasSequenceData && defaultableCount === 0 && ratedCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Defaults applied. Review the pairs below and adjust anything that doesn't match your operations.</span>
        </div>
      )}

      {!hasSequenceData && allPairs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <p className="font-medium mb-1">No process sequence found</p>
          <p>
            You can still rate each pair manually below. Or go back to Step 2C and add sequence
            numbers to your activities — this lets the tool auto-fill most ratings for you.
          </p>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 3: Progress + Filters                            */}
      {/* ───────────────────────────────────────────────────────── */}
      {allPairs.length > 0 && (
        <>
          <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900">
                Rated: {ratedCount} of {allPairs.length} pairs
                <span className="text-gray-500 ml-2">| {allPairs.length - ratedCount} remaining</span>
              </div>
              <div className="text-xs text-gray-500">{Math.round(progressPercent)}% complete</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Collapsible filters — hidden by default to reduce overwhelm */}
          <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter & Sort</span>
                {(selectedActivity !== 'all' || ratingFilter !== 'all' || sortOption !== 'default') && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">Active</span>
                )}
              </div>
              {showFilters ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>

            {showFilters && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
                      Filter by Activity
                    </label>
                    <select
                      value={selectedActivity}
                      onChange={(e) => setSelectedActivity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Activities</option>
                      {activities.map(activity => (
                        <option key={activity.id} value={activity.id}>
                          {activity.name}{activity.sequence_order != null ? ` (Seq ${activity.sequence_order})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
                      Sort By
                    </label>
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as SortOption)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="default">Default order</option>
                      <option value="by-rating">By rating</option>
                      <option value="unrated-first">Unrated first</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 mb-2 block">Filter by Rating</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setRatingFilter('all')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${ratingFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      All ({getRatingFilterCount('all')})
                    </button>
                    <button onClick={() => setRatingFilter('must-be-close')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${ratingFilter === 'must-be-close' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-green-100'}`}>
                      Must be close ({getRatingFilterCount('must-be-close')})
                    </button>
                    <button onClick={() => setRatingFilter('prefer-close')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${ratingFilter === 'prefer-close' ? 'bg-green-200 text-green-900' : 'bg-gray-100 text-gray-700 hover:bg-green-100'}`}>
                      Prefer close ({getRatingFilterCount('prefer-close')})
                    </button>
                    <button onClick={() => setRatingFilter('keep-apart')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${ratingFilter === 'keep-apart' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-red-100'}`}>
                      Keep apart ({getRatingFilterCount('keep-apart')})
                    </button>
                    <button onClick={() => setRatingFilter('does-not-matter')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${ratingFilter === 'does-not-matter' ? 'bg-gray-300 text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      No preference ({getRatingFilterCount('does-not-matter')})
                    </button>
                    <button onClick={() => setRatingFilter('not-rated')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${ratingFilter === 'not-rated' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-yellow-100'}`}>
                      Not yet rated ({getRatingFilterCount('not-rated')})
                    </button>
                  </div>
                </div>

                {(selectedActivity !== 'all' || ratingFilter !== 'all' || sortOption !== 'default') && (
                  <button
                    onClick={() => { setSelectedActivity('all'); setRatingFilter('all'); setSortOption('default'); }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 4: Pair Cards                                    */}
      {/* ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filteredAndSortedPairs.map((pair) => {
          const { a, b } = pair;
          const relationship = getRelationship(a.id, b.id);
          const rating = relationship?.rating || 'does-not-matter';
          const reason = relationship?.reason || '';
          const seqLabel = getSequenceLabel(pair);

          return (
            <div key={`${a.id}-${b.id}`} className="bg-white border border-gray-300 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                    <span>
                      {a.sequence_order != null && (
                        <span className="text-xs font-semibold text-gray-400 mr-1">({a.sequence_order})</span>
                      )}
                      {a.name}
                    </span>
                    <span className="text-gray-400">↔</span>
                    <span>
                      {b.sequence_order != null && (
                        <span className="text-xs font-semibold text-gray-400 mr-1">({b.sequence_order})</span>
                      )}
                      {b.name}
                    </span>
                  </div>
                  {seqLabel && (
                    <div className="mt-1 text-xs text-purple-600 font-medium">
                      {seqLabel}
                      {pair.suggestedRating && pair.suggestedRating !== 'does-not-matter' && rating === 'does-not-matter' && (
                        <span className="text-purple-500 ml-1">
                          — suggests "{getRatingLabel(pair.suggestedRating)}"
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className={`px-3 py-1 rounded text-xs font-semibold shrink-0 ${getRatingBadgeColor(rating)}`}>
                  {getRatingLabel(rating)}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <button
                  onClick={() => handleRatingChange(a.id, b.id, 'must-be-close')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    rating === 'must-be-close' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                  }`}
                >
                  Must be close
                </button>

                <button
                  onClick={() => handleRatingChange(a.id, b.id, 'prefer-close')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    rating === 'prefer-close' ? 'bg-green-200 text-green-900' : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                  }`}
                >
                  Prefer close
                </button>

                <button
                  onClick={() => handleRatingChange(a.id, b.id, 'does-not-matter')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    rating === 'does-not-matter' ? 'bg-gray-300 text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  No preference
                </button>

                <button
                  onClick={() => handleRatingChange(a.id, b.id, 'keep-apart')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    rating === 'keep-apart' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                  }`}
                >
                  Keep apart
                </button>
              </div>

              {rating !== 'does-not-matter' && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Why? (optional — helps document your reasoning)
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => handleReasonChange(a.id, b.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a reason</option>
                    {(rating === 'must-be-close' || rating === 'prefer-close') &&
                      CLOSE_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    {rating === 'keep-apart' &&
                      KEEP_APART_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredAndSortedPairs.length === 0 && allPairs.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
          <p className="font-medium">No pairs match your filters</p>
          <p className="mt-1">Try adjusting your filters above, or click "Clear all filters" to see everything.</p>
        </div>
      )}

      {allPairs.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
          <p className="font-medium">No activity pairs to rate</p>
          <p className="mt-1">Add at least 2 activities in Step 2C to rate relationships between them.</p>
        </div>
      )}
    </div>
  );
}
