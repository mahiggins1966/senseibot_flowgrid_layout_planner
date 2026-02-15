/*
  # Add Flow Unit Fields and Remove Estimated Space

  1. Changes to app_settings table
    - Add `primary_flow_unit` (text) - Primary unit for measuring throughput (lbs, kg, pallets, etc.)
    - Add `primary_flow_unit_custom` (text) - Custom unit name if user selects "custom"
    - Add `secondary_flow_unit` (text) - Optional secondary unit for measuring throughput
    - Add `secondary_flow_unit_custom` (text) - Custom secondary unit name if user selects "custom"

  2. Changes to activities table
    - Remove `estimated_space` column - users should not guess space needs during data collection

  3. Notes
    - Flow units allow users to define what they measure (pounds, pallets, orders, etc.)
    - All volume calculations will use these unit labels throughout the app
    - Space allocation will be calculated by the tool in Step 2F, not estimated by users
*/

-- Add flow unit columns to app_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'primary_flow_unit'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN primary_flow_unit text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'primary_flow_unit_custom'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN primary_flow_unit_custom text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'secondary_flow_unit'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN secondary_flow_unit text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'secondary_flow_unit_custom'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN secondary_flow_unit_custom text;
  END IF;
END $$;

-- Remove estimated_space column from activities table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'estimated_space'
  ) THEN
    ALTER TABLE activities DROP COLUMN estimated_space;
  END IF;
END $$;
