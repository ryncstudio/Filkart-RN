import React, { useState } from 'react';
import { registerUser } from '../lib/supabase';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

const { width, height } = Dimensions.get('window');

export default function SignUpScreen({ onNext, onBack }) {
  const [fullName, setFullName]               = useState('');
  const [username, setUsername]               = useState('');
  const [mobile, setMobile]                   = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode]       = useState('');
  const [showPass, setShowPass]               = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  const handleNext = async () => {
    // Basic validation
    if (!fullName || !username || !mobile || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (mobile.length < 10) {
      setError('Please enter a valid mobile number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Register in Supabase Auth + public.users
      // plan details come from the next screen — pass placeholders for now
      const userId = await registerUser({
        fullName,
        username,
        mobile,
        email,
        password,
        planId:      null,
        planAmount:  null,
        referralCode: referralCode.trim() || null,
      });
      onNext({ userId, fullName, username, mobile, email });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1B4332', '#2d6a4f', '#6aaa3a', '#F0B800', '#F9C449']}
      locations={[0, 0.15, 0.42, 0.78, 1]}
      style={styles.root}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ── */}
          <View style={styles.logoArea}>
            <Image
              source={require('../../assets/filkart_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* ── White Card ── */}
          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join our ultimate local shopping experience
            </Text>

            {/* Error message */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#BBBBBB"
                autoCapitalize="words"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {/* Username */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#BBBBBB"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={(t) => setUsername(t.replace(/\s/g, '').toLowerCase())}
              />
            </View>

            {/* Mobile Number — input only, no OTP button */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Mobile Number"
                placeholderTextColor="#BBBBBB"
                keyboardType="phone-pad"
                maxLength={11}
                value={mobile}
                onChangeText={setMobile}
              />
            </View>

            {/* Email */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#BBBBBB"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, { paddingRight: 44 }]}
                placeholder="Password"
                placeholderTextColor="#BBBBBB"
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPass((v) => !v)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.eyeIcon}>{showPass ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, { paddingRight: 44 }]}
                placeholder="Confirm Password"
                placeholderTextColor="#BBBBBB"
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.eyeIcon}>{showConfirm ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>

            {/* Referral Code (optional) */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Referral Code e.g. FK7X3M9P (optional)"
                placeholderTextColor="#BBBBBB"
                autoCapitalize="characters"
                autoCorrect={false}
                value={referralCode}
                onChangeText={(t) => setReferralCode(t.trim().toUpperCase())}
              />
            </View>

            {/* Next Button */}
            <TouchableOpacity
              onPress={handleNext}
              activeOpacity={0.85}
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              <LinearGradient
                colors={['#4CAF50', '#8BC34A', '#FFC107']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextBtn}
              >
                <Text style={styles.nextBtnText}>
                  {loading ? 'Please wait…' : 'Next'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Log In footer */}
            <View style={styles.loginRow}>
              <Text style={styles.loginBase}>Already have an account? </Text>
              <TouchableOpacity onPress={onBack}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-end' },

  /* Logo */
  logoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    minHeight: height * 0.30,
  },
  logo: {
    width: width * 0.50,
    height: width * 0.50,
  },

  /* Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: Platform.OS === 'ios' ? 48 : 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },

  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: '#1A1A1A',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#757575',
    lineHeight: 22,
    marginBottom: 24,
  },

  /* Inputs */
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#1A1A1A',
    height: '100%',
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },
  eyeIcon: { fontSize: 18 },

  /* Next Button */
  nextBtn: {
    height: 56,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  nextBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  /* Log In footer */
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBase: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#757575',
  },
  loginLink: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#2E7D32',
  },
  errorBox: {
    backgroundColor: '#FFF3F3',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#C62828',
    lineHeight: 18,
  },
});
