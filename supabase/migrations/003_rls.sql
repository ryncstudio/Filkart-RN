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
