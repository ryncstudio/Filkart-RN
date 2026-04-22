import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getNetworkByLevel, getReferrer } from '../lib/supabase';

const { width } = Dimensions.get('window');
const SLOTS_PER_LEVEL = 10;

const LEVEL_COLORS = [
  ['#1B4332', '#2E7D32'],  // Level 1 — deep green
  ['#1565C0', '#1976D2'],  // Level 2 — blue
  ['#6A1B9A', '#8E24AA'],  // Level 3 — purple
  ['#E65100', '#F57C00'],  // Level 4 — orange
  ['#B71C1C', '#E53935'],  // Level 5 — red
];

export default function NetworkScreen({ userData, onBack }) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [levelData,     setLevelData]     = useState({});  // level → array of referrals
  const [loading,       setLoading]       = useState(false);
  const [referrer,      setReferrer]      = useState(null);

  useEffect(() => {
    loadReferrer();
  }, []);

  const loadReferrer = async () => {
    try {
      const r = await getReferrer(userData?.userId);
      setReferrer(r);
    } catch (_) {}
  };

  const handleLevelPress = async (level) => {
    if (selectedLevel === level) {
      setSelectedLevel(null); // collapse
      return;
    }
    setSelectedLevel(level);
    if (levelData[level]) return; // already loaded

    setLoading(true);
    try {
      const data = await getNetworkByLevel(userData?.userId, level);
      setLevelData((prev) => ({ ...prev, [level]: data }));
    } catch (_) {
      setLevelData((prev) => ({ ...prev, [level]: [] }));
    } finally {
      setLoading(false);
    }
  };

  // Build 10 slots for a level — filled + empty
  const buildSlots = (level) => {
    const filled = levelData[level] || [];
    const slots  = [];
    for (let i = 1; i <= SLOTS_PER_LEVEL; i++) {
      const match = filled.find((r) => r.position === i);
      slots.push({ position: i, user: match?.users ?? null });
    }
    return slots;
  };

  const referrerName =
    referrer?.users?.username
      ? `@${referrer.users.username}`
      : referrer?.users?.full_name
      ? referrer.users.full_name.split(' ')[0]
      : null;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── Header ── */}
      <LinearGradient colors={['#1B4332', '#2d6a4f']} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Network</Text>
        <Text style={styles.headerSub}>Power of 10 Hierarchy</Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Topmost Account ── */}
        <View style={styles.topmostCard}>
          <Text style={styles.topmostLabel}>TOPMOST ACCOUNT</Text>
          <View style={styles.topmostRow}>
            <View style={styles.topmostAvatar}>
              <Text style={styles.topmostAvatarText}>
                {referrerName ? referrerName[referrerName.startsWith('@') ? 1 : 0].toUpperCase() : '?'}
              </Text>
            </View>
            <View>
              <Text style={styles.topmostName}>
                {referrerName ?? 'No Referrer'}
              </Text>
              <Text style={styles.topmostSub}>
                {referrerName ? 'Your sponsor' : 'You are a root account'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Level Icons ── */}
        <Text style={styles.sectionLabel}>SELECT A LEVEL TO EXPAND</Text>

        {[1, 2, 3, 4, 5].map((level) => {
          const isOpen   = selectedLevel === level;
          const colors   = LEVEL_COLORS[level - 1];
          const slots    = buildSlots(level);
          const filled   = (levelData[level] || []).length;

          return (
            <View key={level} style={styles.levelBlock}>
              {/* Level button */}
              <TouchableOpacity
                onPress={() => handleLevelPress(level)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isOpen ? colors : ['#F0F0F0', '#E8E8E8']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.levelBtn}
                >
                  {/* Icon circle */}
                  <View style={[
                    styles.levelCircle,
                    { backgroundColor: isOpen ? 'rgba(255,255,255,0.25)' : colors[0] },
                  ]}>
                    <Text style={styles.levelNum}>{level}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.levelTitle, { color: isOpen ? '#fff' : '#111' }]}>
                      Level {level}
                    </Text>
                    <Text style={[styles.levelCount, { color: isOpen ? 'rgba(255,255,255,0.75)' : '#888' }]}>
                      {levelData[level] !== undefined
                        ? `${filled} / ${SLOTS_PER_LEVEL} affiliates`
                        : 'Tap to expand'}
                    </Text>
                  </View>

                  {/* Chevron */}
                  <Text style={{ fontSize: 20, color: isOpen ? '#fff' : '#bbb' }}>
                    {isOpen ? '▲' : '▼'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Expanded slots */}
              {isOpen && (
                <View style={styles.slotsWrap}>
                  {loading && !levelData[level] ? (
                    <ActivityIndicator color={colors[0]} style={{ padding: 20 }} />
                  ) : (
                    <>
                      {/* 10-slot grid */}
                      <View style={styles.slotsGrid}>
                        {slots.map((slot) => (
                          <View key={slot.position} style={styles.slotItem}>
                            <LinearGradient
                              colors={slot.user ? colors : ['#E0E0E0', '#EBEBEB']}
                              style={styles.slotCircle}
                            >
                              <Text style={styles.slotPos}>{slot.position}</Text>
                            </LinearGradient>
                            <Text
                              style={[
                                styles.slotName,
                                !slot.user && styles.slotEmpty,
                              ]}
                              numberOfLines={1}
                            >
                              {slot.user
                                ? slot.user.username
                                  ? `@${slot.user.username}`
                                  : '●●●●●' // Hide full name — show username only
                                : 'Empty'}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Auto-spill note */}
                      <View style={styles.spillNote}>
                        <Text style={styles.spillText}>
                          🔄  Auto-spill fills Left → Right. Overflow goes to Level {Math.min(level + 1, 5)}.
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7F5' },

  /* Header */
  header: {
    paddingTop:        56,
    paddingBottom:     28,
    paddingHorizontal: 20,
  },
  backBtn:     { marginBottom: 8 },
  backText:    { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.70)' },

  scrollContent: { padding: 20 },

  /* Topmost card */
  topmostCard: {
    backgroundColor:  '#fff',
    borderRadius:     16,
    padding:          20,
    marginBottom:     20,
    borderWidth:      1,
    borderColor:      '#EBEBEB',
    elevation:        2,
    shadowColor:      '#000',
    shadowOpacity:    0.05,
    shadowRadius:     4,
    shadowOffset:     { width: 0, height: 2 },
  },
  topmostLabel:  { fontSize: 10, fontWeight: '700', color: '#AAA', letterSpacing: 1.5, marginBottom: 12 },
  topmostRow:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topmostAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#A5D6A7',
  },
  topmostAvatarText: { fontSize: 22, fontWeight: '700', color: '#2E7D32' },
  topmostName:       { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 2 },
  topmostSub:        { fontSize: 12, color: '#999' },

  /* Section label */
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#AAA',
    letterSpacing: 1.5, marginBottom: 12,
  },

  /* Level blocks */
  levelBlock:   { marginBottom: 10 },
  levelBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 16, gap: 14,
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  levelCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  levelNum:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  levelTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  levelCount: { fontSize: 12 },

  /* Slots */
  slotsWrap: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#EBEBEB',
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    paddingTop: 16, paddingHorizontal: 12,
    marginTop: -6,
  },
  slotsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  slotItem: {
    width: (width - 80) / 5,
    alignItems: 'center',
    marginBottom: 16,
  },
  slotCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 5,
  },
  slotPos:   { fontSize: 13, fontWeight: '700', color: '#fff' },
  slotName:  { fontSize: 9, fontWeight: '600', color: '#333', textAlign: 'center', maxWidth: 52 },
  slotEmpty: { color: '#BBB', fontStyle: 'italic' },

  /* Spill note */
  spillNote: {
    backgroundColor: '#F9FBF9',
    borderTopWidth: 1, borderTopColor: '#EEE',
    padding: 12, marginTop: 4,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
  },
  spillText: { fontSize: 11, color: '#888', textAlign: 'center' },
});
