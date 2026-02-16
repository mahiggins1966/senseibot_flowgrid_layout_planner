/*
  # Add sequence_order column to activities table

  1. Changes
    - Add `sequence_order` column to `activities` table
      - Type: integer
      - Nullable: yes (allows null values)
      - Default: null (no default value)
      - No constraints
  
  2. Purpose
    - This column stores the process flow step number for each activity
    - Example values:
      - Receiving = 1
      - Breakdown & Sort = 2
      - Weigh = 3
      - Wrap = 4
      - Staging lanes = 5 (parallel activities share the same number)
      - Support areas (Break Room, Office, etc.) = null (not part of material flow)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'sequence_order'
  ) THEN
    ALTER TABLE activities ADD COLUMN sequence_order integer;
  END IF;
END $$;