import { useRef, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useGridStore } from '../store/gridStore';
import { supabase } from '../lib/supabase';
import { Activity, ActivityType } from '../types';

// Debounce delay for database writes (ms)
const DB_WRITE_DELAY = 500;

export function ActivityList() {
  const { activities, setActivities, deleteActivity } = useGridStore();

  // Track pending DB writes so we can debounce per-field-per-activity
  const pendingWrites = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleAddActivity = async () => {
    const newActivity = {
      name: 'New Activity',
      type: 'work-area' as ActivityType,
      sort_order: activities.length,
    };

    const { data, error } = await supabase
      .from('activities')
      .insert([newActivity])
      .select()
      .single();

    if (error) {
      console.error('Error adding activity:', error);
      return;
    }

    if (data) {
      setActivities([...activities, data]);
    }
  };

  const handleUpdateActivity = useCallback((id: string, field: keyof Activity, value: string | number) => {
    // 1. Update local state IMMEDIATELY — no waiting for network
    setActivities(
      useGridStore.getState().activities.map((activity) =>
        activity.id === id ? { ...activity, [field]: value } : activity
      )
    );

    // 2. Debounce the database write — only fires after user stops typing
    const key = `${id}-${field}`;
    const existing = pendingWrites.current.get(key);
    if (existing) clearTimeout(existing);

    pendingWrites.current.set(
      key,
      setTimeout(async () => {
        pendingWrites.current.delete(key);
        const { error } = await supabase
          .from('activities')
          .update({ [field]: value })
          .eq('id', id);

        if (error) {
          console.error('Error updating activity:', error);
        }
      }, DB_WRITE_DELAY)
    );
  }, [setActivities]);

  const handleDeleteActivity = async (id: string) => {
    // Cancel any pending writes for this activity
    pendingWrites.current.forEach((timer, key) => {
      if (key.startsWith(id)) {
        clearTimeout(timer);
        pendingWrites.current.delete(key);
      }
    });

    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting activity:', error);
      return;
    }

    deleteActivity(id);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-medium mb-2">List every activity that happens on your floor</p>
        <p>
          Receiving, sorting, staging, wrapping, weighing, packing, shipping, and anything else.
          Do not worry about where they go yet. Just list what happens.
        </p>
      </div>

      <div className="space-y-2">
        {activities.map((activity) => (
          <div key={activity.id} className="bg-white border border-gray-300 rounded-lg p-4">
            <div className="grid grid-cols-12 gap-3 items-start">
              <div className="col-span-5">
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Activity Name
                </label>
                <input
                  type="text"
                  value={activity.name}
                  onChange={(e) => handleUpdateActivity(activity.id, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="col-span-3">
                <label className="text-xs font-medium text-gray-700 block mb-1">Type</label>
                <select
                  value={activity.type}
                  onChange={(e) => handleUpdateActivity(activity.id, 'type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="work-area">Work Area</option>
                  <option value="staging-lane">Staging Lane</option>
                  <option value="corridor">Corridor / Path</option>
                  <option value="support-area">Support Area</option>
                </select>
              </div>

              {activity.type === 'staging-lane' && (
                <>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Destination Code
                    </label>
                    <input
                      type="text"
                      value={activity.destination_code || ''}
                      onChange={(e) =>
                        handleUpdateActivity(activity.id, 'destination_code', e.target.value)
                      }
                      placeholder="MKK"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="text-xs font-medium text-gray-700 block mb-1">Color</label>
                    <input
                      type="color"
                      value={activity.color || '#3B82F6'}
                      onChange={(e) => handleUpdateActivity(activity.id, 'color', e.target.value)}
                      className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Departure Time
                    </label>
                    <input
                      type="time"
                      value={activity.departure_time || ''}
                      onChange={(e) =>
                        handleUpdateActivity(activity.id, 'departure_time', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {activity.type !== 'staging-lane' && (
                <div className="col-span-3"></div>
              )}

              <div className="col-span-1 flex items-end justify-end h-full pb-2">
                <button
                  onClick={() => handleDeleteActivity(activity.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete activity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddActivity}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        <Plus className="w-5 h-5" />
        Add Activity
      </button>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
        <span className="font-semibold">Activities listed:</span> {activities.length}
      </div>
    </div>
  );
}
