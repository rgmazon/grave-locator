-- ============================================
-- FIX: graves_edits has no RLS
-- ============================================
-- Run this in your Supabase SQL Editor.
--
-- Problem: sql/create-graves-edits-table.sql creates graves_edits but never
-- enables row level security or defines policies. On Supabase, a table
-- without RLS enabled is fully open to anon/authenticated via the REST API
-- (default grants), so anyone could read, insert, update, or delete
-- proposed edits.

ALTER TABLE public.graves_edits ENABLE ROW LEVEL SECURITY;

-- Submitters can see their own edits; admins can see all.
DROP POLICY IF EXISTS "Users can view own edits" ON public.graves_edits;
CREATE POLICY "Users can view own edits"
ON public.graves_edits
FOR SELECT
USING (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Admins can view all edits" ON public.graves_edits;
CREATE POLICY "Admins can view all edits"
ON public.graves_edits
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Authenticated users can propose edits, only as themselves and only
-- starting in 'pending' status.
DROP POLICY IF EXISTS "Authenticated users can insert edits" ON public.graves_edits;
CREATE POLICY "Authenticated users can insert edits"
ON public.graves_edits
FOR INSERT
WITH CHECK (
  auth.uid() = submitted_by
  AND status = 'pending'
);

-- Only admins can update edits (approve/reject in AdminDashboard).
DROP POLICY IF EXISTS "Admins can update edits" ON public.graves_edits;
CREATE POLICY "Admins can update edits"
ON public.graves_edits
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- No DELETE policy: nothing in the app deletes edit rows, so none are
-- allowed (default deny once RLS is enabled).

-- ============================================
-- Verification
-- ============================================
-- As anon (logged out): select * from graves_edits;  -- should return 0 rows
-- As a non-admin user: select * from graves_edits where submitted_by <> auth.uid();  -- 0 rows
-- As a non-admin user: update graves_edits set status = 'approved' where id = <some id>;  -- 0 rows affected
