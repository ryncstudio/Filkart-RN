import React, { useState, useEffect, useCallback } from 'react';
import * as SplashScreenAPI from 'expo-splash-screen';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

// ── ErrorBoundary: shows actual crash message instead of Expo Go's generic screen ──
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#1a1a1a' }} contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
          <Text style={{ color: '#FF6B6B', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>🚨 App Crash</Text>
          <Text style={{ color: '#fff', fontSize: 13, marginBottom: 8 }}>{this.state.error?.toString()}</Text>
          <Text style={{ color: '#aaa', fontSize: 11 }}>{this.state.error?.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

import SplashScreen     from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen      from './src/screens/LoginScreen';
import SignUpScreen     from './src/screens/SignUpScreen';
import MembershipScreen from './src/screens/MembershipScreen';
import PaymentScreen    from './src/screens/PaymentScreen';
import OTPScreen        from './src/screens/OTPScreen';
import DashboardScreen  from './src/screens/DashboardScreen';
import NetworkScreen    from './src/screens/NetworkScreen';

import { supabase, signOut } from './src/lib/supabase';

try { SplashScreenAPI.preventAutoHideAsync(); } catch (_) {}
const SPLASH_DURATION = 3200;

// ── Developer emails — bypass payment & OTP immediately ───────────────────────
const DEV_EMAILS = ['dev@filkart.ph'];

// ── Resolve which screen a logged-in user should land on ─────────────────────
async function resolveScreenForUser(userId) {
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('status, plan_id, role')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return 'membership';
    if (profile.role === 'developer') return 'dashboard';  // ← dev bypass
    if (profile.status === 'Active') return 'dashboard';
    if (profile.status === 'PAID')   return 'otp';
    return 'membership';
  } catch {
    return 'membership';
  }
}

export default function App() {
  // Screens: splash | onboarding | login | signup | membership | payment | dashboard
  const [screen, setScreen]     = useState('splash');
  const [appReady, setAppReady] = useState(false);

  // Session data threaded through registration flow
  const [userData, setUserData] = useState(null); // { userId, fullName, mobile, email }
  const [planData, setPlanData] = useState(null); // { plan_id, amount }

  useEffect(() => {
    const bootstrap = async () => {
      const t0 = Date.now();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const remaining = Math.max(0, SPLASH_DURATION - (Date.now() - t0));

        let targetScreen = 'onboarding';
        if (session?.user) {
          setUserData({ userId: session.user.id });
          // ── Developer fast-pass (all 3 paths covered) ─────────────────────
          if (session.user.email && DEV_EMAILS.includes(session.user.email)) {
            targetScreen = 'dashboard';
          } else {
            targetScreen = await resolveScreenForUser(session.user.id);
          }
        }

        setTimeout(() => {
          setAppReady(true);
          setTimeout(() => setScreen(targetScreen), 350);
        }, remaining);
      } catch {
        setTimeout(() => {
          setAppReady(true);
          setTimeout(() => setScreen('onboarding'), 350);
        }, SPLASH_DURATION);
      }
    };

    bootstrap();

    // ── Listen for auth state changes (login/logout) ──────────────────────
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && appReady && session?.user) {
        setUserData({ userId: session.user.id });
        // Developer fast-pass
        if (session.user.email && DEV_EMAILS.includes(session.user.email)) {
          setScreen('dashboard');
          return;
        }
        const target = await resolveScreenForUser(session.user.id);
        setScreen(target);
      }
      if (event === 'SIGNED_OUT' && appReady) {
        setScreen('login');
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const onLayout = useCallback(async () => {
    if (appReady) {
      try { await SplashScreenAPI.hideAsync(); } catch (_) {}
    }
  }, [appReady]);

  const handleLogout = async () => {
    await signOut();
    setUserData(null);
    setPlanData(null);
    setScreen('login');
  };

  // Called after payment confirmed — re-check status then go to dashboard
  const handlePaymentSuccess = async () => {
    if (userData?.userId) {
      const target = await resolveScreenForUser(userData.userId);
      setScreen(target);
    } else {
      setScreen('dashboard');
    }
  };

  // Called on login — check if user already paid
  const handleLogin = async (userId) => {
    if (userId) {
      setUserData({ userId });

      // ── Developer fast-pass: check email from auth session ────────────────
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email && DEV_EMAILS.includes(user.email)) {
          setScreen('dashboard');
          return;
        }
      } catch (_) {}

      const target = await resolveScreenForUser(userId);
      setScreen(target);
    } else {
      setScreen('membership');
    }
  };

  if (screen === 'splash') return <ErrorBoundary><SplashScreen /></ErrorBoundary>;

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }} onLayout={onLayout}>

        {screen === 'onboarding' && (
          <OnboardingScreen onDone={() => setScreen('login')} />
        )}

        {screen === 'login' && (
          <LoginScreen
            onLogin={handleLogin}
            onSignUp={() => setScreen('signup')}
          />
        )}

        {screen === 'signup' && (
          <SignUpScreen
            onNext={(data) => { setUserData(data); setScreen('membership'); }}
            onBack={() => setScreen('login')}
          />
        )}

        {screen === 'membership' && (
          <MembershipScreen
            onSelect={(plan) => { setPlanData(plan); setScreen('payment'); }}
            onLogout={handleLogout}
          />
        )}

        {screen === 'payment' && (
          <PaymentScreen
            plan={planData}
            userData={userData}
            onSuccess={handlePaymentSuccess}
            onBack={() => setScreen('membership')}
          />
        )}

        {screen === 'otp' && (
          <OTPScreen
            userData={userData}
            onSuccess={() => setScreen('dashboard')}
            onBack={() => setScreen('membership')}
          />
        )}

      {screen === 'dashboard' && (
          <DashboardScreen
            userData={userData}
            onLogout={handleLogout}
            onNetwork={() => setScreen('network')}
          />
        )}

        {screen === 'network' && (
          <NetworkScreen
            userData={userData}
            onBack={() => setScreen('dashboard')}
          />
        )}

      </View>
    </ErrorBoundary>
  );
}
