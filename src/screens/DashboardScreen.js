import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ActivityIndicator, FlatList,
  Image, Platform, Modal, TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentUserProfile, getWallet, getTransactions, supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');
const CARD_W   = width - 32;
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

// ── Time-based greeting ────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ── Carousel slides ────────────────────────────────────────────────────────────
const SLIDES = [
  { id: '1', tag: 'SEASONAL SELECTION', title: 'Fresh Harvest\nDirect to You',  image: { uri: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800' } },
  { id: '2', tag: 'EXCLUSIVE OFFER',    title: 'Top Properties\nNear You',       image: { uri: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=800' } },
  { id: '3', tag: 'NETWORK BONUS',      title: 'Power of 10\nEarnings Await',    image: { uri: 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?q=80&w=800' } },
];

// ── Quick actions ──────────────────────────────────────────────────────────────
const ACTIONS = [
  { id: 'shop',     icon: '🏪', label: 'Shop Essentials', bg: '#F0FFF4' },
  { id: 'share',    icon: '📤', label: 'Share & Earn',    bg: '#EFF6FF' },
  { id: 'network',  icon: '👥', label: 'My Network',      bg: '#F5F3FF' },
  { id: 'partners', icon: '🎁', label: 'Kart Partners',   bg: '#FFF7ED' },
];

// ── Bottom tabs ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'home',    icon: '🏠', label: 'Home'    },
  { id: 'market',  icon: '🏪', label: 'Market'  },
  { id: 'wallet',  icon: '💳', label: 'Wallet'  },
  { id: 'network', icon: '👥', label: 'Network' },
  { id: 'profile', icon: '🪪', label: 'Profile' },
];

const TX_STYLE = {
  referral:   { bg: '#DCFCE7', color: '#16A34A', symbol: '↑' },
  purchase:   { bg: '#DBEAFE', color: '#2563EB', symbol: '🛒' },
  commission: { bg: '#FEF9C3', color: '#CA8A04', symbol: '◎' },
};

const NOTIF_ICON = {
  referral:   { icon: '👥', label: 'Referral Bonus' },
  purchase:   { icon: '🛒', label: 'Shop Purchase'  },
  commission: { icon: '💰', label: 'Commission'     },
};

const fmt      = (n) => `₱ ${(Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const fmtShort = (n) => `₱ ${(Number(n) || 0).toLocaleString('en-PH')}`;

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function fmtRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const hr = Math.floor(m / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ── Transaction row ────────────────────────────────────────────────────────────
function TxRow({ tx, last }) {
  const s = TX_STYLE[tx.type] ?? TX_STYLE.commission;
  return (
    <View style={[txS.row, !last && txS.border]}>
      <View style={[txS.iconWrap, { backgroundColor: s.bg }]}>
        <Text style={[txS.symbol, { color: s.color }]}>{s.symbol}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={txS.desc} numberOfLines={1}>{tx.description || tx.type}</Text>
        <Text style={txS.date}>{fmtDate(tx.created_at)}</Text>
      </View>
      <Text style={[txS.amount, tx.amount >= 0 ? txS.pos : txS.neg]}>
        {tx.amount >= 0 ? '+₱ ' : '-₱ '}
        {Math.abs(Number(tx.amount)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

// ── Notification dropdown row ──────────────────────────────────────────────────
function NotifRow({ item }) {
  const meta = NOTIF_ICON[item.type] ?? { icon: '📋', label: 'Update' };
  return (
    <View style={nS.row}>
      <View style={nS.iconWrap}>
        <Text style={nS.icon}>{meta.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={nS.title} numberOfLines={1}>{item.description || meta.label}</Text>
        <Text style={nS.time}>{fmtRelative(item.created_at)}</Text>
      </View>
      <Text style={[nS.amt, item.amount >= 0 ? nS.pos : nS.neg]}>
        {item.amount >= 0 ? '+' : ''}₱{Math.abs(Number(item.amount)).toLocaleString('en-PH')}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardScreen({ userData, onLogout, onNetwork, onShop, onMarket, onWallet, onProfile }) {
  const [profile,       setProfile]       = useState(null);
  const [wallet,        setWallet]        = useState(null);
  const [transactions,  setTransactions]  = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [slideIndex,    setSlideIndex]    = useState(0);
  const [activeTab,     setActiveTab]     = useState('home');
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const flatRef  = useRef(null);
  const timerRef = useRef(null);

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
    return () => clearInterval(timerRef.current);
  }, []);

  const loadData = async () => {
    try {
      const [prof, tx] = await Promise.all([
        getCurrentUserProfile(),
        getTransactions(userData?.userId),
      ]);
      setProfile(prof);
      setTransactions(tx);
      setNotifications(tx);      // notifications = same feed
      setUnreadCount(tx.length); // all unread on first load
      if (prof?.id) {
        try { const w = await getWallet(prof.id); setWallet(w); } catch (_) {}
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  // ── Real-time: transactions ────────────────────────────────────────────────
  useEffect(() => {
    if (!userData?.userId) return;
    const ch = supabase
      .channel(`tx:${userData.userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'transactions',
        filter: `user_id=eq.${userData.userId}`,
      }, () => {
        getTransactions(userData.userId).then((tx) => {
          setTransactions(tx);
          setNotifications(tx);
          setUnreadCount((n) => n + 1);
        }).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userData?.userId]);

  // ── Real-time: wallet balances ─────────────────────────────────────────────
  // Subscribes to the wallets table so UNILEVEL + SHARE & EARN update
  // instantly whenever a new payment or commission hits the network.
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase
      .channel(`wallet:${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'wallets',
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        // Use the realtime payload directly — no extra fetch needed
        if (payload.new) setWallet(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id]);

  // ── Auto-carousel ──────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSlideIndex((i) => {
        const next = (i + 1) % SLIDES.length;
        flatRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, []);

  const displayName   = profile?.username || profile?.full_name?.split(' ')[0] || 'User';
  const unilevel      = Number(wallet?.unilevel_cash ?? 0);
  const shareEarn     = Number(wallet?.share_earn ?? 0);
  const totalEarnings = unilevel + shareEarn;

  const handleBell = () => {
    if (notifications.length === 0) return; // no notifs → do nothing
    setNotifOpen(true);
    setUnreadCount(0);
  };

  const handleTab = (id) => {
    if (id === 'network') { onNetwork?.(); return; }
    if (id === 'market')  { onMarket?.();  return; }
    if (id === 'wallet')  { onWallet?.();  return; }
    if (id === 'profile') { onProfile?.(); return; }
    setActiveTab(id);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* ── NOTIFICATION DROPDOWN MODAL ── */}
      <Modal
        visible={notifOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setNotifOpen(false)}>
          <View style={nS.backdrop}>
            <TouchableWithoutFeedback>
              <View style={nS.panel}>
                <View style={nS.panelHeader}>
                  <Text style={nS.panelTitle}>Notifications</Text>
                  <TouchableOpacity onPress={() => setNotifOpen(false)}>
                    <Text style={nS.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                {notifications.map((item, i) => (
                  <NotifRow key={item.id ?? i} item={item} />
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Status bar spacer — keeps content below the bar */}
          <View style={{ height: STATUS_H }} />

          {/* Single row: avatar + text  |  bell */}
          <View style={styles.headerRow}>
            {/* Left: avatar + greeting */}
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {displayName[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerLabel}>DASHBOARD</Text>
                <Text style={styles.headerGreeting} numberOfLines={1}>
                  {getGreeting()}, {displayName.startsWith('@') ? displayName : `@${displayName}`}
                </Text>
              </View>
            </View>

            {/* Right: bell — always stays at far right of the row */}
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={handleBell}
              activeOpacity={notifications.length > 0 ? 0.7 : 1}
            >
              <Text style={styles.bellIcon}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── HERO CAROUSEL ─────────────────────────────────────────────── */}
        <View style={styles.carouselWrap}>
          <FlatList
            ref={flatRef}
            data={SLIDES}
            horizontal
            pagingEnabled
            keyExtractor={(s) => s.id}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setSlideIndex(Math.round(e.nativeEvent.contentOffset.x / CARD_W))
            }
            renderItem={({ item }) => (
              <View style={styles.slide}>
                <Image source={item.image} style={styles.slideImg} resizeMode="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.65)']}
                  style={styles.slideOverlay}
                >
                  <Text style={styles.slideTag}>{item.tag}</Text>
                  <Text style={styles.slideTitle}>{item.title}</Text>
                </LinearGradient>
              </View>
            )}
          />
          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === slideIndex && styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── TOTAL EARNINGS ────────────────────────────────────────────── */}
        <LinearGradient
          colors={['#1B4332', '#2d6a4f', '#6aaa3a', '#F0B800', '#F9C449']}
          locations={[0, 0.20, 0.50, 0.80, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.earningsCard}
        >
          <View style={styles.earningsTitleRow}>
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <TouchableOpacity>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }}>⧉</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.earningsAmount}>{fmt(totalEarnings)}</Text>
          <View style={styles.earningsSubs}>
            <View style={styles.earningsSubCard}>
              <Text style={styles.earningsSubLabel}>UNILEVEL</Text>
              <Text style={styles.earningsSubAmt}>{fmtShort(unilevel)}</Text>
            </View>
            <View style={[styles.earningsSubCard, { marginLeft: 12 }]}>
              <Text style={styles.earningsSubLabel}>SHARE & EARN</Text>
              <Text style={styles.earningsSubAmt}>{fmtShort(shareEarn)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── QUICK ACTIONS ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {ACTIONS.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.quickCard, { backgroundColor: a.bg }]}
                onPress={() => {
                  if (a.id === 'network') onNetwork?.();
                  else if (a.id === 'shop') onMarket?.();
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.quickIcon}>{a.icon}</Text>
                <Text style={styles.quickLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── RECENT ACTIVITIES (real-time) ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            /* Empty state — no demo data */
            <View style={styles.emptyAct}>
              <Text style={styles.emptyActIcon}>📭</Text>
              <Text style={styles.emptyActText}>No recent activities yet</Text>
            </View>
          ) : (
            <View style={styles.actCard}>
              {transactions.map((tx, i) => (
                <TxRow key={tx.id} tx={tx} last={i === transactions.length - 1} />
              ))}
            </View>
          )}
        </View>

        {/* ── LATEST UPDATES ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Latest Updates</Text>
          <View style={styles.updateCard}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?q=80&w=800' }}
              style={styles.updateImg}
              resizeMode="cover"
            />
            <View style={styles.updateBody}>
              <View style={styles.updateMetaRow}>
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredText}>FEATURED</Text>
                </View>
                <Text style={styles.updateTime}>2h ago</Text>
              </View>
              <Text style={styles.updateTitle}>Barako Brews: Premium Selection</Text>
              <Text style={styles.updateDesc} numberOfLines={2}>
                Discover the rich, bold flavors of Batangas' finest coffee. Ethically sourced and roasted to perfection for the ultimate morning boost.
              </Text>
              <TouchableOpacity style={styles.readMoreBtn} activeOpacity={0.85}>
                <Text style={styles.readMoreText}>Read More</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 96 }} />
      </ScrollView>

      {/* ── BOTTOM TAB BAR ────────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => handleTab(tab.id)}
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

// ── Notification panel styles ─────────────────────────────────────────────────
const nS = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: STATUS_H + 60,
    paddingRight: 16,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: width * 0.85,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  panelTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  closeBtn:   { fontSize: 16, color: '#999', padding: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB', gap: 10,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0FFF4', alignItems: 'center', justifyContent: 'center',
  },
  icon:  { fontSize: 16 },
  title: { fontSize: 13, fontWeight: '600', color: '#111', marginBottom: 2 },
  time:  { fontSize: 11, color: '#9CA3AF' },
  amt:   { fontSize: 13, fontWeight: '700' },
  pos:   { color: '#16A34A' },
  neg:   { color: '#DC2626' },
});

// ── Transaction row styles ────────────────────────────────────────────────────
const txS = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  border:  { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconWrap:{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  symbol:  { fontSize: 18, fontWeight: '700' },
  desc:    { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  date:    { fontSize: 11, color: '#9CA3AF' },
  amount:  { fontSize: 14, fontWeight: '700' },
  pos:     { color: '#16A34A' },
  neg:     { color: '#DC2626' },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F9FAFB' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* ── Header ── */
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 6,
  },
  /* Single visual row inside header — sits below status bar spacer */
  headerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingTop:        4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    flex:          1,                     // takes all space except bell
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#4CAF50',
    flexShrink: 0,                        // never shrink avatar
  },
  avatarText:     { fontSize: 19, fontWeight: '800', color: '#2E7D32' },
  headerText:     { flex: 1 },
  headerLabel:    { fontSize: 10, fontWeight: '700', color: '#AAAAAA', letterSpacing: 2, marginBottom: 1 },
  headerGreeting: { fontSize: 18, fontWeight: '800', color: '#111111', letterSpacing: -0.3 },

  /* Bell — sits at the right end of headerRow */
  bellBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E5E5E5',
    flexShrink: 0,
  },
  bellIcon:      { fontSize: 17 },
  bellBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#EF4444',
    minWidth: 17, height: 17, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#fff',
  },
  bellBadgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },

  /* ── Carousel ── */
  carouselWrap: { paddingHorizontal: 16, paddingTop: 16 },
  slide:        { width: CARD_W, height: 165, borderRadius: 16, overflow: 'hidden' },
  slideImg:     { width: '100%', height: '100%' },
  slideOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 18, paddingBottom: 16, paddingTop: 40,
  },
  slideTag:   { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '700', letterSpacing: 1.8, marginBottom: 4 },
  slideTitle: { fontSize: 21, fontWeight: '800', color: '#fff', lineHeight: 26 },
  dotsRow:    { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 5 },
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },
  dotActive:  { width: 18, backgroundColor: '#2E7D32' },

  /* ── Earnings card ── */
  earningsCard: {
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 20, padding: 22,
    elevation: 6,
    shadowColor: '#1B4332', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  earningsTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  earningsLabel:    { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  earningsAmount:   { fontSize: 36, fontWeight: '800', color: '#fff', marginBottom: 18 },
  earningsSubs:     { flexDirection: 'row' },
  earningsSubCard:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 12, padding: 12 },
  earningsSubLabel: { fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  earningsSubAmt:   { fontSize: 17, fontWeight: '700', color: '#fff' },

  /* ── Sections ── */
  section:      { paddingHorizontal: 16, marginTop: 24 },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 14 },
  seeAll:       { fontSize: 13, fontWeight: '600', color: '#16A34A' },

  /* Quick actions */
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: {
    width: (CARD_W - 12) / 2, borderRadius: 16, padding: 18, alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  quickIcon:  { fontSize: 28, marginBottom: 8 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },

  /* Activity card */
  actCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F3F4F6',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  /* Empty activity state */
  emptyAct: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 40, backgroundColor: '#fff',
    borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6',
  },
  emptyActIcon: { fontSize: 34, marginBottom: 10 },
  emptyActText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

  /* Latest update */
  updateCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F3F4F6',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  updateImg:     { width: '100%', height: 190 },
  updateBody:    { padding: 16 },
  updateMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  featuredBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  featuredText:  { fontSize: 10, fontWeight: '700', color: '#16A34A', letterSpacing: 0.5 },
  updateTime:    { fontSize: 12, color: '#9CA3AF' },
  updateTitle:   { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8, lineHeight: 24 },
  updateDesc:    { fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  readMoreBtn:   { backgroundColor: '#111827', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  readMoreText:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  /* Bottom tab */
  tabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingBottom: 20, paddingTop: 10,
    elevation: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 },
  },
  tabItem:       { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon:       { fontSize: 20, color: '#9CA3AF' },
  tabIconActive: { color: '#16A34A' },
  tabLabel:      { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  tabLabelActive:{ color: '#16A34A', fontWeight: '700' },
});
