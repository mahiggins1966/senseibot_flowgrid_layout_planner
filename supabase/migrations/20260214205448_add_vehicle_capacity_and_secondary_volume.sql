/*
  # Add Vehicle Capacity and Secondary Volume Fields

  1. Changes to app_settings table
    - Add `largest_vehicle_name` (text) - Name of the largest vehicle/container to load
    - Add `largest_vehicle_capacity` (numeric) - Max payload capacity in primary flow units

  2. Changes to volume_timing table
    - Add `secondary_volume_per_shift` (numeric) - Optional secondary unit volume tracking

  3. Notes
    - Vehicle capacity is used to calculate full loads per shift for each destination
    - Secondary volume allows tracking a second unit type (e.g., primary = lbs, secondary = pouches)
    - One vehicle capacity applies to all destinations
*/

-- Add vehicle capacity columns to app_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'largest_vehicle_name'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN largest_vehicle_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'largest_vehicle_capacity'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN largest_vehicle_capacity numeric;
  END IF;
END $$;

-- Add secondary volume column to volume_timing table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'volume_timing' AND column_name = 'secondary_volume_per_shift'
  ) THEN
    ALTER TABLE volume_timing ADD COLUMN secondary_volume_per_shift numeric DEFAULT 0;
  END IF;
END $$;
