-- ============================================
-- FIX: RLS bypass via SECURITY DEFINER RPCs
-- ============================================
-- Run this in your Supabase SQL Editor.
--
-- Problem: get_graves_by_status(grave_status) is SECURITY DEFINER and
-- granted to anon/authenticated. It reads the graves table directly with
-- no restriction beyond the caller-supplied status argument, so RLS never
-- applies. Anyone, logged in or not, can call:
--   select * from get_graves_by_status('pending');
--   select * from get_graves_by_status('rejected');
-- and read every unapproved submission (name, dates, image, submitted_by).
--
-- Fix: replace it with get_approved_graves(), which takes no status
-- argument and always hardcodes status = 'approved'. get_grave_location is
-- dropped too since it's no longer used by the frontend (the new function
-- returns location_text directly) and had the same unrestricted-by-id
-- shape.

DROP FUNCTION IF EXISTS get_graves_by_status(text);
DROP FUNCTION IF EXISTS get_graves_by_status(text) CASCADE;
DROP FUNCTION IF EXISTS get_grave_location(uuid);
DROP FUNCTION IF EXISTS get_grave_location(bigint);

-- NOTE: the two existing sql/ files disagree on the type of graves.id
-- (uuid in sql/create-all-required-functions.sql, bigint in
-- create-location-function.sql at repo root) — this project's actual
-- graves.id is bigint, confirmed by the "return type mismatch" error
-- Postgres throws when this is wrong.
--
-- NOTE: SECURITY DEFINER functions get a locked-down search_path (below)
-- so a malicious search_path can't be used to hijack unqualified names.
-- Supabase installs PostGIS in the `extensions` schema by default, which is
-- why it's included here — if `select extname, extnamespace::regnamespace
-- from pg_extension where extname = 'postgis';` shows a different schema on
-- your project, use that schema name instead.
CREATE OR REPLACE FUNCTION get_approved_graves()
RETURNS TABLE (
  id bigint,
  deceased_name text,
  birth_date date,
  death_date date,
  image_url text,
  status text,
  submitted_by uuid,
  created_at timestamptz,
  location_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    id,
    deceased_name,
    birth_date,
    death_date,
    image_url,
    status,
    submitted_by,
    created_at,
    ST_AsText(location::geometry) as location_text
  FROM graves
  WHERE status = 'approved'
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_approved_graves() TO authenticated, anon;

-- ============================================
-- Verification
-- ============================================
-- As anon: select * from get_approved_graves();  -- only approved rows
-- As anon: select * from get_graves_by_status('pending');  -- should error, function no longer exists
