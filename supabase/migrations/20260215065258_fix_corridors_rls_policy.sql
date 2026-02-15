/*
  # Fix Corridors RLS Policy

  1. Security Changes
    - Drop existing policy if it exists
    - Create new policy allowing all operations on corridors table
    - This enables users to create, read, update, and delete corridors without restrictions

  Note: In a production environment, you would want more restrictive policies
  that check user authentication and ownership.
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations on corridors" ON corridors;

-- Ensure RLS is enabled
ALTER TABLE corridors ENABLE ROW LEVEL SECURITY;

-- Create policy allowing all operations
CREATE POLICY "Allow all operations on corridors"
ON corridors
FOR ALL
USING (true)
WITH CHECK (true);
