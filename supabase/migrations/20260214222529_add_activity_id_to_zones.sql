/*
  # Add activity_id to zones table

  1. Changes
    - Add `activity_id` column to `zones` table as optional foreign key reference to `activities` table
    - This allows zones to be linked to specific activities from Step 2C
    - When a zone is associated with an activity, it represents that activity's work area on the floor
    
  2. Notes
    - The activity_id is optional because zones can exist independently of activities
    - When activity_id is set, the zone represents that activity's placement in the layout
    - An activity can only have one zone (enforced at application level)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zones' AND column_name = 'activity_id'
  ) THEN
    ALTER TABLE zones ADD COLUMN activity_id uuid REFERENCES activities(id) ON DELETE SET NULL;
  END IF;
END $$;
