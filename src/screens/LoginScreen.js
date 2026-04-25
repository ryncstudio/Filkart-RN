import React, { useState, useEffect, useRef } from 'react';
import { signIn } from '../lib/supabase';
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
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ onLogin, onSignUp, successMessage = '', onSuccessMessageSeen }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const bannerAnim                  = useRef(new Animated.Value(0)).current;
  const timerRef                    = useRef(null);

  // ── Animate-in banner and start 5s auto-dismiss ───────────────────────────
  useEffect(() => {
    if (!successMessage) {
      Animated.timing(bannerAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      return;
    }
    // Slide + fade in
    Animated.timing(bannerAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    // Auto-dismiss after 5 seconds
    timerRef.current = setTimeout(() => {
      Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        onSuccessMessageSeen?.();
      });
    }, 5000);
    return () => clearTimeout(timerRef.current);
  }, [successMessage]);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  const handleLogin = async () => {
    if (!identifier || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    // Dismiss success banner as soon as user taps Log In
    if (successMessage) {
      clearTimeout(timerRef.current);
      onSuccessMessageSeen?.();
    }
    try {
      const result = await signIn(identifier, password);
      onLogin(result?.user?.id ?? null);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    // ── Full-screen gradient is the ROOT so nothing leaks behind the card ──
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
          {/* ── Logo area (transparent — gradient shows through) ── */}
          <View style={styles.logoArea}>
            <Image
              source={require('../../assets/filkart_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* ── White card ── */}
          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Log in to your ultimate local shopping experience
            </Text>

            {/* ── OTP Success Banner ── */}
            {!!successMessage && (
              <Animated.View
                style={[
                  styles.successBox,
                  {
                    opacity: bannerAnim,
                    transform: [{
                      translateY: bannerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-12, 0],
                      }),
                    }],
                  },
                ]}
              >
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.successText}>{successMessage}</Text>
              </Animated.View>
            )}

            {/* Error message */}
            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            )}

            {/* Mobile / Email */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Mobile Number or Email"
                placeholderTextColor="#BBBBBB"
                keyboardType="email-address"
                autoCapitalize="none"
                value={identifier}
                onChangeText={setIdentifier}
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
                <Text style={styles.eyeIcon}>{showPass ? '◉' : '—'}</Text>
              </TouchableOpacity>
            </View>

            {/* Forgot password */}
            <TouchableOpacity style={styles.forgotWrap}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Log In button */}
            <TouchableOpacity
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              <LinearGradient
                colors={['#4CAF50', '#8BC34A', '#FFC107']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginBtn}
              >
                <Text style={styles.loginBtnText}>
                  {loading ? 'Logging in…' : 'Log In'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Sign Up row */}
            <View style={styles.signUpRow}>
              <Text style={styles.signUpBase}>Don't have an account? </Text>
              <TouchableOpacity onPress={onSignUp}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Full-screen gradient root
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end', // card sits at bottom, logo floats above
  },

  // Logo section — transparent, gradient shows through
  logoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    flex: 1,
    minHeight: height * 0.38,
  },
  logo: {
    width: width * 0.54,
    height: width * 0.54,
  },

  // White card
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: Platform.OS === 'ios' ? 48 : 36,
    // Shadow under card top edge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },

  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: '#1A1A1A',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#757575',
    lineHeight: 22,
    marginBottom: 28,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    marginBottom: 16,
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
  eyeIcon: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '700',
  },

  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 28,
  },
  forgotText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#2E7D32',
  },

  loginBtn: {
    height: 56,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  loginBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpBase: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#757575',
  },
  signUpLink: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#2E7D32',
  },
  successBox: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: '#E8F5E9',
    borderWidth:     1,
    borderColor:     '#A5D6A7',
    borderRadius:    12,
    padding:         14,
    marginBottom:    16,
    gap:             10,
  },
  successIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  successText: {
    flex:            1,
    fontFamily:      'Inter_400Regular',
    fontSize:        13,
    color:           '#1B5E20',
    lineHeight:      20,
  },
  errorBox: {
    backgroundColor: '#FFF3F3',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#C62828',
    lineHeight: 18,
  },
});
