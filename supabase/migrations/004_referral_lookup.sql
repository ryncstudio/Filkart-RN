-- ============================================================
-- FilKart: Referral Code Lookup (SECURITY DEFINER)
-- Allows any authenticated user to validate a referral code
-- without being blocked by RLS (users can only read own row)
-- ============================================================

-- This function runs with the privileges of the function owner (service role),
-- bypassing RLS. It only returns the user_id — no sensitive data exposed.
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id
  FROM   public.users
  WHERE  referral_code = upper(trim(p_code))
  LIMIT  1;
$$;

-- Grant execute to authenticated users (needed for RPC calls from the app)
GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO anon;
