-- Add is_admin column to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Set admin user (update with your admin email)
UPDATE drivers SET is_admin = TRUE WHERE email = 'pablo.larrama@example.com';
