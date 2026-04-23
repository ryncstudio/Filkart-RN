import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, TextInput, ActivityIndicator,
  Platform, Image, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getCurrentUserProfile, getWallet,
  getProducts, getFavorites, toggleFavorite, addToCart,
} from '../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_W  = (width - 48) / 2;
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

const TABS = [
  { id: 'home',    icon: '🏠', label: 'Home'    },
  { id: 'market',  icon: '🏪', label: 'Market'  },
  { id: 'wallet',  icon: '💳', label: 'Wallet'  },
  { id: 'network', icon: '👥', label: 'Network' },
  { id: 'profile', icon: '🪪', label: 'Profile' },
];

const CATEGORIES = [
  { id: 'pinoy',    icon: '🇵🇭', label: 'Proudly\nPinoy'   },
  { id: 'basic',    icon: '🧺',  label: 'Basic\nNeeds'      },
  { id: 'share',    icon: '🤝',  label: 'Share\n& Earn'     },
  { id: 'farm',     icon: '🌾',  label: 'Farm to\nHome'     },
  { id: 'negosyo',  icon: '💼',  label: 'Negosyo\nKits'     },
  { id: 'bundles',  icon: '🎁',  label: 'Gift\nBundles'     },
  { id: 'eservice', icon: '📱',  label: 'E-\nServices'      },
  { id: 'trending', icon: '⭐',  label: 'Trending'           },
];

const DEMO_PRODUCTS = [
  { id: 'd1', name: 'Premium Ifugao Rice',  partner_name: 'Ifugao Farms Co.',    price: 450, rating: 4.9, review_count: 124, category: 'farm',    bg: ['#8D6E63','#5D4037'] },
  { id: 'd2', name: 'Handwoven Bayong',     partner_name: 'Mindanao Crafts',     price: 850, rating: 4.8, review_count: 89,  category: 'pinoy',   bg: ['#546E7A','#37474F'] },
  { id: 'd3', name: 'Davao Tableya 70%',   partner_name: 'Davao Cacao Guild',   price: 180, rating: 5.0, review_count: 210, category: 'basic',   bg: ['#6D4C41','#4E342E'] },
  { id: 'd4', name: 'Artisanal Coco Jam',  partner_name: 'Quezon Coconut Co.',  price: 125, rating: 4.7, review_count: 56,  category: 'farm',    bg: ['#558B2F','#33691E'] },
];

