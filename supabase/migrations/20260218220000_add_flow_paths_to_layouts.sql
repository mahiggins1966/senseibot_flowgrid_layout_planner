-- Add layout-specific flow paths column
-- Flow paths are per-layout (not per-door) so each layout can have different material routes
ALTER TABLE layouts ADD COLUMN IF NOT EXISTS flow_paths jsonb DEFAULT '{}';
