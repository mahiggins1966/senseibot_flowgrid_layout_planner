/*
  # Add Zone Sizing Assumption Settings

  1. Changes
    - Add `typical_flow_unit` field to store the selected flow unit type (e.g., 'pallet', 'box', 'tote', 'custom')
    - Add `unit_footprint_sqft` field to store the square footage per unit
    - Add `stacking_height` field to store how many units can be stacked vertically
    - Add `access_factor` field to store the aisle/access multiplier

  2. Notes
    - These settings help the tool recommend minimum zone sizes during Step 2F
    - All fields are optional and have sensible default values
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'typical_flow_unit'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN typical_flow_unit text DEFAULT 'box';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'unit_footprint_sqft'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN unit_footprint_sqft numeric DEFAULT 4;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'stacking_height'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN stacking_height integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'access_factor'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN access_factor numeric DEFAULT 1.3;
  END IF;
END $$;