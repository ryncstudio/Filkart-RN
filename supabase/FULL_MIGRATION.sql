-- ============================================================
-- FilKart Database Schema
-- Migration 001: Core Tables
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name       TEXT NOT NULL,
  mobile_number   TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT,
  status          TEXT NOT NULL DEFAULT 'Pending',
                  -- 'Pending' → 'PAID' → 'Active'
  plan_id         TEXT,                  -- 'affiliate' | 'partner'
  plan_amount     NUMERIC(10,2),
  referral_code   TEXT UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 8)),
  referred_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  otp_verified    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Wallets ───────────────────────────────────────────────────────────────
-- unilevel_balance: 50% → withdrawable_cash, 50% → filkart_credits
CREATE TABLE IF NOT EXISTS public.wallets (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  unilevel_balance    NUMERIC(14,2) NOT NULL DEFAULT 0,
  withdrawable_cash   NUMERIC(14,2) NOT NULL DEFAULT 0,  -- auto = 50% of unilevel
  filkart_credits     NUMERIC(14,2) NOT NULL DEFAULT 0,  -- auto = 50% of unilevel
  share_earn_balance  NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Network Nodes (Power of 10 — 5 Levels) ───────────────────────────────
-- BFS position formula:
--   Level 1: positions 1
--   Level 2: positions 2–11  (10^1)
--   Level 3: positions 12–111 (10^2)
--   Level 4: positions 112–1111 (10^3)
--   Level 5: positions 1112–11111 (10^4)
--   Children of node at BFS position P: (P-1)*10+2 to (P-1)*10+11
CREATE TABLE IF NOT EXISTS public.network_nodes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  position        INTEGER NOT NULL UNIQUE,     -- global BFS position (1-indexed)
  level           INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  level_position  INTEGER NOT NULL,            -- position within this level
  parent_id       UUID REFERENCES public.network_nodes(id),
  filled_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed root node (Level 1, Position 1)
INSERT INTO public.network_nodes (position, level, level_position, parent_id)
VALUES (1, 1, 1, NULL)
ON CONFLICT (position) DO NOTHING;

-- ── Payments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.users(id),
  paymongo_payment_id   TEXT UNIQUE,
  paymongo_source_id    TEXT,
  amount                NUMERIC(10,2) NOT NULL,
  plan_id               TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
                        -- 'pending' | 'paid' | 'failed'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_status         ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_mobile         ON public.users(mobile_number);
CREATE INDEX IF NOT EXISTS idx_network_nodes_vacant ON public.network_nodes(position)
  WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user        ON public.payments(user_id);
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
-- ============================================================
-- FilKart Row Level Security (RLS)
-- Migration 003: Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_nodes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments       ENABLE ROW LEVEL SECURITY;

-- ── Users policies ────────────────────────────────────────────────────────

-- Users can read their own row
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own row (limited fields — no status change via client)
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND status = 'Pending'); -- can't self-promote status

-- Service role has full access (bypasses RLS automatically)

-- ── Wallets policies ──────────────────────────────────────────────────────

CREATE POLICY "wallets_select_own"
  ON public.wallets FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND status IN ('PAID', 'Active')
    )
  );

-- ── Network nodes — read-only for authenticated users ────────────────────

CREATE POLICY "nodes_select_authenticated"
  ON public.network_nodes FOR SELECT
  TO authenticated
  USING (true); -- anyone logged in can see the tree structure

-- ── Payments — users see only their own ──────────────────────────────────

CREATE POLICY "payments_select_own"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- ── OTP Gate: only PAID users may trigger OTP verification ───────────────
-- Enforced in the Edge Function:  check users.status = 'PAID' before calling Twilio
-- This view makes it easy to check from the app
CREATE OR REPLACE VIEW public.otp_eligible AS
  SELECT id, mobile_number, full_name
  FROM   public.users
  WHERE  status = 'PAID'
    AND  otp_verified = false;

-- Only service role can use this view
REVOKE ALL ON public.otp_eligible FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON public.otp_eligible TO service_role;
