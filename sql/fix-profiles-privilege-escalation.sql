-- ============================================
-- FIX: profiles privilege escalation
-- ============================================
-- Run this in your Supabase SQL Editor.
--
-- Problem: the original "Users can update own profile" / "Users can insert
-- own profile" policies only had a USING clause (or a WITH CHECK that only
-- checked auth.uid() = id). Postgres does not restrict which columns can be
-- changed, so any authenticated user could run:
--   update profiles set is_admin = true where id = auth.uid();
-- and grant themselves admin. Same problem on INSERT: a client could sign
-- up and insert their own profile row with is_admin = true directly against
-- the REST API, bypassing the app's hardcoded `is_admin: false`.
--
-- Fix: add a WITH CHECK clause that forbids changing is_admin via these
-- policies. Admin status may only be changed by an existing admin (via the
-- separate "Admins can update profiles" policy below).

-- Drop whichever variants exist (harmless if a given name was never created)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Users can update their own profile, but not their own is_admin flag.
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin = (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid())
);

-- New signups can only ever insert themselves as a non-admin.
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id
  AND is_admin = false
);

-- Admins can change any profile's is_admin flag (e.g. via the AdminDashboard
-- "Make Admin" / "Remove Admin" buttons). This is the only supported path
-- for promoting a user to admin besides the Supabase SQL editor.
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
CREATE POLICY "Admins can update profiles"
ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.is_admin = true
  )
);

-- ============================================
-- Verification (run manually, replace with a real non-admin user's JWT)
-- ============================================
-- As a logged-in non-admin user, this should now fail / affect 0 rows:
--   update profiles set is_admin = true where id = auth.uid();
