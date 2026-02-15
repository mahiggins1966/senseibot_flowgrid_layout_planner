/*
  # Create corridors table

  1. New Tables
    - `corridors`
      - `id` (uuid, primary key) - unique identifier
      - `name` (text) - corridor name (e.g., "Main Forklift Aisle")
      - `type` (text) - 'pedestrian' or 'forklift'
      - `start_grid_x` (integer) - starting column position
      - `start_grid_y` (integer) - starting row position
      - `end_grid_x` (integer) - ending column position
      - `end_grid_y` (integer) - ending row position
      - `width` (integer) - corridor width in grid squares (1 or 2)
      - `color` (text) - corridor color
      - `created_at` (timestamptz) - creation timestamp
  
  2. Security
    - Enable RLS on `corridors` table
    - Add policies for authenticated users to manage corridors

  3. Notes
    - Corridors are always straight lines (horizontal or vertical)
    - Width is 1 square (5 ft) for pedestrian, 2 squares (10 ft) for forklift
    - Corridors can overlap with zones but not permanent painted squares
*/

CREATE TABLE IF NOT EXISTS corridors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Corridor',
  type text NOT NULL CHECK (type IN ('pedestrian', 'forklift')),
  start_grid_x integer NOT NULL,
  start_grid_y integer NOT NULL,
  end_grid_x integer NOT NULL,
  end_grid_y integer NOT NULL,
  width integer NOT NULL DEFAULT 1,
  color text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE corridors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all corridors"
  ON corridors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert corridors"
  ON corridors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update corridors"
  ON corridors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete corridors"
  ON corridors FOR DELETE
  TO authenticated
  USING (true);