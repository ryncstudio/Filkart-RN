import React, { useState, useEffect, useCallback } from 'react';
import * as SplashScreenAPI from 'expo-splash-screen';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated, StatusBar } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

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
import ShopScreen       from './src/screens/ShopScreen';
import MarketScreen     from './src/screens/MarketScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import ProductsScreen       from './src/screens/ProductsScreen';
import ProductDetailScreen  from './src/screens/ProductDetailScreen';
import CartScreen           from './src/screens/CartScreen';
import CheckoutScreen       from './src/screens/CheckoutScreen';
import OrderSuccessScreen   from './src/screens/OrderSuccessScreen';
import OrderStatusScreen    from './src/screens/OrderStatusScreen';
import WalletScreen         from './src/screens/WalletScreen';
import ProfileScreen        from './src/screens/ProfileScreen';
import ProfileInfoScreen    from './src/screens/ProfileInfoScreen';
import OrdersScreen         from './src/screens/OrdersScreen';

import { supabase, signOut } from './src/lib/supabase';

try { SplashScreenAPI.preventAutoHideAsync(); } catch (_) {}
const SPLASH_DURATION = 3200;

// ── Developer emails — bypass payment & OTP immediately ───────────────────────
const DEV_EMAILS = ['dev@filkart.ph'];

