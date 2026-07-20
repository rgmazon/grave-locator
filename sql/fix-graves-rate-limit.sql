-- ============================================
-- FIX: no rate limiting on grave submissions
-- ============================================
-- Run this in your Supabase SQL Editor.
--
-- Problem: any authenticated user can call insert on graves as fast as
-- their client can send requests, filling the pending queue with junk for
-- admins to wade through. The frontend has a 10s submit-button cooldown,
-- but that's only a UX nicety and can be bypassed by calling the REST API
-- directly — this trigger is the actual enforcement point.
--
-- Limit: 5 pending submissions per user per rolling hour. Adjust
-- max_per_hour below if that's too strict/loose for your use case.

CREATE OR REPLACE FUNCTION public.enforce_graves_submission_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_per_hour constant int := 5;
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM graves
  WHERE submitted_by = NEW.submitted_by
    AND created_at > now() - interval '1 hour';

  IF recent_count >= max_per_hour THEN
    RAISE EXCEPTION 'rate limit exceeded: too many submissions in the last hour';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graves_rate_limit ON public.graves;
CREATE TRIGGER graves_rate_limit
  BEFORE INSERT ON public.graves
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_graves_submission_rate_limit();

-- ============================================
-- Verification
-- ============================================
-- As a test user, insert 6 graves within an hour; the 6th should fail with
-- "rate limit exceeded: too many submissions in the last hour".
