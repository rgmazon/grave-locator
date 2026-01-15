-- Create a table to store proposed edits to graves
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.graves_edits (
  id bigserial PRIMARY KEY,
  grave_id bigint NOT NULL REFERENCES public.graves(id) ON DELETE CASCADE,
  proposed_changes jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  submitted_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz
);

-- Optional index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_graves_edits_status ON public.graves_edits (status);
