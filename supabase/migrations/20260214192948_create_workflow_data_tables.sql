/*
  # Create workflow data collection tables

  1. New Tables
    - `activities`
      - `id` (uuid, primary key)
      - `name` (text) - Activity name (e.g., "Receiving Area")
      - `type` (text) - "work-area", "staging-lane", "corridor", or "support-area"
      - `destination_name` (text, nullable) - For staging lanes only
      - `destination_code` (text, nullable) - Short code for staging lanes (e.g., "MKK")
      - `color` (text, nullable) - Color for staging lanes
      - `departure_time` (time, nullable) - When material departs for staging lanes
      - `estimated_space` (integer, nullable) - Estimated grid squares needed
      - `sort_order` (integer) - Display order in the list
      - `created_at` (timestamptz)
    
    - `volume_timing`
      - `id` (uuid, primary key)
      - `activity_id` (uuid, foreign key) - Links to activities table
      - `volume_per_shift` (integer) - Items per shift
      - `percentage` (numeric) - Auto-calculated percentage of total
      - `created_at` (timestamptz)
    
    - `activity_relationships`
      - `id` (uuid, primary key)
      - `activity_a_id` (uuid, foreign key) - First activity in the pair
      - `activity_b_id` (uuid, foreign key) - Second activity in the pair
      - `rating` (text) - "must-be-close", "prefer-close", "does-not-matter", "keep-apart"
      - `reason` (text, nullable) - Reason for the rating
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for public access (demo app)
  
  3. Initial Data
    - Pre-populate common activities for the user
*/

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  destination_name text,
  destination_code text,
  color text,
  departure_time time,
  estimated_space integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add check constraint for activity type
ALTER TABLE activities 
ADD CONSTRAINT activity_type_check 
CHECK (type IN ('work-area', 'staging-lane', 'corridor', 'support-area'));

-- Add check constraint for rating
CREATE TABLE IF NOT EXISTS volume_timing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  volume_per_shift integer NOT NULL DEFAULT 0,
  percentage numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_a_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  activity_b_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  rating text NOT NULL DEFAULT 'does-not-matter',
  reason text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_relationship UNIQUE (activity_a_id, activity_b_id)
);

-- Add check constraint for rating
ALTER TABLE activity_relationships 
ADD CONSTRAINT rating_check 
CHECK (rating IN ('must-be-close', 'prefer-close', 'does-not-matter', 'keep-apart'));

-- Enable RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE volume_timing ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_relationships ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (demo app)
CREATE POLICY "Anyone can read activities"
  ON activities FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert activities"
  ON activities FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update activities"
  ON activities FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete activities"
  ON activities FOR DELETE
  USING (true);

CREATE POLICY "Anyone can read volume_timing"
  ON volume_timing FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert volume_timing"
  ON volume_timing FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update volume_timing"
  ON volume_timing FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete volume_timing"
  ON volume_timing FOR DELETE
  USING (true);

CREATE POLICY "Anyone can read activity_relationships"
  ON activity_relationships FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert activity_relationships"
  ON activity_relationships FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update activity_relationships"
  ON activity_relationships FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete activity_relationships"
  ON activity_relationships FOR DELETE
  USING (true);

-- Pre-populate common activities
INSERT INTO activities (name, type, sort_order) VALUES
  ('Receiving Area', 'work-area', 1),
  ('Sort Station', 'work-area', 2),
  ('Staging Lane 1', 'staging-lane', 3),
  ('Staging Lane 2', 'staging-lane', 4),
  ('Staging Lane 3', 'staging-lane', 5),
  ('Staging Lane 4', 'staging-lane', 6),
  ('Staging Lane 5', 'staging-lane', 7),
  ('Wrap / Weigh Station', 'work-area', 8),
  ('Equipment Parking', 'support-area', 9)
ON CONFLICT DO NOTHING;
