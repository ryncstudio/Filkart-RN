-- ============================================================
-- FilKart Database Functions & Triggers
-- Migration 002: Business Logic
-- ============================================================

-- ── Trigger: Auto-create wallet on new user ───────────────────────────────
CREATE OR REPLACE FUNCTION public.create_wallet_for_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.create_wallet_for_user();


-- ── Trigger: Keep unilevel 50/50 split in sync ───────────────────────────
CREATE OR REPLACE FUNCTION public.sync_unilevel_split()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.withdrawable_cash := ROUND(NEW.unilevel_balance * 0.5, 2);
  NEW.filkart_credits   := ROUND(NEW.unilevel_balance * 0.5, 2);
  NEW.updated_at        := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_unilevel_update ON public.wallets;
CREATE TRIGGER on_unilevel_update
  BEFORE UPDATE OF unilevel_balance ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.sync_unilevel_split();


-- ── Function: Auto-Spill (Power of 10, First Come First Serve) ───────────
--
--  Rules:
--    1. Always place in the LOWEST vacant BFS position
--    2. Left → Right within each level, complete level before next
--    3. After placing, pre-create 10 child placeholder nodes if level < 5
--    4. Uses FOR UPDATE SKIP LOCKED to be safe under concurrent inserts
--
CREATE OR REPLACE FUNCTION public.auto_spill_user(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  next_node  RECORD;
  i          INTEGER;
  child_pos  INTEGER;
  child_lpos INTEGER;
BEGIN
  -- 1. Lock and find next available slot (BFS order = smallest position)
  SELECT *
  INTO   next_node
  FROM   public.network_nodes
  WHERE  user_id IS NULL
  ORDER  BY position ASC
  LIMIT  1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Network is full — no vacant positions available'
    );
  END IF;

  -- 2. Place the user
  UPDATE public.network_nodes
  SET    user_id   = p_user_id,
         filled_at = NOW()
  WHERE  id = next_node.id;

  -- 3. Pre-create 10 child nodes if not at level 5
  IF next_node.level < 5 THEN
    FOR i IN 1..10 LOOP
      -- BFS child position: (parent_position - 1) * 10 + 1 + i
      child_pos  := (next_node.position - 1) * 10 + 1 + i;
      child_lpos := (next_node.level_position - 1) * 10 + i;

      INSERT INTO public.network_nodes
        (position, level, level_position, parent_id)
      VALUES
        (child_pos, next_node.level + 1, child_lpos, next_node.id)
      ON CONFLICT (position) DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success',        true,
    'user_id',        p_user_id,
    'node_id',        next_node.id,
    'position',       next_node.position,
    'level',          next_node.level,
    'level_position', next_node.level_position
  );
END;
$$;


-- ── Function: Mark user Active after OTP verified ─────────────────────────
CREATE OR REPLACE FUNCTION public.activate_user_after_otp(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users
  SET    otp_verified = true,
         status       = 'Active',
         updated_at   = NOW()
  WHERE  id     = p_user_id
    AND  status = 'PAID';   -- Guard: only PAID users can activate
END;
$$;


-- ── Function: update updated_at automatically ─────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_users_updated_at    ON public.users;
DROP TRIGGER IF EXISTS set_payments_updated_at ON public.payments;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
