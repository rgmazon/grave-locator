-- Drop existing function if it exists (fixes return type conflicts)
DROP FUNCTION IF EXISTS get_graves_by_status(text);

-- Create a function to get graves by status with location as text
CREATE OR REPLACE FUNCTION get_graves_by_status(grave_status text)
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
  WHERE status = grave_status
  ORDER BY created_at DESC;
$$;

-- Function to get a single grave's location as text
CREATE OR REPLACE FUNCTION get_grave_location(p_grave_id bigint)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ST_AsText(location::geometry)
  FROM graves
  WHERE id = p_grave_id;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_graves_by_status(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_grave_location(bigint) TO authenticated, anon;
