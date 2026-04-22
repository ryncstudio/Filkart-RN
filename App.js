import React, { useState, useEffect, useCallback } from 'react';
import * as SplashScreenAPI from 'expo-splash-screen';
import { View } from 'react-native';

import SplashScreen     from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen      from './src/screens/LoginScreen';
import SignUpScreen     from './src/screens/SignUpScreen';
import MembershipScreen from './src/screens/MembershipScreen';
import PaymentScreen    from './src/screens/PaymentScreen';
import OTPScreen        from './src/screens/OTPScreen';
import DashboardScreen  from './src/screens/DashboardScreen';

import { supabase, signOut } from './src/lib/supabase';

SplashScreenAPI.preventAutoHideAsync();
const SPLASH_DURATION = 3200;

// ── Resolve which screen a logged-in user should land on ─────────────────────
async function resolveScreenForUser(userId) {
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('status, plan_id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return 'membership';                          // no profile yet
    if (profile.status === 'Active') return 'dashboard';         // fully activated
    if (profile.status === 'PAID')   return 'otp';               // paid → awaiting OTP
    return 'membership';                                         // Pending → choose plan
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
          // ── Enforce payment gate ──────────────────────────────────────────
          targetScreen = await resolveScreenForUser(session.user.id);
          if (targetScreen !== 'onboarding') {
            setUserData({ userId: session.user.id });
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
        // Check payment status before allowing dashboard
        const target = await resolveScreenForUser(session.user.id);
        setUserData({ userId: session.user.id });
        setScreen(target);
      }
      if (event === 'SIGNED_OUT' && appReady) {
        setScreen('login');
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const onLayout = useCallback(async () => {
    if (appReady) await SplashScreenAPI.hideAsync();
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
      const target = await resolveScreenForUser(userId);
      setScreen(target);
    } else {
      setScreen('membership');
    }
  };

  if (screen === 'splash') return <SplashScreen />;

  return (
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
        <DashboardScreen onLogout={handleLogout} />
      )}

    </View>
  );
}
