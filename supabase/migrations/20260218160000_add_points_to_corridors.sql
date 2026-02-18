/*
  # Add points column to corridors table

  Adds a JSONB `points` column to store multi-point waypoint arrays
  for corridors with bends. Format: [{x: col, y: row}, ...]
  
  Existing corridors get their points auto-populated from start/end coordinates.
*/

-- Add points column
ALTER TABLE corridors ADD COLUMN IF NOT EXISTS points jsonb;

-- Backfill existing corridors with points derived from start/end
UPDATE corridors
SET points = jsonb_build_array(
  jsonb_build_object('x', start_grid_x, 'y', start_grid_y),
  jsonb_build_object('x', end_grid_x, 'y', end_grid_y)
)
WHERE points IS NULL;
