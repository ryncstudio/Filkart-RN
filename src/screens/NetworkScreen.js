import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ActivityIndicator, Modal,
  TextInput, FlatList, TouchableWithoutFeedback, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getNetworkByLevel, getNetworkCountByLevel, getReferrer } from '../lib/supabase';

const { width } = Dimensions.get('window');
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

// ── Bottom tabs (mirrors Dashboard) ───────────────────────────────────
const TABS = [
  { id: 'home',    icon: '🏠', label: 'Home'    },
  { id: 'market',  icon: '🏪', label: 'Market'  },
  { id: 'wallet',  icon: '💳', label: 'Wallet'  },
  { id: 'network', icon: '👥', label: 'Network' },
  { id: 'profile', icon: '🪪', label: 'Profile' },
];

// ── Level definitions: exact Filkart Unilevel infographic palette ─────────────
const LEVELS = [
  { level: 1, label: 'Level 1', power: '10¹',  capacity: 10,     colors: ['#0D47A1', '#1E88E5'], light: '#E3F2FD', accent: '#1565C0', tag: 'BLUE'   },
  { level: 2, label: 'Level 2', power: '10²',  capacity: 100,    colors: ['#1B5E20', '#43A047'], light: '#E8F5E9', accent: '#2E7D32', tag: 'GREEN'  },
  { level: 3, label: 'Level 3', power: '10³',  capacity: 1000,   colors: ['#E65100', '#FFA726'], light: '#FFF3E0', accent: '#BF360C', tag: 'YELLOW' },
  { level: 4, label: 'Level 4', power: '10⁴',  capacity: 10000,  colors: ['#4A148C', '#9C27B0'], light: '#F3E5F5', accent: '#6A1B9A', tag: 'PURPLE' },
  { level: 5, label: 'Level 5', power: '10⁵',  capacity: 100000, colors: ['#B71C1C', '#EF5350'], light: '#FFEBEE', accent: '#C62828', tag: 'RED'    },
];

