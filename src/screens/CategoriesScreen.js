import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Dimensions, StatusBar, Platform,
  LayoutAnimation, UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const TABS = [
  { id: 'home',    icon: '🏠', label: 'Home'    },
  { id: 'market',  icon: '🏪', label: 'Market'  },
  { id: 'wallet',  icon: '💳', label: 'Wallet'  },
  { id: 'network', icon: '👥', label: 'Network' },
  { id: 'profile', icon: '🪪', label: 'Profile' },
];

const CATEGORIES = [
  {
    id: 'pinoy',
    icon: '🇵🇭',
    iconBg: ['#C8E6C9','#A5D6A7'],
    title: 'Proudly Filipino',
    subtitle: 'Local Treasures',
    subcategories: [
      { id: 'local_food',    icon: '🍱', label: 'Local Food & Delicacies' },
      { id: 'handmade',      icon: '🧶', label: 'Handmade Crafts'         },
      { id: 'indigenous',    icon: '🏺', label: 'Indigenous Products'     },
      { id: 'fashion',       icon: '👘', label: 'Filipino Fashion'         },
      { id: 'regional',      icon: '🗺️', label: 'Regional Specialties'    },
    ],
  },
  {
    id: 'basic',
    icon: '🧺',
    iconBg: ['#FFE0B2','#FFCC80'],
    title: 'Basic Needs Hub',
    subtitle: 'Daily Essentials',
    subcategories: [
      { id: 'pantry',    icon: '🥫', label: 'Pantry Essentials'   },
      { id: 'household', icon: '🧹', label: 'Household Supplies'  },
      { id: 'personal',  icon: '🧴', label: 'Personal Care'       },
      { id: 'baby',      icon: '👶', label: 'Baby Essentials'      },
      { id: 'cleaning',  icon: '🧽', label: 'Cleaning Products'   },
    ],
  },
  {
    id: 'share',
    icon: '🤝',
    iconBg: ['#BBDEFB','#90CAF9'],
    title: 'Share & Earn Products',
    subtitle: 'Partner Brands',
    subcategories: [
      { id: 'beauty',   icon: '💄', label: 'Beauty & Wellness'     },
      { id: 'health',   icon: '💊', label: 'Health Supplements'    },
      { id: 'pc_brand', icon: '🧼', label: 'Personal Care Brands'  },
      { id: 'special',  icon: '⭐', label: 'Specialty Products'    },
    ],
  },
  {
    id: 'negosyo',
    icon: '💼',
    iconBg: ['#FFF9C4','#FFF176'],
    title: 'Negosyo Starter Kits',
    subtitle: 'Entrepreneur Hub',
    subcategories: [
      { id: 'food_biz',  icon: '🍔', label: 'Food Business Kits'      },
      { id: 'reseller',  icon: '📦', label: 'Reseller Packages'       },
      { id: 'online',    icon: '💻', label: 'Online Selling Bundles'  },
      { id: 'franchise', icon: '🏪', label: 'Franchise Starter Packs' },
    ],
  },
  {
    id: 'farm',
    icon: '🌾',
    iconBg: ['#DCEDC8','#C5E1A5'],
    title: 'Farm to Home',
    subtitle: 'Fresh & Organic',
    subcategories: [
      { id: 'produce', icon: '🥬', label: 'Fresh Produce'  },
      { id: 'organic', icon: '🌿', label: 'Organic Goods'  },
      { id: 'harvest', icon: '🌽', label: 'Farm Harvest'   },
      { id: 'seafood', icon: '🐟', label: 'Seafood & Meat' },
    ],
  },
  {
    id: 'gifts',
    icon: '🎁',
    iconBg: ['#F8BBD9','#F48FB1'],
    title: 'Gift from the Islands',
    subtitle: 'Pasalubong & More',
    subcategories: [
      { id: 'pasalubong',  icon: '🎀', label: 'Pasalubong Boxes'    },
      { id: 'holiday',     icon: '🎄', label: 'Holiday Gifts'       },
      { id: 'corporate',   icon: '🏢', label: 'Corporate Gifts'     },
      { id: 'celebration', icon: '🎉', label: 'Celebration Bundles' },
    ],
  },
  {
    id: 'eservice',
    icon: '📱',
    iconBg: ['#E1BEE7','#CE93D8'],
    title: 'E-Services',
    subtitle: 'Digital Essentials',
    subcategories: [
      { id: 'bills',    icon: '📋', label: 'Bills Payment'       },
      { id: 'load',     icon: '📶', label: 'Load & Data'         },
      { id: 'vouchers', icon: '🎟️', label: 'Gift Vouchers'       },
      { id: 'delivery', icon: '🚚', label: 'Delivery Services'   },
    ],
  },
  {
    id: 'trending',
    icon: '⭐',
    iconBg: ['#FFD54F','#FFB300'],
    title: 'Trending Now',
    subtitle: 'Hottest Picks',
    subcategories: [
      { id: 'top_sellers', icon: '🔥', label: 'Top Sellers'       },
      { id: 'new_arrivals', icon: '✨', label: 'New Arrivals'      },
      { id: 'flash_deals',  icon: '⚡', label: 'Flash Deals'       },
      { id: 'editors_pick', icon: '👑', label: "Editor's Picks"    },
    ],
  },
];

