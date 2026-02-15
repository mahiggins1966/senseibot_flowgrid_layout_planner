/*
  # Create settings table for app configuration

  1. New Table
    - `app_settings`
      - `id` (uuid, primary key) - Single row ID
      - `facility_width` (numeric) - Width of facility in feet
      - `facility_height` (numeric) - Height of facility in feet
      - `square_size` (numeric) - Size of each grid square in feet
      - `measurement_system` (text) - Either 'US' or 'Metric'
      - `step1_completed` (boolean) - Step 1 completion status
      - `step2_completed` (boolean) - Step 2 completion status
      - `step3_completed` (boolean) - Step 3 completion status
      - `step4_completed` (boolean) - Step 4 completion status
      - `updated_at` (timestamptz) - Last update timestamp
      - `created_at` (timestamptz) - Creation timestamp
  
  2. Security
    - Enable RLS on `app_settings` table
    - Add policy for anyone to read settings (no auth required for this demo app)
    - Add policy for anyone to update settings (no auth required for this demo app)
  
  3. Initial Data
    - Insert default settings row that matches current app defaults
*/

-- Create the app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_width numeric NOT NULL DEFAULT 155,
  facility_height numeric NOT NULL DEFAULT 155,
  square_size numeric NOT NULL DEFAULT 5,
  measurement_system text NOT NULL DEFAULT 'US',
  step1_completed boolean NOT NULL DEFAULT false,
  step2_completed boolean NOT NULL DEFAULT false,
  step3_completed boolean NOT NULL DEFAULT false,
  step4_completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add check constraint for measurement_system
ALTER TABLE app_settings 
ADD CONSTRAINT measurement_system_check 
CHECK (measurement_system IN ('US', 'Metric'));

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (demo app)
CREATE POLICY "Anyone can read settings"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update settings"
  ON app_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can insert settings"
  ON app_settings FOR INSERT
  WITH CHECK (true);

-- Insert default settings if none exist
INSERT INTO app_settings (id, facility_width, facility_height, square_size, measurement_system)
SELECT 
  gen_random_uuid(),
  155,
  155,
  5,
  'US'
WHERE NOT EXISTS (SELECT 1 FROM app_settings);
