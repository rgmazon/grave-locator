-- ============================================
-- FIX: stored XSS via image_url scheme
-- ============================================
-- Run this in your Supabase SQL Editor.
--
-- Problem: graves.image_url is free text with no server-side validation.
-- The frontend renders it as both an <img src> and an <a href> (see
-- GraveDetailsModal in AdminDashboard.jsx and the map popup in
-- MapPage.jsx). A submitter could set it to a `javascript:` URI; since the
-- <a href> was rendered unescaped, clicking the link in an admin's
-- authenticated session would execute attacker-controlled JS. The frontend
-- now validates the scheme before rendering and on submit, but that's
-- client-side only and can be bypassed by calling the REST API directly —
-- this constraint is the actual enforcement point.

-- Before adding the constraint: inspect any existing rows that would
-- violate it. Run this first and eyeball the results — in particular check
-- none of them are an actual javascript:/data: URI (which would mean the
-- XSS was already exploitable), as opposed to blank/malformed values from
-- old test data.
--   select id, deceased_name, image_url from public.graves
--   where image_url is not null and image_url !~ '^https?://';

-- Normalize blank strings to NULL (most likely cause of the violation —
-- an empty string is NOT NULL, so it fails the '^https?://' check) and
-- null out anything else that doesn't pass. Review the SELECT above first
-- so you know what's being cleared.
UPDATE public.graves
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND image_url !~ '^https?://';

ALTER TABLE public.graves
  DROP CONSTRAINT IF EXISTS graves_image_url_scheme_check;

ALTER TABLE public.graves
  ADD CONSTRAINT graves_image_url_scheme_check
  CHECK (image_url IS NULL OR image_url ~ '^https?://');

-- ============================================
-- Verification
-- ============================================
-- This should fail with a check constraint violation:
--   insert into graves (deceased_name, image_url, location, status, submitted_by)
--   values ('test', 'javascript:alert(1)', 'POINT(0 0)', 'pending', auth.uid());
