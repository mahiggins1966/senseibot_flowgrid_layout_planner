/*
  # Update doors table with width and type

  1. Changes
    - Remove the 'size' column from doors table
    - Add 'width' column (integer) to represent door width in grid squares
    - Add 'type' column to categorize door types:
      - 'hangar' (Hangar/Vehicle Door) - blue
      - 'loading-dock' (Loading Dock) - orange
      - 'personnel' (Personnel Door) - gray
      - 'emergency' (Emergency Exit) - red

  2. Important Notes
    - Width is measured in grid squares along the boundary edge
    - Personnel doors typically 1 square wide
    - Loading docks typically 2-3 squares wide
    - Hangar doors can be 10-15+ squares wide
    - Door type determines color coding on the grid
*/

DO $$
BEGIN
  -- Drop the old size column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doors' AND column_name = 'size'
  ) THEN
    ALTER TABLE doors DROP COLUMN size;
  END IF;

  -- Add width column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doors' AND column_name = 'width'
  ) THEN
    ALTER TABLE doors ADD COLUMN width integer NOT NULL DEFAULT 1 CHECK (width > 0);
  END IF;

  -- Add type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doors' AND column_name = 'type'
  ) THEN
    ALTER TABLE doors ADD COLUMN type text NOT NULL DEFAULT 'personnel' 
      CHECK (type IN ('hangar', 'loading-dock', 'personnel', 'emergency'));
  END IF;
END $$;