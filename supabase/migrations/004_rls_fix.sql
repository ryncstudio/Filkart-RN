-- ============================================================
-- FilKart RLS Fix — Allow users to insert their own profile row
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Allow authenticated users to insert their own row
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to read their wallet (fix for wallets too)
CREATE POLICY "wallets_insert_own"
  ON public.wallets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid()
    )
  );
