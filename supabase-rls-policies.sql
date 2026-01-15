-- ============================================
-- ROW LEVEL SECURITY POLICIES FOR GRAVE TRACKER
-- ============================================
-- Run these commands in your Supabase SQL Editor

-- 1. Enable RLS on tables (if not already enabled)
ALTER TABLE graves ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- Allow anyone to read profiles (needed for displaying submitter info)
CREATE POLICY "Allow public read access to profiles"
ON profiles
FOR SELECT
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id);

-- Allow users to insert their own profile (for new signups)
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================
-- GRAVES TABLE POLICIES
-- ============================================

-- Allow everyone to read approved graves
CREATE POLICY "Public can view approved graves"
ON graves
FOR SELECT
USING (status = 'approved');

-- Allow authenticated users to view their own pending/rejected submissions
CREATE POLICY "Users can view own submissions"
ON graves
FOR SELECT
USING (auth.uid() = submitted_by);

-- Allow admins to view ALL graves (pending, approved, rejected)
CREATE POLICY "Admins can view all graves"
ON graves
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Allow authenticated users to insert new graves (status defaults to pending)
CREATE POLICY "Authenticated users can insert graves"
ON graves
FOR INSERT
WITH CHECK (
  auth.uid() = submitted_by
  AND status = 'pending'
);

-- Allow admins to update grave status
CREATE POLICY "Admins can update graves"
ON graves
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Allow admins to delete graves
CREATE POLICY "Admins can delete graves"
ON graves
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- ============================================
-- IMPORTANT NOTES
-- ============================================
-- 1. Make sure you have at least one admin user in the profiles table:
--    UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID';
--
-- 2. If you get conflicts, drop existing policies first:
--    DROP POLICY IF EXISTS "policy_name" ON table_name;
--
-- 3. To check existing policies:
--    SELECT * FROM pg_policies WHERE tablename IN ('graves', 'profiles');
