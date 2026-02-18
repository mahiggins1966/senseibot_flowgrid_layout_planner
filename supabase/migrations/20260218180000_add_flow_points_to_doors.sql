-- Add user-drawn flow path points to doors
ALTER TABLE doors ADD COLUMN IF NOT EXISTS inbound_flow_points jsonb;
ALTER TABLE doors ADD COLUMN IF NOT EXISTS outbound_flow_points jsonb;
