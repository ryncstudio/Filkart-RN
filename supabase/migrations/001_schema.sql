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
