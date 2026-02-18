/*
  # Add points column to corridors table
  
  This migration enables multi-segment corridor paths by adding a points array.
  
  ## Changes
    - Adds `points` column to `corridors` table
      - Type: jsonb
      - Stores array of {x, y} coordinate objects
      - Enables complex corridor paths with multiple segments
    
    - Backfills existing corridors
      - Converts start/end coordinates to two-point arrays
      - Preserves existing corridor data during transition
  
  ## Migration Strategy
    - New column is nullable initially to allow backfilling
    - Existing corridors converted from line segments to point arrays
    - Future corridors can have 2+ points for complex paths
*/

-- Add points column
ALTER TABLE corridors ADD COLUMN IF NOT EXISTS points jsonb;

-- Backfill existing corridors
UPDATE corridors
SET points = jsonb_build_array(
  jsonb_build_object('x', start_grid_x, 'y', start_grid_y),
  jsonb_build_object('x', end_grid_x, 'y', end_grid_y)
)
WHERE points IS NULL;