const CAT_EMOJI = { farm:'🌾', pinoy:'🇵🇭', basic:'🧺', negosyo:'💼', bundles:'🎁', eservice:'📱', share:'🤝', trending:'⭐' };
const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product, isFav, onToggleFav, onPress }) {
  const bg   = product.bg ?? ['#2E7D32','#1B5E20'];
  const icon = CAT_EMOJI[product.category] ?? '📦';

  return (
    <TouchableOpacity style={cS.card} onPress={() => onPress?.(product)} activeOpacity={0.88}>
      {/* Image / placeholder */}
      <View style={cS.imgWrap}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={cS.img} resizeMode="cover" />
        ) : (
          <LinearGradient colors={bg} style={cS.imgPlaceholder}>
            <Text style={{ fontSize: 48 }}>{icon}</Text>
          </LinearGradient>
        )}
        {/* Heart */}
        <TouchableOpacity style={cS.heartBtn} onPress={() => onToggleFav(product.id)} activeOpacity={0.8}>
          <Text style={{ fontSize: 15, color: isFav ? '#EF4444' : '#9CA3AF' }}>
            {isFav ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={cS.body}>
        <Text style={cS.partner} numberOfLines={1}>By: {product.partner_name ?? 'Kart Partner'}</Text>
        <Text style={cS.name} numberOfLines={2}>{product.name}</Text>
        {/* Stars */}
        <View style={{ flexDirection:'row', alignItems:'center', gap:3, marginBottom:6 }}>
          <Text style={{ color:'#FFC107', fontSize:11 }}>★</Text>
          <Text style={{ fontSize:11, fontWeight:'700', color:'#374151' }}>{(product.rating ?? 0).toFixed(1)}</Text>
          <Text style={{ fontSize:10, color:'#9CA3AF' }}>({product.review_count ?? 0})</Text>
        </View>
        <Text style={cS.price}>{fmt(product.price)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MarketScreen({ userData, categoryFilter, onHome, onNetwork, onWallet, onProfile, onCategories, onProducts, onProductPress, onCartPress }) {
  const [profile,   setProfile]   = useState(null);
  const [wallet,    setWallet]    = useState(null);
  const [products,  setProducts]  = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const prof = await getCurrentUserProfile();
      setProfile(prof);
      if (prof?.id) {
        try { const w = await getWallet(prof.id); setWallet(w); } catch (_) {}
      }
      const [prods, favs] = await Promise.all([
        getProducts().catch(() => []),
        getFavorites(userData?.userId).catch(() => []),
      ]);
      setProducts(prods.length > 0 ? prods : DEMO_PRODUCTS);
      setFavorites(new Set((favs || []).map(f => f.product_id)));
    } catch (_) {
      setProducts(DEMO_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFav = useCallback(async (pid) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
    try { await toggleFavorite(userData?.userId, pid); } catch (_) {}
  }, [userData?.userId]);

  const handleAddToCart = useCallback(async (pid) => {
    try { 
      await addToCart(userData?.userId, pid); 
      setCartCount(n => n + 1);
    } catch (e) {
      Alert.alert('Cart Error', e.message || 'Failed to add item to cart.');
    }
  }, [userData?.userId]);

  // Filter by search query AND categoryFilter from CategoriesScreen
  const filtered = useMemo(() => {
    let list = products;
    if (categoryFilter?.subcategoryLabel) {
      list = list.filter(p =>
        p.subcategory === categoryFilter.subcategoryId ||
        p.category    === categoryFilter.categoryId
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.partner_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, search, categoryFilter]);

  const displayName = profile?.username || profile?.full_name?.split(' ')[0] || 'Member';
  const credits     = Number(wallet?.commission_balance ?? 0) + Number(wallet?.unilevel_balance ?? 0);

  // ── ACTIVE-only gate ──
  if (!loading && profile?.status && profile.status !== 'Active') {
    return (
      <View style={styles.gate}>
        <Text style={{ fontSize: 52, marginBottom: 16 }}>🔒</Text>
        <Text style={styles.gateTitle}>Members Only</Text>
        <Text style={styles.gateSub}>
          The Filkart Exclusive Marketplace is only available to Active members.
          Complete your registration to unlock access.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      {/* ── HEADER ── */}
      <LinearGradient colors={['#1B5E20','#2d6a4f']} style={styles.header}>
        <View style={{ height: STATUS_H }} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.mabuhay}>MABUHAY,</Text>
            <Text style={styles.userName}>{displayName}</Text>
          </View>
          <View style={{ flexDirection:'row', gap:8 }}>
            <TouchableOpacity style={styles.iconBtn}>
              <Text style={{ fontSize:18 }}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={onCartPress} activeOpacity={0.8}>
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeTxt}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
              <Text style={{ fontSize:18 }}>🛒</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── HERO BANNER ── */}
        <LinearGradient
          colors={['#1B4332','#2d6a4f','#52b788']}
          start={{ x:0, y:0 }} end={{ x:1, y:1 }}
          style={styles.hero}
        >
          <View style={styles.heroLeft}>
            <Text style={styles.heroTag}>🌿 EXCLUSIVE MARKET</Text>
            <Text style={styles.heroTitle}>Support{'\n'}Local</Text>
            <Text style={styles.heroSub}>Direct from Filipino Farmers</Text>
            <TouchableOpacity style={styles.heroBtn} activeOpacity={0.85}>
              <Text style={styles.heroBtnTxt}>Shop Now</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.heroRight}>
            <Text style={{ fontSize:72, lineHeight:76 }}>🥬</Text>
            <Text style={{ fontSize:48, marginTop:-10, marginLeft:12 }}>🍅</Text>
            <Text style={{ fontSize:36, marginTop:-8, marginLeft:-8 }}>🌽</Text>
          </View>
        </LinearGradient>

        {/* ── SEARCH + CREDITS ── */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Text style={styles.searchLens}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search fresh produce, crafts..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.filterBtn}>
              <Text style={styles.filterTxt}>⚙</Text>
            </TouchableOpacity>
          </View>
          <LinearGradient colors={['#E8F5E9','#F0FFF4']} style={styles.creditsBar}>
            <Text style={{ fontSize:14 }}>💳</Text>
            <Text style={styles.creditsLabel}>Purchase Credits:</Text>
            <Text style={styles.creditsAmt}>{fmt(credits)}</Text>
          </LinearGradient>
        </View>



        {/* ── FEATURED PRODUCTS ── */}
        <View style={styles.section}>
          <View style={[styles.sectionRow, { marginBottom: 14 }]}>
            <Text style={styles.sectionTitle}>Featured Products</Text>
            <TouchableOpacity onPress={() => onProducts?.()}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {categoryFilter && filtered.length === 0 && !loading && (
            <View style={{ alignItems:'center', paddingVertical:40, backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:'#F3F4F6' }}>
              <Text style={{ fontSize:36, marginBottom:12 }}>📭</Text>
              <Text style={{ fontSize:15, fontWeight:'700', color:'#111827', marginBottom:6 }}>Nothing here yet</Text>
              <Text style={{ fontSize:13, color:'#9CA3AF', textAlign:'center', paddingHorizontal:24 }}>
                No products found in '{categoryFilter.subcategoryLabel}'. Check back soon!
              </Text>
            </View>
          )}
          {loading ? (
            <ActivityIndicator color="#1B5E20" style={{ paddingVertical:40 }} />
          ) : (
            <View style={styles.grid}>
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  isFav={favorites.has(p.id)}
                  onToggleFav={handleToggleFav}
                  onAddToCart={handleAddToCart}
                  onPress={onProductPress}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── BOTTOM TAB BAR ── */}
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
                if (tab.id === 'profile') onProfile?.();
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

// ── Product Card Styles ───────────────────────────────────────────────────────
const cS = StyleSheet.create({
  card: {
    width: CARD_W, backgroundColor:'#fff', borderRadius:16,
    overflow:'hidden', borderWidth:1, borderColor:'#F3F4F6',
    elevation:3, shadowColor:'#000', shadowOpacity:0.08,
    shadowRadius:8, shadowOffset:{ width:0, height:3 },
  },
  imgWrap:       { width:'100%', height: CARD_W, position:'relative' },
  img:           { width:'100%', height:'100%' },
  imgPlaceholder:{ width:'100%', height:'100%', alignItems:'center', justifyContent:'center' },
  heartBtn: {
    position:'absolute', top:8, right:8,
    width:30, height:30, borderRadius:15,
    backgroundColor:'rgba(255,255,255,0.92)',
    alignItems:'center', justifyContent:'center',
    elevation:2,
  },
  body:    { padding:10 },
  partner: { fontSize:10, color:'#9CA3AF', marginBottom:2, fontStyle:'italic' },
  name:    { fontSize:13, fontWeight:'700', color:'#111827', marginBottom:4, lineHeight:18 },
  priceRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:2 },
  price:   { fontSize:16, fontWeight:'900', color:'#1B5E20' },
  cartBtn: {
    width:34, height:34, borderRadius:17,
    backgroundColor:'#FFC107',
    alignItems:'center', justifyContent:'center',
    elevation:2,
  },
  cartDone:{ backgroundColor:'#4CAF50' },
});

// ── Main Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex:1, backgroundColor:'#F4F6F4' },

  /* Gate */
  gate:      { flex:1, alignItems:'center', justifyContent:'center', padding:32, backgroundColor:'#F9FAFB' },
  gateTitle: { fontSize:22, fontWeight:'800', color:'#1B5E20', textAlign:'center', marginBottom:12 },
  gateSub:   { fontSize:14, color:'#6B7280', textAlign:'center', lineHeight:22 },

  /* Header */
  header: { paddingBottom:8, paddingHorizontal:20 },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  mabuhay:   { fontSize:11, fontWeight:'700', color:'rgba(255,255,255,0.75)', letterSpacing:1.5 },
  userName:  { fontSize:24, fontWeight:'900', color:'#fff', letterSpacing:-0.5 },
  iconBtn:   {
    width:38, height:38, borderRadius:19,
    backgroundColor:'rgba(255,255,255,0.18)',
    alignItems:'center', justifyContent:'center',
  },
  cartBadge: {
    position:'absolute', top:-2, right:-2, zIndex:1,
    width:16, height:16, borderRadius:8,
    backgroundColor:'#FFC107',
    alignItems:'center', justifyContent:'center',
  },
  cartBadgeTxt: { fontSize:8, fontWeight:'900', color:'#1B5E20' },

  /* Hero */
  hero: {
    marginHorizontal:16, marginTop:16,
    borderRadius:20, padding:24,
    flexDirection:'row', alignItems:'center',
    minHeight:160, overflow:'hidden',
  },
  heroLeft:   { flex:1 },
  heroTag:    { fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.75)', letterSpacing:1.5, marginBottom:6 },
  heroTitle:  { fontSize:30, fontWeight:'900', color:'#fff', lineHeight:34, marginBottom:6 },
  heroSub:    { fontSize:12, color:'rgba(255,255,255,0.80)', marginBottom:16 },
  heroBtn:    {
    backgroundColor:'#FFC107', alignSelf:'flex-start',
    paddingHorizontal:20, paddingVertical:10,
    borderRadius:24,
    elevation:3,
  },
  heroBtnTxt: { fontSize:14, fontWeight:'800', color:'#1B5E20' },
  heroRight:  { alignItems:'center', justifyContent:'center', paddingLeft:8 },

  /* Search */
  searchSection: { paddingHorizontal:16, marginTop:16, gap:10 },
  searchBar: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'#fff', borderRadius:14,
    paddingHorizontal:14, height:48,
    borderWidth:1, borderColor:'#E5E7EB',
    elevation:1,
  },
  searchLens:  { fontSize:16, marginRight:8, color:'#9CA3AF' },
  searchInput: { flex:1, fontSize:14, color:'#111' },
  filterBtn:   {
    width:32, height:32, borderRadius:8,
    backgroundColor:'#F0FFF4',
    alignItems:'center', justifyContent:'center',
  },
  filterTxt:   { fontSize:16, color:'#1B5E20' },
  creditsBar: {
    flexDirection:'row', alignItems:'center', gap:8,
    borderRadius:12, padding:12,
    borderWidth:1, borderColor:'#C8E6C9',
  },
  creditsLabel:{ fontSize:13, fontWeight:'600', color:'#2E7D32', flex:1 },
  creditsAmt:  { fontSize:14, fontWeight:'900', color:'#1B5E20' },

  /* Sections */
  section:      { paddingHorizontal:16, marginTop:24 },
  sectionRow:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  sectionTitle: { fontSize:17, fontWeight:'800', color:'#111827' },
  viewAll:      { fontSize:13, fontWeight:'600', color:'#1B5E20' },

  /* Categories */
  catItem:    { alignItems:'center', width:66 },
  catIconWrap:{
    width:56, height:56, borderRadius:28,
    backgroundColor:'#fff', alignItems:'center', justifyContent:'center',
    borderWidth:1, borderColor:'#E5E7EB',
    elevation:2, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4,
    marginBottom:6,
  },
  catLabel:   { fontSize:10, fontWeight:'600', color:'#374151', textAlign:'center', lineHeight:13 },

  /* Product grid */
  grid: { flexDirection:'row', flexWrap:'wrap', gap:12 },

  /* Tab bar */
  tabBar: {
    position:'absolute', bottom:0, left:0, right:0,
    flexDirection:'row', backgroundColor:'#fff',
    borderTopWidth:1, borderTopColor:'#F3F4F6',
    paddingBottom:20, paddingTop:10,
    elevation:12,
  },
  tabItem:       { flex:1, alignItems:'center', gap:3 },
  tabIcon:       { fontSize:20, color:'#9CA3AF' },
  tabActive:     { color:'#1B5E20' },
  tabLabel:      { fontSize:10, color:'#9CA3AF', fontWeight:'500' },
  tabLabelActive:{ color:'#1B5E20', fontWeight:'700' },
});
