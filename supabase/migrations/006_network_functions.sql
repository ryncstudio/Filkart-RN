-- ============================================================
-- FilKart: Network (Unilevel) Query Functions
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- Function: Get network members at a specific level
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_network_by_level(
  p_user_id UUID,
  p_level   INT
)
RETURNS TABLE (
  referred_id UUID,
  username    TEXT,
  full_name   TEXT,
  lvl         INT,
  pos         INT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH RECURSIVE downline AS (
    SELECT
      u.id          AS user_id,
      u.username,
      u.full_name,
      1             AS lvl,
      ROW_NUMBER() OVER (ORDER BY u.created_at ASC)::INT AS pos
    FROM public.users u
    WHERE u.referred_by = p_user_id
      AND u.status IN ('PAID', 'Active')

    UNION ALL

    SELECT
      u.id,
      u.username,
      u.full_name,
      d.lvl + 1,
      ROW_NUMBER() OVER (ORDER BY u.created_at ASC)::INT
    FROM public.users u
    JOIN downline d ON u.referred_by = d.user_id
    WHERE d.lvl < 5
      AND u.status IN ('PAID', 'Active')
  )
  SELECT user_id, username, full_name, lvl, pos
  FROM downline
  WHERE lvl = p_level
  ORDER BY pos ASC;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Function: Get count of network members at a specific level
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_network_count_by_level(
  p_user_id UUID,
  p_level   INT
)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH RECURSIVE downline AS (
    SELECT u.id AS user_id, 1 AS lvl
    FROM public.users u
    WHERE u.referred_by = p_user_id
      AND u.status IN ('PAID', 'Active')

    UNION ALL

    SELECT u.id, d.lvl + 1
    FROM public.users u
    JOIN downline d ON u.referred_by = d.user_id
    WHERE d.lvl < 5
      AND u.status IN ('PAID', 'Active')
  )
  SELECT COUNT(*)::INT FROM downline WHERE lvl = p_level;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Function: Get the user who referred this user
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_referrer(p_user_id UUID)
RETURNS TABLE (
  referrer_id UUID,
  username    TEXT,
  full_name   TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT u.id, u.username, u.full_name
  FROM public.users u
  WHERE u.id = (
    SELECT referred_by FROM public.users WHERE id = p_user_id
  );
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_network_by_level(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_network_count_by_level(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referrer(UUID) TO authenticated;