function fmtCapacity(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

// ── Searchable member modal ───────────────────────────────────────────────────
function MemberModal({ visible, levelCfg, members, loading, onClose }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return members;
    const q = query.toLowerCase();
    return members.filter((m) => {
      const name = m.users?.username || m.users?.full_name || '';
      return name.toLowerCase().includes(q);
    });
  }, [query, members]);

  if (!levelCfg) return null;
  const { colors, label, capacity, accent } = levelCfg;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={mS.backdrop} />
      </TouchableWithoutFeedback>

      <View style={mS.sheet}>
        {/* Sheet handle */}
        <View style={mS.handle} />

        {/* Header */}
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={mS.sheetHeader}>
          <View>
            <Text style={mS.sheetTitle}>{label} Members</Text>
            <Text style={mS.sheetSub}>
              {loading ? 'Loading...' : `${members.length} of ${fmtCapacity(capacity)} slots filled`}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={mS.closeBtn}>
            <Text style={mS.closeTxt}>✕</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Search */}
        <View style={mS.searchWrap}>
          <Text style={mS.searchIcon}>🔍</Text>
          <TextInput
            style={mS.searchInput}
            placeholder="Search username..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={mS.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Member list */}
        {loading ? (
          <ActivityIndicator color={accent} style={{ padding: 40 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item, i) => item.referred_id ?? String(i)}
            contentContainerStyle={mS.listContent}
            ListEmptyComponent={
              <View style={mS.empty}>
                <Text style={mS.emptyIcon}>🔍</Text>
                <Text style={mS.emptyText}>
                  {query ? 'No matching members' : 'No members yet'}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const username = item.users?.username
                ? `@${item.users.username}`
                : item.users?.full_name
                ? item.users.full_name.split(' ')[0]
                : `Member #${index + 1}`;
              const legNum = item.position ?? index + 1;
              return (
                <View style={mS.memberRow}>
                  <LinearGradient colors={colors} style={mS.memberAvatar}>
                    <Text style={mS.memberInitial}>{legNum}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={mS.memberName}>Leg {legNum} · {username}</Text>
                    <Text style={mS.memberPos}>{label} · Leg {legNum}</Text>
                  </View>
                  <View style={[mS.activeTag, { backgroundColor: levelCfg.light }]}>
                    <Text style={[mS.activeTagText, { color: accent }]}>ACTIVE</Text>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function NetworkScreen({ userData, onBack, onMarket, onWallet, onProfile }) {
  const [counts,        setCounts]        = useState({});  // level → count
  const [countsLoading, setCountsLoading] = useState(true);
  const [referrer,      setReferrer]      = useState(null);

  // Modal state
  const [modalLevel,   setModalLevel]   = useState(null);
  const [modalMembers, setModalMembers] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Load referrer + all 5 level counts on mount
  useEffect(() => {
    (async () => {
      try {
        const [ref, ...countArr] = await Promise.all([
          getReferrer(userData?.userId),
          ...LEVELS.map((l) => getNetworkCountByLevel(userData?.userId, l.level)),
        ]);
        setReferrer(ref);
        const cMap = {};
        LEVELS.forEach((l, i) => { cMap[l.level] = countArr[i]; });
        setCounts(cMap);
      } catch (_) {}
      setCountsLoading(false);
    })();
  }, [userData?.userId]);

  const openModal = async (levelCfg) => {
    setModalLevel(levelCfg);
    setModalMembers([]);
    setModalLoading(true);
    try {
      const data = await getNetworkByLevel(userData?.userId, levelCfg.level);
      setModalMembers(data || []);
    } catch (_) {
      setModalMembers([]);
    } finally {
      setModalLoading(false);
    }
  };

  const referrerName =
    referrer?.users?.username
      ? `@${referrer.users.username}`
      : referrer?.users?.full_name
      ? referrer.users.full_name.split(' ')[0]
      : null;

  // Root account = no referrer (Filkart owner). Non-root = Level 1 members.
  // Non-root users should NOT see Level 1 because their referrals first fill
  // the overall Level 1 (Filkart root's direct legs) via the spill system.
  // Their own downline starts at Level 2.
  const isRootAccount = !referrerName;
  const visibleLevels = isRootAccount ? LEVELS : LEVELS.filter(l => l.level !== 1);

  const totalMembers = Object.values(counts).reduce((s, c) => s + (c || 0), 0);

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Member modal */}
      <MemberModal
        visible={!!modalLevel}
        levelCfg={modalLevel}
        members={modalMembers}
        loading={modalLoading}
        onClose={() => setModalLevel(null)}
      />

      {/* ── Header (white) ── */}
      <View style={styles.header}>
        <View style={{ height: STATUS_H }} />
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: '#111827' }]}>My Network</Text>
            <Text style={[styles.headerSub, { color: '#6B7280' }]}>Filkart Unilevel · Power of 10</Text>
          </View>
          <View style={[styles.networkBadge, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.networkBadgeText, { color: '#1B5E20' }]}>👥 {totalMembers} Members</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}>

        {/* ── Topmost account / referrer ── */}
        <View style={styles.referrerCard}>
          <Text style={styles.referrerLabel}>TOPMOST ACCOUNT</Text>
          <View style={styles.referrerRow}>
            <LinearGradient colors={['#1B4332', '#2E7D32']} style={styles.referrerAvatar}>
              <Text style={styles.referrerAvatarText}>
                {referrerName ? referrerName.replace('@','')[0].toUpperCase() : 'R'}
              </Text>
            </LinearGradient>
            <View>
              <Text style={styles.referrerName}>{referrerName ?? 'Filkart Root'}</Text>
              <Text style={styles.referrerSub}>
                {referrerName ? 'Your sponsor' : 'You are a root account'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Network info note ── */}
        <View style={styles.spillBanner}>
          <Text style={styles.spillIcon}>ℹ️</Text>
          <Text style={styles.spillText}>
            {isRootAccount
              ? <>Your network grows as your referrals join. Each level holds <Text style={styles.spillBold}>10×</Text> the previous capacity. Tap any level to view members.</>
              : <>Referrals you share are placed in the overall network first (Level 1 fills left to right). Your personal downline starts at <Text style={styles.spillBold}>Level 2</Text>. Tap any level to view members.</>
            }
          </Text>
        </View>

        {/* ── Level cards (root sees all 5, non-root sees 2–5) ── */}
        <Text style={styles.sectionLabel}>UNILEVEL EXPLORER</Text>

        {visibleLevels.map((lvl) => {
          const count    = counts[lvl.level] ?? 0;
          const progress = Math.min(count / lvl.capacity, 1);
          const pct      = (progress * 100).toFixed(1);

          return (
            <TouchableOpacity
              key={lvl.level}
              activeOpacity={0.82}
              onPress={() => openModal(lvl)}
              style={styles.levelCard}
            >
              {/* Left color stripe (flat) */}
              <View
                style={[styles.levelStripe, { backgroundColor: lvl.colors[0] }]}
              >
                <Text style={styles.stripeNum}>{lvl.level}</Text>
                <Text style={styles.stripePow}>{lvl.power}</Text>
              </View>

              {/* Card body */}
              <View style={styles.levelBody}>
                <View style={styles.levelTopRow}>
                  <View>
                    <Text style={styles.levelTitle}>{lvl.label}</Text>
                    <View style={[styles.levelTagBadge, { backgroundColor: lvl.light }]}>
                      <Text style={[styles.levelTagText, { color: lvl.accent }]}>{lvl.tag}</Text>
                    </View>
                  </View>
                  <View style={styles.levelCountWrap}>
                    <Text style={[styles.levelCount, { color: lvl.accent }]}>
                      {countsLoading ? '—' : count.toLocaleString()}
                    </Text>
                    <Text style={styles.levelCapacity}>/ {fmtCapacity(lvl.capacity)}</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progTrack}>
                  <View
                    style={[styles.progFill, { width: `${Math.max(progress * 100, 2)}%`, backgroundColor: lvl.accent }]}
                  />
                </View>
                <Text style={styles.progLabel}>
                  {countsLoading ? 'Loading...' : `${pct}% filled · Tap to view members`}
                </Text>
              </View>

              {/* Chevron */}
              <Text style={[styles.chevron, { color: lvl.accent }]}>›</Text>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Bottom tab bar (Network active) ── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = tab.id === 'network';
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => {
                if (tab.id === 'market')  { onMarket?.();  return; }
                if (tab.id === 'wallet')  { onWallet?.();  return; }
                if (tab.id === 'profile') { onProfile?.(); return; }
                if (tab.id === 'home')    { onBack?.();    return; }
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Modal styles ──────────────────────────────────────────────────────────────
const mS = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 }, elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  sheetSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 14, color: '#fff', fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchIcon:  { fontSize: 15, marginRight: 8, color: '#9CA3AF' },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: '#111' },
  clearBtn:    { fontSize: 13, color: '#9CA3AF', padding: 4 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  memberAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  memberInitial: { fontSize: 17, fontWeight: '800', color: '#fff' },
  memberName:    { fontSize: 14, fontWeight: '700', color: '#111827' },
  memberPos:     { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  activeTag: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  activeTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },

  /* Header */
  header: { paddingBottom: 14, paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  backArrow: { fontSize: 16, color: '#fff', fontWeight: '700' },
  backText:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  networkBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
  },
  networkBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 2, letterSpacing: -0.5 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  scroll: { padding: 16 },

  /* Referrer card */
  referrerCard: {
    backgroundColor: '#fff',
    borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#EBEBEB',
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  referrerLabel: {
    fontSize: 10, fontWeight: '700', color: '#AAA',
    letterSpacing: 1.5, marginBottom: 12,
  },
  referrerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  referrerAvatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  referrerAvatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  referrerName: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 2 },
  referrerSub:  { fontSize: 12, color: '#999' },

  /* Spill banner */
  spillBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 14, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#DBEAFE', gap: 10,
  },
  spillIcon: { fontSize: 18 },
  spillText: { flex: 1, fontSize: 13, color: '#3B82F6', lineHeight: 19 },
  spillBold: { fontWeight: '700' },

  /* Section label */
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#AAA',
    letterSpacing: 1.5, marginBottom: 12,
  },

  /* Level card */
  levelCard: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  levelStripe: {
    width: 62,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20,
  },
  stripeNum: { fontSize: 24, fontWeight: '900', color: '#fff' },
  stripePow: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: '600' },

  levelBody: { flex: 1, padding: 16 },
  levelTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  levelTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 6 },
  levelTagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20,
  },
  levelTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  levelCountWrap: { alignItems: 'flex-end' },
  levelCount:     { fontSize: 22, fontWeight: '900' },
  levelCapacity:  { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 1 },

  /* Progress bar */
  progTrack: {
    height: 7, backgroundColor: '#F0F0F0',
    borderRadius: 4, overflow: 'hidden', marginBottom: 8,
  },
  progFill: { height: '100%', borderRadius: 4, minWidth: 8 },
  progLabel: { fontSize: 11, color: '#9CA3AF' },

  chevron: { fontSize: 28, fontWeight: '300', alignSelf: 'center', paddingRight: 14 },

  /* Bottom tab bar */
  tabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingBottom: 20, paddingTop: 10,
    elevation: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 },
  },
  tabItem:        { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon:        { fontSize: 20, color: '#9CA3AF' },
  tabIconActive:  { color: '#16A34A' },
  tabLabel:       { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  tabLabelActive: { color: '#16A34A', fontWeight: '700' },
});
