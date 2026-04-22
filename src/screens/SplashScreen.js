import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const logoScale    = useRef(new Animated.Value(0.75)).current;
  const lineWidth    = useRef(new Animated.Value(0)).current;
  const textOpacity  = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const spinnerRot   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Spin the loader forever
    Animated.loop(
      Animated.timing(spinnerRot, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();

    // 2. Sequenced entrance animations
    Animated.sequence([
      // Logo pops in
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 45,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
      // Divider draws in
      Animated.timing(lineWidth, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      // Tagline + spinner + footer fade in
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(footerOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const spin = spinnerRot.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      // Matches the uploaded design: deep green top → bright yellow bottom
      colors={['#2a6e1f', '#3a8a28', '#6db830', '#d4b800', '#f0c800']}
      locations={[0, 0.18, 0.42, 0.72, 1]}
      style={styles.container}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* ── LOGO ── */}
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Image
          source={require('../../assets/filkart_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── DIVIDER ── */}
      <Animated.View
        style={[styles.lineWrap, { transform: [{ scaleX: lineWidth }] }]}
      >
        <View style={styles.line} />
      </Animated.View>

      {/* ── TAGLINE ── */}
      <Animated.Text style={[styles.tagline, { opacity: textOpacity }]}>
        Shop Local. Earn{'\n'}Together.
      </Animated.Text>

      {/* ── SPINNER ── */}
      <Animated.View
        style={[
          styles.spinner,
          { opacity: textOpacity, transform: [{ rotate: spin }] },
        ]}
      />

      {/* ── CONNECTING COMMUNITIES ── */}
      <Animated.Text style={[styles.connecting, { opacity: textOpacity }]}>
        CONNECTING COMMUNITIES
      </Animated.Text>

      {/* ── PHILIPPINES FIRST footer ── */}
      <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
        <Text style={styles.footerPin}>📍</Text>
        <Text style={styles.footerText}> PHILIPPINES FIRST</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Logo */
  logoWrap: {
    marginBottom: 22,
    // subtle glow shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 18,
  },
  logo: {
    width: width * 0.68,
    height: width * 0.68,
  },

  /* Divider */
  lineWrap: {
    width: width * 0.38,
    marginBottom: 16,
  },
  line: {
    height: 3,
    backgroundColor: '#1a5218',
    borderRadius: 3,
  },

  /* Tagline */
  tagline: {
    fontSize: 27,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 52,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  /* Spinner */
  spinner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.22)',
    borderTopColor: 'rgba(255,255,255,0.92)',
    marginBottom: 14,
  },

  /* Connecting Communities */
  connecting: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.80)',
    letterSpacing: 5,
    textAlign: 'center',
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerPin: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 3.5,
  },
});
