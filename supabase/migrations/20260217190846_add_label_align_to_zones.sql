/*
  # Add label_align to zones table
  
  This migration adds text alignment control for zone labels in the layout builder.
  
  ## Changes
    - Adds `label_align` column to `zones` table
      - Type: text
      - Default: 'center'
      - Controls horizontal alignment of zone labels (left, center, right)
  
  ## Use Cases
    - Allows customization of label positioning within zones
    - Improves readability for zones of different sizes and shapes
    - Provides flexibility for visual layout preferences
*/

ALTER TABLE zones ADD COLUMN IF NOT EXISTS label_align text NOT NULL DEFAULT 'center';