/*
  # Create painted_squares table for persistence

  1. New Tables
    - `painted_squares`
      - `id` (uuid, primary key)
      - `row` (integer) - Row position on grid
      - `col` (integer) - Column position on grid
      - `type` (text) - 'permanent' or 'semi-fixed'
      - `label` (text, nullable) - Optional label for the square
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on painted_squares table
    - Add policies for public access (matching other tables)

  3. Important Notes
    - This table stores individual painted squares on the grid
    - The row/col combination should be unique per square
    - Supports both permanent and semi-fixed square types
*/

CREATE TABLE IF NOT EXISTS painted_squares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row integer NOT NULL,
  col integer NOT NULL,
  type text NOT NULL CHECK (type IN ('permanent', 'semi-fixed')),
  label text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(row, col)
);

ALTER TABLE painted_squares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read painted squares"
  ON painted_squares FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert painted squares"
  ON painted_squares FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update painted squares"
  ON painted_squares FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete painted squares"
  ON painted_squares FOR DELETE
  TO public
  USING (true);