// ── No Internet Overlay ───────────────────────────────────────────────────────
function NoInternetOverlay({ onRefresh }) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={noNetStyles.overlay}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f23" />
      <View style={noNetStyles.card}>
        {/* WiFi-off icon */}
        <Animated.View style={[noNetStyles.iconWrap, { opacity: pulseAnim }]}>
          <Text style={noNetStyles.icon}>📡</Text>
          <View style={noNetStyles.slashLine} />
        </Animated.View>

        <Text style={noNetStyles.title}>No Internet Connection</Text>
        <Text style={noNetStyles.desc}>
          Please check your WiFi or mobile data{'\n'}and try again.
        </Text>

        <TouchableOpacity
          style={noNetStyles.refreshBtn}
          activeOpacity={0.8}
          onPress={onRefresh}
        >
          <Text style={noNetStyles.refreshIcon}>🔄</Text>
          <Text style={noNetStyles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const noNetStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0f23',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,107,107,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  icon: {
    fontSize: 44,
  },
  slashLine: {
    position: 'absolute',
    width: 60,
    height: 3,
    backgroundColor: '#FF6B6B',
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00C853',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  refreshIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  refreshText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

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
  const [userData, setUserData]         = useState(null);
  const [planData,  setPlanData]         = useState(null);
  const [categoryFilter,  setCategoryFilter]  = useState(null);
  const [selectedProduct, setSelectedProduct]  = useState(null);
  const [checkoutItems,   setCheckoutItems]    = useState([]);
  const [placedOrder,     setPlacedOrder]      = useState(null);
  const [productDetailOrigin, setProductDetailOrigin] = useState('products');

  // ── Connectivity state (start true to avoid false-positive flash on launch) ──
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });
    // Fetch initial state immediately
    NetInfo.fetch().then(state => setIsConnected(state.isConnected ?? true));
    return () => unsubscribe();
  }, []);

  const handleRefresh = useCallback(() => {
    NetInfo.fetch().then(state => setIsConnected(state.isConnected ?? true));
  }, []);

  useEffect(() => {
    // 1. Instantly hide the native boring splash screen so our custom animated one takes over
    SplashScreenAPI.hideAsync().catch(() => {});

    const bootstrap = async () => {
      const t0 = Date.now();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Let the beautiful animated splash screen run for at least SPLASH_DURATION
        const remaining = Math.max(0, SPLASH_DURATION - (Date.now() - t0));

        let targetScreen = 'onboarding';
        if (session?.user) {
          setUserData({ userId: session.user.id });
          if (session.user.email && DEV_EMAILS.includes(session.user.email)) {
            targetScreen = 'dashboard';
          } else {
            targetScreen = await resolveScreenForUser(session.user.id);
          }
        }

        setTimeout(() => {
          setAppReady(true);
          setScreen(targetScreen);
        }, remaining);
      } catch {
        setTimeout(() => {
          setAppReady(true);
          setScreen('onboarding');
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

  const onLayout = useCallback(() => {
    // Nothing needed here since we hid native splash immediately
  }, []);

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
    if (!userId) {
      // Login failed — stay on login screen so the error is visible.
      return;
    }

    // ── Developer fast-pass ───────────────────────────────────────────────
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && DEV_EMAILS.includes(user.email)) {
        setUserData({ userId });
        setScreen('dashboard');
        return;
      }
    } catch (_) {}

    // ── Fetch full profile so PaymentScreen & OTPScreen have name/mobile ──
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, mobile_number, email')
        .eq('id', userId)
        .maybeSingle();
      setUserData({
        userId,
        fullName: profile?.full_name  ?? '',
        mobile:   profile?.mobile_number ?? '',
        email:    profile?.email ?? '',
      });
    } catch (_) {
      setUserData({ userId });
    }

    const target = await resolveScreenForUser(userId);
    setScreen(target);
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
            onShop={() => setScreen('shop')}
            onMarket={() => setScreen('market')}
            onWallet={() => setScreen('wallet')}
            onProfile={() => setScreen('profile')}
          />
        )}

        {screen === 'network' && (
          <NetworkScreen
            userData={userData}
            onBack={() => setScreen('dashboard')}
            onMarket={() => setScreen('market')}
            onWallet={() => setScreen('wallet')}
            onProfile={() => setScreen('profile')}
          />
        )}

        {screen === 'shop' && (
          <ShopScreen
            userData={userData}
            onBack={() => setScreen('dashboard')}
          />
        )}

        {screen === 'market' && (
          <MarketScreen
            userData={userData}
            categoryFilter={categoryFilter}
            onHome={() => setScreen('dashboard')}
            onNetwork={() => setScreen('network')}
            onWallet={() => setScreen('wallet')}
            onProfile={() => setScreen('profile')}
            onCategories={() => setScreen('categories')}
            onProducts={() => setScreen('products')}
            onProductPress={(p) => { setSelectedProduct(p); setProductDetailOrigin('market'); setScreen('productDetail'); }}
            onCartPress={() => setScreen('cart')}
          />
        )}

        {screen === 'categories' && (
          <CategoriesScreen
            userData={userData}
            onBack={() => setScreen('market')}
            onHome={() => setScreen('dashboard')}
            onNetwork={() => setScreen('network')}
            onWallet={() => setScreen('wallet')}
            onSelectCategory={(filter) => {
              setCategoryFilter(filter);
              setScreen('market');
            }}
          />
        )}

        {screen === 'products' && (
          <ProductsScreen
            userData={userData}
            onBack={() => setScreen('market')}
            onHome={() => setScreen('dashboard')}
            onNetwork={() => setScreen('network')}
            onWallet={() => setScreen('wallet')}
            onProductPress={(p) => { setSelectedProduct(p); setProductDetailOrigin('products'); setScreen('productDetail'); }}
          />
        )}

        {screen === 'productDetail' && (
          <ProductDetailScreen
            product={selectedProduct}
            userData={userData}
            onBack={() => setScreen(productDetailOrigin)}
            onCartPress={() => setScreen('cart')}
            onBuyNow={(items) => { setCheckoutItems(items); setScreen('checkout'); }}
          />
        )}

        {screen === 'wallet' && (
          <WalletScreen
            userData={userData}
            onBack={() => setScreen('dashboard')}
            onHome={() => setScreen('dashboard')}
            onMarket={() => setScreen('market')}
            onNetwork={() => setScreen('network')}
          />
        )}

        {screen === 'profile' && (
          <ProfileScreen
            userData={userData}
            onHome={() => setScreen('dashboard')}
            onMarket={() => setScreen('market')}
            onWallet={() => setScreen('wallet')}
            onNetwork={() => setScreen('network')}
            onPersonalInfo={() => setScreen('profileInfo')}
            onOrders={() => setScreen('orders')}
          />
        )}

        {screen === 'orders' && (
          <OrdersScreen
            userData={userData}
            onBack={() => setScreen('profile')}
          />
        )}

        {screen === 'profileInfo' && (
          <ProfileInfoScreen
            userData={userData}
            onBack={() => setScreen('profile')}
          />
        )}

        {screen === 'cart' && (
          <CartScreen
            userData={userData}
            onBack={() => setScreen(selectedProduct ? 'productDetail' : 'market')}
            onCheckout={(items) => { setCheckoutItems(items); setScreen('checkout'); }}
          />
        )}

        {screen === 'checkout' && (
          <CheckoutScreen
            userData={userData}
            cartItems={checkoutItems}
            onBack={() => setScreen('cart')}
            onOrderPlaced={(order) => { setPlacedOrder(order); setScreen('orderSuccess'); }}
          />
        )}

        {screen === 'orderSuccess' && (
          <OrderSuccessScreen
            order={placedOrder}
            onTrackOrder={() => setScreen('orderStatus')}
            onContinueShopping={() => setScreen('market')}
            onProductPress={(p) => { setSelectedProduct(p); setScreen('productDetail'); }}
          />
        )}

        {screen === 'orderStatus' && (
          <OrderStatusScreen
            orderId={placedOrder?.id}
            onBack={() => setScreen('orderSuccess')}
            onContinueShopping={() => setScreen('market')}
          />
        )}

        {/* ── No Internet Overlay — sits on top of all screens ── */}
        {!isConnected && <NoInternetOverlay onRefresh={handleRefresh} />}

      </View>
    </ErrorBoundary>
  );
}
