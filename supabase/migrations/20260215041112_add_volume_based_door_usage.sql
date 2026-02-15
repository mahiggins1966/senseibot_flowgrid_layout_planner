/*
  # Replace Door Purpose with Volume-Based Usage System

  ## Summary
  Replace the simple purpose dropdown with a more precise volume-based door usage system that tracks material flow percentages through each door.

  ## Changes
  1. Remove Fields
    - Drop `purpose` column (replaced by more precise tracking)

  2. New Columns
    - `has_inbound_material` (boolean) — This door receives incoming cargo/material
    - `has_outbound_material` (boolean) — This door ships outgoing cargo/material
    - `has_vehicle_access` (boolean) — Trucks, forklifts, or aircraft use this door
    - `is_personnel_only` (boolean) — People walk through, no material flow
    - `inbound_percentage` (numeric) — What % of total inbound volume enters through this door
    - `outbound_percentage` (numeric) — What % of total outbound volume exits through this door

  3. Default Values
    - All boolean fields default to false
    - Percentage fields are nullable (null = not applicable)
    - Percentages are stored as numeric to allow decimals (e.g., 33.33)

  ## Purpose
  This enables the scoring system to:
  - Weight flow paths toward doors with highest inbound/outbound percentages
  - Prioritize departure staging near doors with highest outbound percentages
  - Evaluate closeness compliance for receiving areas (highest inbound %) and loading areas (highest outbound %)
  - Support scenarios where a single door handles 90%+ of both inbound and outbound
  - Support scenarios where material splits across multiple doors with different percentages

  ## Validation
  - Frontend enforces that all inbound percentages across all doors sum to 100%
  - Frontend enforces that all outbound percentages across all doors sum to 100%
  - Percentages are only required when the corresponding usage checkbox is checked
*/

-- Drop the old purpose column
ALTER TABLE doors 
DROP COLUMN IF EXISTS purpose;

-- Add new volume-based usage fields
ALTER TABLE doors 
ADD COLUMN IF NOT EXISTS has_inbound_material boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS has_outbound_material boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS has_vehicle_access boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_personnel_only boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS inbound_percentage numeric,
ADD COLUMN IF NOT EXISTS outbound_percentage numeric;

-- Add check constraints for percentage ranges (0-100)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'inbound_percentage_range'
  ) THEN
    ALTER TABLE doors
    ADD CONSTRAINT inbound_percentage_range 
    CHECK (inbound_percentage IS NULL OR (inbound_percentage >= 0 AND inbound_percentage <= 100));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'outbound_percentage_range'
  ) THEN
    ALTER TABLE doors
    ADD CONSTRAINT outbound_percentage_range 
    CHECK (outbound_percentage IS NULL OR (outbound_percentage >= 0 AND outbound_percentage <= 100));
  END IF;
END $$;