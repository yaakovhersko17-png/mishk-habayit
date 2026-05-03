-- Add wallet linkage, dream flag, and auto-deposit amount to goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS wallet_id   UUID       REFERENCES wallets(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_dream    BOOLEAN    NOT NULL DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS auto_amount DECIMAL(12,2);
