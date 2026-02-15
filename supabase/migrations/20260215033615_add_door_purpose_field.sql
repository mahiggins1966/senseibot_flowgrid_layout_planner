/*
  # Add Door Purpose Field

  ## Summary
  Add a "purpose" field to the doors table to classify door usage for material flow analysis and scoring calculations.

  ## Changes
  1. New Column
    - `purpose` (text) with values:
      - 'inbound' — Material receiving/incoming
      - 'outbound' — Material shipping/outgoing
      - 'both' — Used for both inbound and outbound
      - 'personnel-only' — People only, not used for material flow
    - Default value: 'both' for existing doors
    - Not nullable

  ## Purpose
  This enables the scoring system to:
  - Calculate departure priority based on distance to outbound doors only
  - Calculate flow distance from inbound doors to outbound doors
  - Evaluate closeness compliance for receiving areas (inbound doors) and loading areas (outbound doors)
*/

-- Add purpose column to doors table
ALTER TABLE doors 
ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'both' 
CHECK (purpose IN ('inbound', 'outbound', 'both', 'personnel-only'));