import { useState, useMemo } from 'react';
import { Filter, ArrowUpDown, Sparkles } from 'lucide-react';
import { useGridStore } from '../store/gridStore';
import { RelationshipRating as Rating, CLOSE_REASONS, KEEP_APART_REASONS } from '../types';

type RatingFilter = 'all' | 'must-be-close' | 'prefer-close' | 'keep-apart' | 'does-not-matter' | 'not-rated';
type SortOption = 'default' | 'by-rating' | 'unrated-first';

export function RelationshipRating() {
  const { activities, activityRelationships, updateRelationship } = useGridStore();

  const [selectedActivity, setSelectedActivity] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');

  const getActivityPairs = () => {
    const pairs: Array<{
      a: typeof activities[0];
      b: typeof activities[0];
      aIndex: number;
      bIndex: number;
      isSequential: boolean;
    }> = [];

    for (let i = 0; i < activities.length; i++) {
      for (let j = i + 1; j < activities.length; j++) {
        const activityA = activities[i];
        const activityB = activities[j];

        if (activityA.type === 'staging-lane' && activityB.type === 'staging-lane') {
          continue;
        }

        const isSequential = j === i + 1;
        pairs.push({ a: activityA, b: activityB, aIndex: i, bIndex: j, isSequential });
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

  const acceptSuggestion = (aId: string, bId: string) => {
    handleRatingChange(aId, bId, 'must-be-close');
  };

  const getRatingBadgeColor = (rating: Rating) => {
    switch (rating) {
      case 'must-be-close':
        return 'bg-green-600 text-white';
      case 'prefer-close':
        return 'bg-green-200 text-green-900';
      case 'keep-apart':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  const getRatingLabel = (rating: Rating) => {
    switch (rating) {
      case 'must-be-close':
        return 'Must be close';
      case 'prefer-close':
        return 'Prefer close';
      case 'keep-apart':
        return 'Keep apart';
      default:
        return 'Does not matter';
    }
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-medium mb-2">Rate which areas need to be close</p>
        <p>
          Some areas need to be near each other — because material flows between them, or they
          share equipment, or one supervises the other. Other areas should be kept apart — because
          of noise, safety, or traffic conflicts. Rate each pair.
        </p>
      </div>

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

          <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
                  <Filter className="w-4 h-4" />
                  Filter by Activity
                </label>
                <select
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Show pairs for: All Activities</option>
                  {activities.map(activity => (
                    <option key={activity.id} value={activity.id}>
                      {activity.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
                  <ArrowUpDown className="w-4 h-4" />
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
              <label className="text-xs font-medium text-gray-700 mb-2 block">
                Filter by Rating
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRatingFilter('all')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    ratingFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({getRatingFilterCount('all')})
                </button>
                <button
                  onClick={() => setRatingFilter('must-be-close')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    ratingFilter === 'must-be-close'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                  }`}
                >
                  Must be close ({getRatingFilterCount('must-be-close')})
                </button>
                <button
                  onClick={() => setRatingFilter('prefer-close')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    ratingFilter === 'prefer-close'
                      ? 'bg-green-200 text-green-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                  }`}
                >
                  Prefer close ({getRatingFilterCount('prefer-close')})
                </button>
                <button
                  onClick={() => setRatingFilter('keep-apart')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    ratingFilter === 'keep-apart'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                  }`}
                >
                  Keep apart ({getRatingFilterCount('keep-apart')})
                </button>
                <button
                  onClick={() => setRatingFilter('does-not-matter')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    ratingFilter === 'does-not-matter'
                      ? 'bg-gray-300 text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Does not matter ({getRatingFilterCount('does-not-matter')})
                </button>
                <button
                  onClick={() => setRatingFilter('not-rated')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    ratingFilter === 'not-rated'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-yellow-100'
                  }`}
                >
                  Not yet rated ({getRatingFilterCount('not-rated')})
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="space-y-3">
        {filteredAndSortedPairs.map((pair) => {
          const { a, b, isSequential } = pair;
          const relationship = getRelationship(a.id, b.id);
          const rating = relationship?.rating || 'does-not-matter';
          const reason = relationship?.reason || '';
          const isRated = relationship && relationship.rating !== 'does-not-matter';
          const showSuggestion = isSequential && !isRated;

          return (
            <div key={`${a.id}-${b.id}`} className="bg-white border border-gray-300 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {a.name} ↔ {b.name}
                  </div>
                  {showSuggestion && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
                        <Sparkles className="w-3 h-3" />
                        <span>Suggested: Must be close — based on your process order</span>
                      </div>
                      <button
                        onClick={() => acceptSuggestion(a.id, b.id)}
                        className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 transition-colors"
                      >
                        Accept
                      </button>
                    </div>
                  )}
                </div>
                <div className={`px-3 py-1 rounded text-xs font-semibold ${getRatingBadgeColor(rating)}`}>
                  {getRatingLabel(rating)}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <button
                  onClick={() => handleRatingChange(a.id, b.id, 'must-be-close')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    rating === 'must-be-close'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                  }`}
                >
                  Must be close
                </button>

                <button
                  onClick={() => handleRatingChange(a.id, b.id, 'prefer-close')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    rating === 'prefer-close'
                      ? 'bg-green-200 text-green-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                  }`}
                >
                  Prefer close
                </button>

                <button
                  onClick={() => handleRatingChange(a.id, b.id, 'does-not-matter')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    rating === 'does-not-matter'
                      ? 'bg-gray-300 text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  No preference
                </button>

                <button
                  onClick={() => handleRatingChange(a.id, b.id, 'keep-apart')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    rating === 'keep-apart'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                  }`}
                >
                  Keep apart
                </button>
              </div>

              {rating !== 'does-not-matter' && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Why? (optional)
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => handleReasonChange(a.id, b.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a reason</option>
                    {(rating === 'must-be-close' || rating === 'prefer-close') &&
                      CLOSE_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    {rating === 'keep-apart' &&
                      KEEP_APART_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
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
          <p className="mt-1">
            Try adjusting your activity or rating filters to see more pairs.
          </p>
        </div>
      )}

      {allPairs.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
          <p className="font-medium">No activity pairs to rate</p>
          <p className="mt-1">
            Add at least 2 activities in Step 2C to rate relationships between them.
          </p>
        </div>
      )}
    </div>
  );
}
