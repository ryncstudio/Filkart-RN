-- ============================================================
-- FilKart: CRITICAL FIXES (v2 — handles duplicate columns)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- FIX 1: Referral Code Lookup (bypasses RLS)
-- ═══════════════════════════════════════════════════════════════
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

GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO anon;


-- ═══════════════════════════════════════════════════════════════
-- FIX 2: Clean up duplicate wallet columns
-- The table has BOTH old and new column names. We keep the new
-- ones (share_earn, unilevel_cash, unilevel_credits) and copy
-- any non-zero balances from the old ones before dropping them.
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Handle share_earn_balance → share_earn
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'share_earn_balance'
  ) THEN
    -- If both exist, copy any non-zero data from old to new, then drop old
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'share_earn'
    ) THEN
      -- Copy max of old/new balance (in case either has real data)
      UPDATE public.wallets
      SET share_earn = GREATEST(share_earn, share_earn_balance)
      WHERE share_earn_balance > 0 AND share_earn_balance > share_earn;

      ALTER TABLE public.wallets DROP COLUMN share_earn_balance;
      RAISE NOTICE 'Dropped duplicate share_earn_balance (kept share_earn)';
    ELSE
      ALTER TABLE public.wallets RENAME COLUMN share_earn_balance TO share_earn;
      RAISE NOTICE 'Renamed share_earn_balance → share_earn';
    END IF;
  END IF;

  -- Handle withdrawable_cash → unilevel_cash
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'withdrawable_cash'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'unilevel_cash'
    ) THEN
      UPDATE public.wallets
      SET unilevel_cash = GREATEST(unilevel_cash, withdrawable_cash)
      WHERE withdrawable_cash > 0 AND withdrawable_cash > unilevel_cash;

      ALTER TABLE public.wallets DROP COLUMN withdrawable_cash;
      RAISE NOTICE 'Dropped duplicate withdrawable_cash (kept unilevel_cash)';
    ELSE
      ALTER TABLE public.wallets RENAME COLUMN withdrawable_cash TO unilevel_cash;
      RAISE NOTICE 'Renamed withdrawable_cash → unilevel_cash';
    END IF;
  END IF;

  -- Handle filkart_credits → unilevel_credits
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'filkart_credits'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'unilevel_credits'
    ) THEN
      UPDATE public.wallets
      SET unilevel_credits = GREATEST(unilevel_credits, filkart_credits)
      WHERE filkart_credits > 0 AND filkart_credits > unilevel_credits;

      ALTER TABLE public.wallets DROP COLUMN filkart_credits;
      RAISE NOTICE 'Dropped duplicate filkart_credits (kept unilevel_credits)';
    ELSE
      ALTER TABLE public.wallets RENAME COLUMN filkart_credits TO unilevel_credits;
      RAISE NOTICE 'Renamed filkart_credits → unilevel_credits';
    END IF;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- FIX 3: Update the unilevel split trigger to use correct names
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sync_unilevel_split()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.unilevel_cash    := ROUND(NEW.unilevel_balance * 0.5, 2);
  NEW.unilevel_credits := ROUND(NEW.unilevel_balance * 0.5, 2);
  NEW.updated_at       := NOW();
  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- VERIFY: Show final wallet columns (should show correct names)
-- ═══════════════════════════════════════════════════════════════
SELECT column_name, data_type
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'wallets'
ORDER  BY ordinal_position;
