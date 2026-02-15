/*
  # Add Peak Volume Fields

  1. Changes
    - Add `peak_volume_per_shift` column to `volume_timing` table for peak primary volume
    - Add `peak_secondary_volume_per_shift` column to `volume_timing` table for peak secondary volume
    - Rename existing `volume_per_shift` to `typical_volume_per_shift` for clarity
    - Rename existing `secondary_volume_per_shift` to `typical_secondary_volume_per_shift` for clarity
  
  2. Notes
    - Peak volumes represent worst-case/busiest day scenarios
    - Typical volumes represent normal day operations
    - Peak factor is calculated as peak/typical to identify high variability
*/

-- Add new peak volume columns
ALTER TABLE volume_timing 
ADD COLUMN IF NOT EXISTS peak_volume_per_shift numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS peak_secondary_volume_per_shift numeric DEFAULT 0;

-- Rename existing columns for clarity (using a safe approach)
DO $$
BEGIN
  -- Check if old column name exists and new one doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'volume_timing' AND column_name = 'volume_per_shift'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'volume_timing' AND column_name = 'typical_volume_per_shift'
  ) THEN
    -- Copy data to peak volumes (default peak = typical)
    UPDATE volume_timing SET peak_volume_per_shift = volume_per_shift WHERE peak_volume_per_shift = 0;
    UPDATE volume_timing SET peak_secondary_volume_per_shift = secondary_volume_per_shift WHERE peak_secondary_volume_per_shift = 0;
    
    -- Rename columns
    ALTER TABLE volume_timing RENAME COLUMN volume_per_shift TO typical_volume_per_shift;
    ALTER TABLE volume_timing RENAME COLUMN secondary_volume_per_shift TO typical_secondary_volume_per_shift;
  END IF;
END $$;