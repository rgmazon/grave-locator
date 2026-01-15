-- ============================================
-- DIAGNOSTIC QUERIES FOR GRAVE TRACKER
-- ============================================
-- Run these queries in Supabase SQL Editor to diagnose issues

-- 1. Check if you have any users
SELECT 
  id,
  full_name,
  is_admin,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- 2. Check if you have any graves (all statuses)
SELECT 
  id,
  deceased_name,
  status,
  submitted_by,
  created_at
FROM graves
ORDER BY created_at DESC;

-- 3. Count graves by status
SELECT 
  status,
  COUNT(*) as count
FROM graves
GROUP BY status;

-- 4. Check existing RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('graves', 'profiles')
ORDER BY tablename, policyname;

-- 5. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('graves', 'profiles');

-- 6. Get your current user ID (run this while logged in)
SELECT auth.uid() as my_user_id;

-- 7. Make yourself an admin (replace YOUR_EMAIL with your actual email)
UPDATE profiles 
SET is_admin = true 
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'YOUR_EMAIL@example.com'
);

-- Alternative: Make yourself admin using your user ID directly
-- UPDATE profiles SET is_admin = true WHERE id = 'paste-your-user-id-here';
