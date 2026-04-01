-- =========================================
-- משק הבית - Supabase Database Setup
-- הרץ את הקובץ הזה ב-SQL Editor של Supabase
-- =========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- PROFILES (extends auth.users)
-- =====================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_color TEXT DEFAULT '#6C63FF',
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- WALLETS
-- =====================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  balance DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT '₪' CHECK (currency IN ('₪', '$', '€', '£')),
  icon TEXT DEFAULT '💳',
  color TEXT DEFAULT '#6C63FF',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- CATEGORIES
-- =====================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#6C63FF',
  type TEXT DEFAULT 'expense' CHECK (type IN ('income', 'expense', 'both')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TRANSACTIONS
-- =====================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'loan_given', 'loan_received')),
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT '₪' CHECK (currency IN ('₪', '$', '€', '£')),
  description TEXT NOT NULL,
  notes TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id),
  date DATE DEFAULT CURRENT_DATE,
  loan_party TEXT,
  loan_returned DECIMAL(12,2) DEFAULT 0,
  loan_due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INVOICES
-- =====================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_name TEXT,
  date DATE,
  total DECIMAL(12,2),
  vat DECIMAL(12,2),
  currency TEXT DEFAULT '₪',
  wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  scanned_by UUID REFERENCES profiles(id),
  image_url TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INVOICE ITEMS
-- =====================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  price DECIMAL(12,2) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- REMINDERS
-- =====================
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT FALSE,
  is_shopping_list BOOLEAN DEFAULT FALSE,
  shopping_items JSONB DEFAULT '[]',
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- NOTES
-- =====================
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT,
  content TEXT,
  color TEXT DEFAULT '#FFF9C4',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- ACTIVITY LOG
-- =====================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- EXCHANGE RATES
-- =====================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  currency TEXT NOT NULL UNIQUE,
  rate_to_ils DECIMAL(10,4) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users full access (shared household)
CREATE POLICY "auth_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON wallets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON exchange_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================
-- REALTIME
-- =====================
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE reminders;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- =====================
-- DEFAULT DATA
-- =====================
INSERT INTO exchange_rates (currency, rate_to_ils) VALUES
  ('$', 3.70),
  ('€', 4.00),
  ('£', 4.65)
ON CONFLICT (currency) DO NOTHING;

INSERT INTO categories (name, icon, color, type) VALUES
  ('מזון', '🛒', '#4CAF50', 'expense'),
  ('תחבורה', '🚗', '#2196F3', 'expense'),
  ('דיור', '🏠', '#FF9800', 'expense'),
  ('בילויים', '🎉', '#E91E63', 'expense'),
  ('בריאות', '💊', '#00BCD4', 'expense'),
  ('ביגוד', '👕', '#9C27B0', 'expense'),
  ('חינוך', '📚', '#FF5722', 'expense'),
  ('חשבונות', '📄', '#607D8B', 'expense'),
  ('משכורת', '💰', '#4CAF50', 'income'),
  ('הכנסה אחרת', '💵', '#8BC34A', 'income')
ON CONFLICT DO NOTHING;

-- =====================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'user')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =====================
-- PERFORMANCE INDEXES
-- Indexes on columns used for filtering, searching, and sorting
-- =====================

-- Transactions: filter by date, user, wallet, category, type
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at DESC);

-- Invoices: filter by date, business_name, wallet, scanned_by
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices (date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_wallet_id ON invoices (wallet_id);
CREATE INDEX IF NOT EXISTS idx_invoices_scanned_by ON invoices (scanned_by);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices (created_at DESC);

-- Invoice items: lookup by invoice_id, category
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_category_id ON invoice_items (category_id);

-- Reminders: filter by assigned_to, due_date, completion
CREATE INDEX IF NOT EXISTS idx_reminders_assigned_to ON reminders (assigned_to);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders (due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders (is_completed);

-- Activity log: filter by user, entity, date
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log (entity_type);

-- Notes: filter by creator
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes (created_by);

-- Wallets: filter by creator
CREATE INDEX IF NOT EXISTS idx_wallets_created_by ON wallets (created_by);

-- Categories: filter by type
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories (type);

-- =====================
-- DONE!
-- עכשיו צור את המשתמשים ב-Supabase Auth:
-- Authentication → Users → Add User:
--   יעקב: yaakov@mishk.local  / בחר סיסמה
--   יעל:  yael@mishk.local    / בחר סיסמה
--   אדמין: admin@mishk.local  / בחר סיסמה (ואז עדכן role='admin' ב-profiles)
-- =====================
