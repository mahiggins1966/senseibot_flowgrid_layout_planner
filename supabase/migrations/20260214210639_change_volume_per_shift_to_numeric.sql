/*
  # Change volume_per_shift to numeric type

  1. Changes
    - Alter `volume_timing.volume_per_shift` column from integer to numeric
    - This allows decimal values for volume measurements (e.g., 1.5 lbs, 2.75 pallets)

  2. Notes
    - Secondary volume was already numeric, now primary volume matches
    - Existing integer data will be automatically converted to numeric
    - No data loss occurs during this conversion
*/

-- Change volume_per_shift from integer to numeric
ALTER TABLE volume_timing 
ALTER COLUMN volume_per_shift TYPE numeric;
