import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Animated, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { verifyOTP, sendOTP } from '../lib/supabase';

const { width } = Dimensions.get('window');
const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const PAID_GATE_MSG =
  'Activation requires a ₱880 or ₱1,500 payment. ' +
  'Please complete your subscription to receive your code.';

function maskMobile(mobile = '') {
  // +63XXXXXXXXXX → +63•••••1234
  const digits = mobile.replace(/^\+63/, '');
  if (digits.length < 4) return mobile;
  return `+63 ••••• ${digits.slice(-4)}`;
}

export default function OTPScreen({ userData, onSuccess, onBack }) {
  const [digits, setDigits]         = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading]       = useState(false);
  const [resending, setResending]   = useState(false);
  const [countdown, setCountdown]   = useState(RESEND_SECONDS);
  const [error, setError]           = useState('');
  const [successAnim]               = useState(new Animated.Value(0));
  const inputRefs = useRef([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });

  // ── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Shake animation on error ─────────────────────────────────────────────
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 40,  useNativeDriver: true }),
    ]).start();
  };

  // ── Handle digit input ───────────────────────────────────────────────────
  const handleChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = ({ nativeEvent }, index) => {
    if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await sendOTP(userData.userId);
      setCountdown(RESEND_SECONDS);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      const msg = err.message ?? '';
      if (msg.includes('₱880') || msg.includes('payment')) {
        setError(PAID_GATE_MSG);
      } else {
        setError('Could not resend. Try again.');
      }
    } finally {
      setResending(false);
    }
  };

  // ── Verify OTP ───────────────────────────────────────────────────────────
  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      setError('Please enter all 6 digits.');
      shake();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await verifyOTP(userData.userId, code);
      if (result?.success) {
        // Success animation then navigate
        Animated.timing(successAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
          setTimeout(onSuccess, 600);
        });
      } else {
        setError('Verification failed. Please try again.');
        shake();
      }
    } catch (err) {
      const msg = err.message ?? '';
      if (msg.includes('₱880') || msg.includes('payment')) {
        setError(PAID_GATE_MSG);
      } else if (msg.includes('Invalid') || msg.includes('expired')) {
        setError('Invalid or expired code. Please try again.');
        shake();
      } else {
        setError(msg || 'Verification failed.');
        shake();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return null;

  const code      = digits.join('');
  const isFilled  = code.length === OTP_LENGTH;
  const mobile    = maskMobile(userData?.mobile ?? '');

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── Header gradient ── */}
      <LinearGradient
        colors={['#1B4332', '#2d6a4f', '#52B788']}
        locations={[0, 0.5, 1]}
        style={styles.headerGrad}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>📱</Text>
        </View>
        <Text style={styles.headerTitle}>Activation Code</Text>
        <Text style={styles.headerSub}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.mobileText}>{mobile}</Text>
        </Text>
      </LinearGradient>

      {/* ── Body ── */}
      <View style={styles.body}>

        {/* ── OTP Boxes ── */}
        <Animated.View style={[styles.boxRow, { transform: [{ translateX: shakeAnim }] }]}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={r => (inputRefs.current[i] = r)}
              style={[styles.otpBox, d ? styles.otpBoxFilled : null, error ? styles.otpBoxError : null]}
              value={d}
              onChangeText={t => handleChange(t, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              returnKeyType="done"
            />
          ))}
        </Animated.View>

        {/* ── Error / Gate message ── */}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Verify Button ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleVerify}
          disabled={loading || !isFilled}
          style={{ marginTop: 28 }}
        >
          <LinearGradient
            colors={isFilled ? ['#1B4332', '#2E7D32'] : ['#ccc', '#bbb']}
            style={styles.verifyBtn}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.verifyBtnText}>✓  Activate Account</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Resend ── */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendTimer}>
              Resend code in <Text style={styles.resendBold}>0:{String(countdown).padStart(2, '0')}</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              <Text style={styles.resendLink}>
                {resending ? 'Sending…' : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Back ── */}
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FBF9' },

  /* Header */
  headerGrad: {
    paddingTop:    64,
    paddingBottom: 48,
    alignItems:    'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  iconText:     { fontSize: 36 },
  headerTitle:  { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#fff', marginBottom: 8 },
  headerSub:    { fontFamily: 'Inter_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22 },
  mobileText:   { fontFamily: 'Inter_700Bold', color: '#B7E4C7' },

  /* Body */
  body: { flex: 1, paddingHorizontal: 28, paddingTop: 40 },

  /* OTP Boxes */
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  otpBox: {
    width:  (width - 56 - 40) / 6,
    height: (width - 56 - 40) / 6,
    borderRadius:    12,
    borderWidth:     2,
    borderColor:     '#D9E8D9',
    backgroundColor: '#fff',
    textAlign:       'center',
    fontSize:        22,
    fontFamily:      'Inter_700Bold',
    color:           '#1B4332',
    elevation:       2,
    shadowColor:     '#1B4332',
    shadowOpacity:   0.08,
    shadowRadius:    4,
    shadowOffset:    { width: 0, height: 2 },
  },
  otpBoxFilled: { borderColor: '#2E7D32', backgroundColor: '#F0FFF4' },
  otpBoxError:  { borderColor: '#E53E3E' },

  /* Error */
  errorBox: {
    backgroundColor: '#FFF5F5',
    borderRadius:    10,
    padding:         14,
    marginTop:       16,
    borderLeftWidth: 4,
    borderLeftColor: '#E53E3E',
  },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#C53030', lineHeight: 20 },

  /* Verify Button */
  verifyBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1B4332',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  verifyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff', letterSpacing: 0.5 },

  /* Resend */
  resendRow:   { alignItems: 'center', marginTop: 20 },
  resendTimer: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#888' },
  resendBold:  { fontFamily: 'Inter_700Bold', color: '#1B4332' },
  resendLink:  { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#2E7D32', textDecorationLine: 'underline' },

  /* Back */
  backBtn:  { alignItems: 'center', marginTop: 24 },
  backText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#999' },
});
