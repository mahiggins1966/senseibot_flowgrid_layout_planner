/*
  # Create doors table

  1. New Tables
    - `doors`
      - `id` (uuid, primary key) - Unique identifier for the door
      - `name` (text) - Human-readable door name (e.g., "Main Hangar Door", "Loading Dock 1")
      - `grid_x` (integer) - Column position on the grid
      - `grid_y` (integer) - Row position on the grid
      - `size` (text) - Door size: 'large' (3 squares wide for vehicles/equipment) or 'standard' (1 square for people)
      - `edge` (text) - Which boundary edge: 'top', 'bottom', 'left', or 'right'
      - `created_at` (timestamptz) - Timestamp of creation
  
  2. Security
    - Enable RLS on `doors` table
    - Add policy for public read access (doors are part of facility layout)
    - Add policy for public write access (users can manage doors)

  3. Important Notes
    - Doors represent entry/exit points on the facility boundary
    - Large doors (3 squares) are for vehicles and equipment
    - Standard doors (1 square) are for personnel only
    - Door positions are used by scoring engine to evaluate material staging locations
*/

CREATE TABLE IF NOT EXISTS doors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  grid_x integer NOT NULL,
  grid_y integer NOT NULL,
  size text NOT NULL DEFAULT 'standard' CHECK (size IN ('large', 'standard')),
  edge text NOT NULL CHECK (edge IN ('top', 'bottom', 'left', 'right')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE doors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read doors"
  ON doors
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert doors"
  ON doors
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update doors"
  ON doors
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete doors"
  ON doors
  FOR DELETE
  TO anon, authenticated
  USING (true);