// ── Accordion Card ─────────────────────────────────────────────────────────────
function CategoryCard({ cat, isOpen, onToggle, onSubPress }) {
  return (
    <View style={styles.card}>
      {/* Header row */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={onToggle}
        activeOpacity={0.75}
      >
        <LinearGradient colors={cat.iconBg} style={styles.catIconWrap}>
          <Text style={{ fontSize: 26 }}>{cat.icon}</Text>
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.catTitle}>{cat.title}</Text>
          <Text style={styles.catSub}>{cat.subtitle}</Text>
        </View>
        <Text style={[styles.chevronMain, isOpen && styles.chevronMainOpen]}>
          ⌄
        </Text>
      </TouchableOpacity>

      {/* Expanded subcategory list */}
      {isOpen && (
        <View style={styles.subList}>
          <View style={styles.subDivider} />
          {cat.subcategories.map((sub, idx) => (
            <TouchableOpacity
              key={sub.id}
              style={[styles.subRow, idx === cat.subcategories.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => onSubPress(cat.id, sub)}
              activeOpacity={0.7}
            >
              <View style={styles.subIconWrap}>
                <Text style={{ fontSize: 16 }}>{sub.icon}</Text>
              </View>
              <Text style={styles.subLabel}>{sub.label}</Text>
              <Text style={styles.chevronSub}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function CategoriesScreen({ userData, onBack, onSelectCategory, onHome, onNetwork, onWallet }) {
  const [search,   setSearch]   = useState('');
  // All expanded by default, matching the reference UI
  const [expanded, setExpanded] = useState(() => new Set(CATEGORIES.map(c => c.id)));

  const toggle = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Filter categories + their subcategories by search query
  const filtered = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.reduce((acc, cat) => {
      const titleMatch = cat.title.toLowerCase().includes(q) || cat.subtitle.toLowerCase().includes(q);
      const matchedSubs = cat.subcategories.filter(s => s.label.toLowerCase().includes(q));
      if (titleMatch || matchedSubs.length > 0) {
        acc.push({ ...cat, subcategories: titleMatch ? cat.subcategories : matchedSubs });
      }
      return acc;
    }, []);
  }, [search]);

  const handleSubPress = (categoryId, sub) => {
    onSelectCategory?.({ categoryId, subcategoryId: sub.id, subcategoryLabel: sub.label });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      {/* ── Green Header ── */}
      <LinearGradient colors={['#1B5E20','#2d6a4f']} style={styles.header}>
        <View style={{ height: STATUS_H }} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Categories</Text>
          <TouchableOpacity style={styles.searchIconBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 18, color: '#fff' }}>🔍</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Search bar ── */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Text style={styles.searchLens}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search categories..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: '#9CA3AF', fontSize: 14, padding: 4 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Accordion list ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
            <Text style={styles.emptyText}>No categories found</Text>
          </View>
        ) : (
          filtered.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              isOpen={expanded.has(cat.id)}
              onToggle={() => toggle(cat.id)}
              onSubPress={handleSubPress}
            />
          ))
        )}

        {/* ── Support Local Bayanihan Banner ── */}
        <LinearGradient
          colors={['#1B5E20','#2d6a4f','#40916c']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <Text style={styles.bannerEmoji}>🤝</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Support Local Bayanihan</Text>
            <Text style={styles.bannerSub}>Join our mission to empower local communities.</Text>
          </View>
        </LinearGradient>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Bottom tab bar (Market active) ── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = tab.id === 'market';
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => {
                if (tab.id === 'home')    onHome?.();
                if (tab.id === 'network') onNetwork?.();
                if (tab.id === 'wallet')  onWallet?.();
                if (tab.id === 'market')  onBack?.();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, active && styles.tabActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F4' },

  /* Header */
  header: { paddingBottom: 14, paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow:     { fontSize: 20, color: '#fff', fontWeight: '700' },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  searchIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Search bar */
  searchWrap: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F4F6F4', borderRadius: 14,
    paddingHorizontal: 14, height: 46,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchLens:  { fontSize: 15, color: '#9CA3AF', marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111' },

  /* Scroll */
  scroll: { padding: 16, paddingBottom: 100 },

  /* Category accordion card */
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1, borderColor: '#EBEBEB',
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16,
  },
  catIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  catTitle:    { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 2 },
  catSub:      { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  chevronMain: { fontSize: 22, color: '#9CA3AF', fontWeight: '700', transform: [{ rotate: '0deg' }] },
  chevronMainOpen: { transform: [{ rotate: '180deg' }] },

  /* Subcategory list */
  subDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
  subList:    {},
  subRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
    gap: 12,
  },
  subIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F4F6F4',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  subLabel:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  chevronSub: { fontSize: 20, color: '#9CA3AF', fontWeight: '300' },

  /* Banner */
  banner: {
    borderRadius: 18, padding: 20,
    flexDirection: 'row', alignItems: 'center',
    gap: 14, marginTop: 8,
  },
  bannerEmoji: { fontSize: 36 },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bannerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 18 },

  /* Empty state */
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },

  /* Tab bar */
  tabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingBottom: 20, paddingTop: 10,
    elevation: 12,
  },
  tabItem:        { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon:        { fontSize: 20, color: '#9CA3AF' },
  tabActive:      { color: '#1B5E20' },
  tabLabel:       { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  tabLabelActive: { color: '#1B5E20', fontWeight: '700' },
});
