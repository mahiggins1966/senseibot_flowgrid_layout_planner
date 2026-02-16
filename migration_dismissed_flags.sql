-- Add dismissed_flags column to layouts table
-- Stores flag IDs that the user has dismissed during scoring
ALTER TABLE layouts ADD COLUMN IF NOT EXISTS dismissed_flags text[] DEFAULT '{}';
