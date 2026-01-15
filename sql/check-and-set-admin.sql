-- Check your current profile
SELECT id, full_name, is_admin, created_at, updated_at 
FROM profiles 
WHERE id = auth.uid();

-- If the above returns nothing, you need to create a profile first
-- Replace 'YOUR_EMAIL@example.com' with your actual email
INSERT INTO profiles (id, full_name, is_admin)
SELECT id, email, true
FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com'
ON CONFLICT (id) DO UPDATE SET is_admin = true;

-- Or if you know your user ID, update directly:
-- UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID';

-- Check all users and their admin status
SELECT 
  p.id, 
  p.full_name, 
  p.is_admin,
  u.email
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC;
