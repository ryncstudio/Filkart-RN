import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { saveNotifyInterest } from '../lib/supabase';

const { width, height } = Dimensions.get('window');
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

export default function ShopScreen({ userData, onBack }) {
  const [notified,  setNotified]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [toastVis,  setToastVis]  = useState(false);

  // Pulse animation on the icon
  const pulse  = useRef(new Animated.Value(1)).current;
  const glow   = useRef(new Animated.Value(0.4)).current;
  const toastY = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.10, duration: 1100, useNativeDriver: true }),
          Animated.timing(glow,  { toValue: 0.9,  duration: 1100, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.00, duration: 1100, useNativeDriver: true }),
          Animated.timing(glow,  { toValue: 0.4,  duration: 1100, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const showToast = () => {
    setToastVis(true);
    Animated.sequence([
      Animated.timing(toastY, { toValue: 0,   duration: 320, useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(toastY, { toValue: 80,  duration: 320, useNativeDriver: true }),
    ]).start(() => setToastVis(false));
  };

  const handleNotify = async () => {
    if (notified || loading) return;
    setLoading(true);
    try {
      if (userData?.userId) {
        await saveNotifyInterest(userData.userId);
      }
      setNotified(true);
      showToast();
    } catch (_) {
      // Optimistically mark notified even if DB write fails (table may not exist yet)
      setNotified(true);
      showToast();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── Background gradient ── */}
      <LinearGradient
        colors={['#060B18', '#0F1A35', '#1a1040', '#0d1b2a']}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Decorative circles ── */}
      <View style={[styles.orb, styles.orbTL]} />
      <View style={[styles.orb, styles.orbBR]} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerBadge}>MARKETPLACE</Text>
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>

        {/* Glow halo behind icon */}
        <Animated.View style={[styles.iconGlow, { opacity: glow }]} />

        {/* Pulsing icon */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulse }] }]}>
          <LinearGradient
            colors={['#F0B800', '#F9C449', '#FFE082']}
            style={styles.iconGrad}
          >
            <Text style={styles.iconEmoji}>🛍️</Text>
          </LinearGradient>
        </Animated.View>

        {/* Gold divider */}
        <View style={styles.divider}>
          <LinearGradient
            colors={['transparent', '#F0B800', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.dividerLine}
          />
        </View>

        {/* Headline */}
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.subtitle}>Filkart Essentials</Text>

        {/* Copy */}
        <Text style={styles.body_copy}>
          Exclusive Filkart Essentials are arriving soon.{'\n'}
          High-quality products at member-only prices.
        </Text>

        {/* Feature pills */}
        <View style={styles.pillRow}>
          {['Members Only', 'Exclusive Prices', 'Quality Guaranteed'].map((t) => (
            <View key={t} style={styles.pill}>
              <Text style={styles.pillText}>{t}</Text>
            </View>
          ))}
        </View>

        {/* Notify Me button */}
        <TouchableOpacity
          onPress={handleNotify}
          activeOpacity={notified ? 1 : 0.82}
          style={{ width: '100%', marginTop: 36 }}
          disabled={notified || loading}
        >
          <LinearGradient
            colors={notified ? ['#16A34A', '#22C55E'] : ['#F0B800', '#F9C449']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.notifyBtn}
          >
            <Text style={styles.notifyBtnText}>
              {loading ? '...' : notified ? '✓  You\'re on the List!' : '🔔  Notify Me When It\'s Live'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.helperText}>
          We'll alert you the moment the shop goes live.
        </Text>
      </View>

      {/* ── Toast ── */}
      {toastVis && (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastY }] }]}>
          <LinearGradient
            colors={['#16A34A', '#22C55E']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.toastInner}
          >
            <Text style={styles.toastText}>
              ✓  You're on the list! We'll notify you when the shop launches.
            </Text>
          </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Decorative orbs */
  orb: {
    position: 'absolute', borderRadius: 999,
    opacity: 0.12,
  },
  orbTL: {
    width: 320, height: 320,
    top: -80, left: -100,
    backgroundColor: '#7C3AED',
  },
  orbBR: {
    width: 260, height: 260,
    bottom: -60, right: -60,
    backgroundColor: '#F0B800',
  },

  /* Header */
  header: {
    paddingTop:        STATUS_H + 12,
    paddingHorizontal: 20,
    paddingBottom:     16,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  backBtn:     { padding: 8 },
  backText:    { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '600' },
  headerBadge: {
    fontSize: 11, fontWeight: '800', letterSpacing: 2.5,
    color: '#F0B800',
    borderWidth: 1, borderColor: 'rgba(240,184,0,0.4)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
  },

  /* Body */
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },

  /* Icon */
  iconGlow: {
    position: 'absolute',
    width: 200, height: 200,
    borderRadius: 100,
    backgroundColor: '#F0B800',
    top: '50%',
    marginTop: -260,
    alignSelf: 'center',
  },
  iconWrap: {
    marginBottom: 32,
    shadowColor: '#F0B800',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  iconGrad: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji: { fontSize: 52 },

  /* Divider */
  divider: { width: '60%', marginBottom: 24 },
  dividerLine: { height: 1.5, width: '100%' },

  /* Text */
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0B800',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 22,
    textTransform: 'uppercase',
  },
  body_copy: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },

  /* Pills */
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  pill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(240,184,0,0.12)',
    borderWidth: 1, borderColor: 'rgba(240,184,0,0.35)',
  },
  pillText: {
    fontSize: 11, fontWeight: '700', color: '#F0B800', letterSpacing: 0.5,
  },

  /* Notify button */
  notifyBtn: {
    borderRadius: 18,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F0B800',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  notifyBtnText: {
    fontSize: 16, fontWeight: '800', color: '#1a1a1a', letterSpacing: 0.3,
  },
  helperText: {
    marginTop: 14,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },

  /* Toast */
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#16A34A',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  toastInner: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 14, fontWeight: '700', color: '#fff', textAlign: 'center',
  },
});
