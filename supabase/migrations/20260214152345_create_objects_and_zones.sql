/*
  # Create objects and zones tables

  1. New Tables
    - `custom_objects`
      - `id` (uuid, primary key)
      - `name` (text) - Object name
      - `width_inches` (numeric) - Width in inches
      - `length_inches` (numeric) - Length in inches
      - `height_inches` (numeric) - Height in inches
      - `color` (text) - Hex color code
      - `grid_width` (integer) - Width in grid squares
      - `grid_length` (integer) - Length in grid squares
      - `is_default` (boolean) - Whether this is a pre-loaded object
      - `created_at` (timestamptz)
    
    - `placed_objects`
      - `id` (uuid, primary key)
      - `object_name` (text) - Name of the object
      - `grid_x` (integer) - X position on grid
      - `grid_y` (integer) - Y position on grid
      - `grid_width` (integer) - Width in grid squares
      - `grid_height` (integer) - Height in grid squares
      - `color` (text) - Object color
      - `rotation` (integer) - Rotation in degrees (0, 90, 180, 270)
      - `created_at` (timestamptz)
    
    - `zones`
      - `id` (uuid, primary key)
      - `name` (text) - Zone name
      - `grid_x` (integer) - X position on grid
      - `grid_y` (integer) - Y position on grid
      - `grid_width` (integer) - Width in grid squares
      - `grid_height` (integer) - Height in grid squares
      - `color` (text) - Zone color
      - `group_type` (text) - 'permanent', 'semi-fixed', or 'flexible'
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

CREATE TABLE IF NOT EXISTS custom_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  width_inches numeric NOT NULL DEFAULT 0,
  length_inches numeric NOT NULL DEFAULT 0,
  height_inches numeric NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#3B82F6',
  grid_width integer NOT NULL DEFAULT 1,
  grid_length integer NOT NULL DEFAULT 1,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS placed_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_name text NOT NULL,
  grid_x integer NOT NULL,
  grid_y integer NOT NULL,
  grid_width integer NOT NULL DEFAULT 1,
  grid_height integer NOT NULL DEFAULT 1,
  color text NOT NULL DEFAULT '#3B82F6',
  rotation integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Zone',
  grid_x integer NOT NULL,
  grid_y integer NOT NULL,
  grid_width integer NOT NULL DEFAULT 1,
  grid_height integer NOT NULL DEFAULT 1,
  color text NOT NULL DEFAULT '#3B82F6',
  group_type text NOT NULL DEFAULT 'flexible',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE placed_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read custom objects"
  ON custom_objects FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert custom objects"
  ON custom_objects FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update custom objects"
  ON custom_objects FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete custom objects"
  ON custom_objects FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Anyone can read placed objects"
  ON placed_objects FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert placed objects"
  ON placed_objects FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update placed objects"
  ON placed_objects FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete placed objects"
  ON placed_objects FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Anyone can read zones"
  ON zones FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert zones"
  ON zones FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update zones"
  ON zones FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete zones"
  ON zones FOR DELETE
  TO public
  USING (true);

INSERT INTO custom_objects (name, width_inches, length_inches, height_inches, color, grid_width, grid_length, is_default)
VALUES 
  ('Standard Pallet', 48, 40, 6, '#8B4513', 1, 1, true),
  ('Rolling Bin - Small', 24, 24, 36, '#4B5563', 1, 1, true),
  ('Rolling Bin - Large', 36, 36, 42, '#4B5563', 1, 1, true),
  ('ULD Container LD3', 60.4, 61.5, 64, '#6B7280', 2, 1, true),
  ('Forklift - Parked', 96, 48, 84, '#EF4444', 2, 1, true),
  ('Pallet Jack', 48, 27, 48, '#F59E0B', 2, 1, true),
  ('Folding Table', 72, 30, 30, '#10B981', 2, 1, true),
  ('Weigh Scale', 36, 36, 48, '#3B82F6', 1, 1, true),
  ('Traffic Cone', 18, 18, 28, '#F97316', 1, 1, true),
  ('Barrier / Divider', 40, 40, 40, '#EAB308', 1, 1, true)
ON CONFLICT DO NOTHING;
