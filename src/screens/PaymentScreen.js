import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { createPayment, checkPaymentStatus } from '../lib/supabase';

const { width } = Dimensions.get('window');

const PLAN_LABELS = {
  affiliate: 'Affiliate Plan',
  partner:   'Partner Sales Plan',
};

const POLL_INTERVAL_MS = 4000; // check every 4 seconds

export default function PaymentScreen({ plan, userData, onSuccess, onBack }) {
  const [step, setStep]           = useState('loading'); // loading | ready | polling | paid | error
  const [paymentData, setPayment] = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [countdown, setCountdown] = useState(300); // 5-min QR expiry countdown
  const pollRef    = useRef(null);
  const timerRef   = useRef(null);

  const planLabel  = PLAN_LABELS[plan?.plan_id] ?? 'FilKart Plan';
  const amount     = plan?.amount ?? 0;
  const isPartner  = plan?.plan_id === 'partner';

  // ── Create payment on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!userData?.userId || !plan?.plan_id) {
      setErrorMsg('Missing user or plan information.');
      setStep('error');
      return;
    }
    initPayment();
    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  const initPayment = async () => {
    try {
      setStep('loading');
      const result = await createPayment({
        userId:   userData.userId,
        planId:   plan.plan_id,
        amount:   plan.amount,
        fullName: userData.fullName ?? '',
        mobile:   userData.mobile   ?? '',
      });
      setPayment(result);
      setStep('ready');

      // Start countdown timer
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timerRef.current); return 0; }
          return c - 1;
        });
      }, 1000);

    } catch (err) {
      setErrorMsg(err.message ?? 'Could not create payment. Please try again.');
      setStep('error');
    }
  };

  // ── Open PayMongo checkout (QR Ph) ─────────────────────────────────────
  const openCheckout = async () => {
    if (!paymentData?.checkoutUrl) {
      Alert.alert('Error', 'Payment URL not available. Please try again.');
      return;
    }
    setStep('polling');
    await WebBrowser.openBrowserAsync(paymentData.checkoutUrl, {
      toolbarColor:         '#1B4332',
      controlsColor:        '#FBC02D',
      showTitle:            true,
      enableBarCollapsing:  false,
    });
    // Browser closed — start polling for payment confirmation
    startPolling();
  };

  // ── Poll Supabase every 4s for status = 'paid' ─────────────────────────
  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await checkPaymentStatus(userData.userId);
        if (status === 'paid') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStep('paid');
          setTimeout(onSuccess, 1800); // brief "Paid!" screen before navigating
        }
      } catch {
        // silent — keep polling
      }
    }, POLL_INTERVAL_MS);
  };

  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── RENDER: Loading ────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Generating your QR code…</Text>
      </View>
    );
  }

  // ── RENDER: Error ──────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Payment Setup Failed</Text>
        <Text style={styles.errorMsg}>{errorMsg}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={initPayment}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLink}>← Back to Plans</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── RENDER: Paid success ───────────────────────────────────────────────
  if (step === 'paid') {
    return (
      <LinearGradient colors={['#1B4332', '#2E7D32']} style={styles.centerScreen}>
        <Text style={styles.paidEmoji}>✅</Text>
        <Text style={styles.paidTitle}>Payment Confirmed!</Text>
        <Text style={styles.paidSub}>
          Welcome to FilKart! Your account is being activated…
        </Text>
        <ActivityIndicator color="#FBC02D" style={{ marginTop: 20 }} />
      </LinearGradient>
    );
  }

  // ── RENDER: Ready / Polling ────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FBF9" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Order Summary Card ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionLabel}>ORDER SUMMARY</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Plan</Text>
            <Text style={styles.summaryVal}>{planLabel}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Type</Text>
            <Text style={styles.summaryVal}>{isPartner ? 'Annual' : 'Monthly'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Name</Text>
            <Text style={styles.summaryVal}>{userData?.fullName ?? '—'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Mobile</Text>
            <Text style={styles.summaryVal}>{userData?.mobile ?? '—'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
            <Text style={styles.totalAmount}>₱{amount.toLocaleString()}</Text>
          </View>
        </View>

        {/* ── QR Ph Payment Box ── */}
        <View style={styles.qrCard}>
          <View style={styles.qrHeader}>
            <Text style={styles.qrTitle}>Pay via QR Ph</Text>
            <View style={styles.poweredBadge}>
              <Text style={styles.poweredText}>Powered by PayMongo</Text>
            </View>
          </View>

          <Text style={styles.qrInstructions}>
            Tap the button below to open the secure QR Ph payment page.
            Scan the QR with GCash, Maya, or any QR Ph-enabled banking app.
          </Text>

          {/* QR Ph visual placeholder */}
          <View style={styles.qrBox}>
            <Text style={styles.qrIcon}>📱</Text>
            <Text style={styles.qrBoxText}>QR Ph Code</Text>
            <Text style={styles.qrBoxSub}>Opens in secure browser</Text>
          </View>

          {/* Expiry countdown */}
          {countdown > 0 ? (
            <Text style={styles.countdown}>
              QR expires in {formatTime(countdown)}
            </Text>
          ) : (
            <TouchableOpacity onPress={initPayment}>
              <Text style={[styles.countdown, { color: '#C62828' }]}>
                ⚠️ QR expired — tap to refresh
              </Text>
            </TouchableOpacity>
          )}

          {/* Open Checkout Button */}
          <TouchableOpacity
            onPress={openCheckout}
            activeOpacity={0.85}
            disabled={countdown === 0}
          >
            <LinearGradient
              colors={['#4CAF50', '#8BC34A', '#FBC02D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.openQrBtn, countdown === 0 && { opacity: 0.4 }]}
            >
              <Text style={styles.openQrText}>
                {step === 'polling' ? '⏳  Waiting for Payment…' : '🔗  Open QR Payment'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Polling indicator ── */}
        {step === 'polling' && (
          <View style={styles.pollingRow}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.pollingText}>
              Checking payment status automatically…
            </Text>
          </View>
        )}

        {/* ── OTP Gate notice ── */}
        <View style={styles.otpGateBox}>
          <Text style={styles.otpGateIcon}>🔒</Text>
          <Text style={styles.otpGateText}>
            Your OTP will be sent to +63{userData?.mobile?.replace(/^0/, '')} only after
            payment is confirmed. Do not share your OTP with anyone.
          </Text>
        </View>

        {/* Accepted payment methods */}
        <Text style={styles.acceptedLabel}>ACCEPTED VIA QR PH</Text>
        <View style={styles.wallets}>
          {['GCash', 'Maya', 'BPI', 'BDO', 'UnionBank', 'Metrobank'].map((w) => (
            <View key={w} style={styles.walletChip}>
              <Text style={styles.walletText}>{w}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FBF9' },

  // Center screens (loading/error/paid)
  centerScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: '#F9FBF9',
  },
  loadingText: { marginTop: 16, fontSize: 15, color: '#555', fontWeight: '500' },
  errorEmoji:  { fontSize: 48, marginBottom: 12 },
  errorTitle:  { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  errorMsg:    { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn:    { backgroundColor: '#2E7D32', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 32, marginBottom: 14 },
  retryText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  backLink:    { color: '#2E7D32', fontSize: 14, fontWeight: '600' },
  paidEmoji:   { fontSize: 64, marginBottom: 16 },
  paidTitle:   { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 8 },
  paidSub:     { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  backBtn:     { width: 60 },
  backBtnText: { fontSize: 14, color: '#2E7D32', fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111' },

  content: { padding: 20, paddingBottom: 48 },

  // Order summary
  summaryCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#EBEBEB', elevation: 2,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1.5, marginBottom: 14 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryKey:   { fontSize: 14, color: '#666' },
  summaryVal:   { fontSize: 14, fontWeight: '600', color: '#111', maxWidth: '55%', textAlign: 'right' },
  divider:      { height: 1, backgroundColor: '#EEE', marginVertical: 10 },
  totalLabel:   { fontSize: 13, fontWeight: '700', color: '#111' },
  totalAmount:  { fontSize: 22, fontWeight: '800', color: '#2E7D32' },

  // QR card
  qrCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#EBEBEB', elevation: 2,
  },
  qrHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  qrTitle:        { fontSize: 17, fontWeight: '700', color: '#111' },
  poweredBadge:   { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  poweredText:    { fontSize: 10, fontWeight: '600', color: '#2E7D32' },
  qrInstructions: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 16 },
  qrBox: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#E0E0E0', borderStyle: 'dashed',
    borderRadius: 16, paddingVertical: 28, marginBottom: 12,
  },
  qrIcon:    { fontSize: 40, marginBottom: 8 },
  qrBoxText: { fontSize: 16, fontWeight: '700', color: '#333' },
  qrBoxSub:  { fontSize: 12, color: '#999', marginTop: 4 },
  countdown: { textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 16 },
  openQrBtn: {
    height: 54, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  openQrText: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },

  // Polling
  pollingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginBottom: 16,
  },
  pollingText: { fontSize: 13, color: '#2E7D32', fontWeight: '600' },

  // OTP gate notice
  otpGateBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FFE082', marginBottom: 20,
  },
  otpGateIcon: { fontSize: 16, marginTop: 1 },
  otpGateText: { flex: 1, fontSize: 12, color: '#5D4037', lineHeight: 18 },

  // Wallets
  acceptedLabel: {
    fontSize: 10, fontWeight: '700', color: '#AAA',
    letterSpacing: 1.5, textAlign: 'center', marginBottom: 10,
  },
  wallets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  walletChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#FFF',
  },
  walletText: { fontSize: 12, fontWeight: '600', color: '#444' },
});
