import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, StatusBar, TextInput, ActivityIndicator, Platform, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getProducts, addToCart, toggleFavorite, getFavorites } from '../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

const TABS = [
  { id: 'home', icon: '🏠', label: 'Home' }, { id: 'market', icon: '🏪', label: 'Market' },
  { id: 'wallet', icon: '💳', label: 'Wallet' }, { id: 'network', icon: '👥', label: 'Network' },
  { id: 'profile', icon: '🪪', label: 'Profile' },
];

const MAIN_CATS = [
  { id: 'all', label: 'All' },
  { id: 'pinoy', label: 'Proudly Filipino', subs: ['Local Food & Delicacies','Handmade Crafts','Indigenous Products','Filipino Fashion','Regional Specialties'] },
  { id: 'basic', label: 'Basic Needs', subs: ['Pantry Essentials','Household Supplies','Personal Care','Baby Essentials','Cleaning Products'] },
  { id: 'share', label: 'Share & Earn', subs: ['Beauty & Wellness','Health Supplements','Personal Care Brands','Specialty Products'] },
  { id: 'negosyo', label: 'Negosyo Kits', subs: ['Food Business Kits','Reseller Packages','Online Selling Bundles','Franchise Starter Packs'] },
  { id: 'farm', label: 'Farm to Home', subs: ['Fresh Produce','Organic Goods','Farm Harvest','Seafood & Meat'] },
  { id: 'gifts', label: 'Gift Islands', subs: ['Pasalubong Boxes','Holiday Gifts','Corporate Gifts','Celebration Bundles'] },
  { id: 'eservice', label: 'E-Services', subs: ['Bills Payment','Load & Data','Gift Vouchers','Delivery Services'] },
  { id: 'trending', label: 'Trending', subs: ['Top Sellers','New Arrivals','Flash Deals',"Editor's Picks"] },
];

const DEMO = [
  { id: 'd1', name: 'Barako Premium Coffee', partner_name: 'Batangas Brew Co.', price: 450, rating: 4.9, review_count: 78, category: 'basic', bg: ['#6D4C41','#4E342E'] },
  { id: 'd2', name: 'Handwoven Abaca Tote', partner_name: 'Samar Weavers Guild', price: 1200, rating: 4.8, review_count: 42, category: 'pinoy', bg: ['#5C6BC0','#3949AB'] },
  { id: 'd3', name: 'Wild Organic Honey', partner_name: 'Mindanao Bee Farm', price: 650, rating: 5.0, review_count: 133, category: 'farm', bg: ['#F9A825','#E65100'] },
  { id: 'd4', name: 'Guimaras Fresh Mangoes', partner_name: 'Guimaras Farms', price: 320, rating: 4.9, review_count: 97, category: 'farm', bg: ['#F9A825','#FDD835'] },
  { id: 'd5', name: 'Premium Ifugao Rice', partner_name: 'Ifugao Farms Co.', price: 450, rating: 4.9, review_count: 124, category: 'farm', bg: ['#8D6E63','#5D4037'] },
  { id: 'd6', name: 'Artisanal Coco Jam', partner_name: 'Quezon Coconut Co.', price: 125, rating: 4.7, review_count: 56, category: 'basic', bg: ['#558B2F','#33691E'] },
];

const fmt = (n) => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`;
const EMOJI = { farm:'🌾', pinoy:'🇵🇭', basic:'🧺', negosyo:'💼', gifts:'🎁', eservice:'📱', share:'🤝', trending:'⭐' };

function GridCard({ product, isFav, onToggleFav, onPress }) {
  return (
    <TouchableOpacity style={cS.card} onPress={() => onPress(product)} activeOpacity={0.88}>
      <View style={cS.imgWrap}>
        {product.image_url
          ? <Image source={{ uri: product.image_url }} style={cS.img} resizeMode="cover" />
          : <LinearGradient colors={product.bg ?? ['#2E7D32','#1B5E20']} style={cS.imgPlaceholder}>
              <Text style={{ fontSize: 40 }}>{EMOJI[product.category] ?? '📦'}</Text>
            </LinearGradient>}
        <TouchableOpacity style={cS.heartBtn} onPress={() => onToggleFav(product.id)}>
          <Text style={{ fontSize: 13, color: isFav ? '#EF4444' : '#9CA3AF' }}>{isFav ? '♥' : '♡'}</Text>
        </TouchableOpacity>
        <View style={cS.localBadge}><Text style={cS.localTxt}>LOCAL</Text></View>
      </View>
      <View style={cS.body}>
        <Text style={cS.name} numberOfLines={2}>{product.name}</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:2, marginBottom:4 }}>
          <Text style={{ color:'#FFC107', fontSize:10 }}>★</Text>
          <Text style={{ fontSize:10, fontWeight:'700', color:'#374151' }}>{(product.rating??0).toFixed(1)}</Text>
          <Text style={{ fontSize:9, color:'#9CA3AF' }}>({product.review_count??0})</Text>
        </View>
        <Text style={cS.price}>{fmt(product.price)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ProductsScreen({ userData, onBack, onHome, onNetwork, onWallet, onProductPress }) {
  const [products, setProducts] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mainCat, setMainCat] = useState('all');
  const [subCat, setSubCat] = useState(null);

  useEffect(() => {
    Promise.all([getProducts().catch(()=>[]), getFavorites(userData?.userId).catch(()=>[])])
      .then(([prods, favs]) => {
        setProducts(prods.length > 0 ? prods : DEMO);
        setFavorites(new Set((favs||[]).map(f => f.product_id)));
      }).catch(() => setProducts(DEMO))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleFav = useCallback(async (pid) => {
    setFavorites(prev => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
    try { await toggleFavorite(userData?.userId, pid); } catch(_) {}
  }, [favorites, userData?.userId]);

  const handleAddToCart = useCallback(async (pid) => {
    try { await addToCart(userData?.userId, pid); } catch(_) {}
  }, [userData?.userId]);

  const selectMain = (id) => { if (mainCat===id) { setMainCat('all'); setSubCat(null); } else { setMainCat(id); setSubCat(null); } };
  const currentCat = MAIN_CATS.find(c => c.id === mainCat);

  const filtered = useMemo(() => {
    let list = mainCat !== 'all' ? products.filter(p => p.category === mainCat) : products;
    if (subCat) list = list.filter(p => (p.subcategory??'').toLowerCase() === subCat.toLowerCase());
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(p => p.name?.toLowerCase().includes(q) || p.partner_name?.toLowerCase().includes(q)); }
    return list;
  }, [products, mainCat, subCat, search]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
      <LinearGradient colors={['#1B5E20','#2d6a4f']} style={s.header}>
        <View style={{ height: STATUS_H }} />
        <View style={s.headerRow}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>All Products</Text>
          <View style={{ width: 38 }} />
        </View>
      </LinearGradient>

      {/* Sticky filter */}
      <View style={s.sticky}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
          {MAIN_CATS.map(cat => (
            <TouchableOpacity key={cat.id} style={[s.pill, mainCat===cat.id && s.pillOn]} onPress={() => selectMain(cat.id)}>
              <Text style={[s.pillTxt, mainCat===cat.id && s.pillTxtOn]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {mainCat !== 'all' && currentCat?.subs && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subRow}>
            {currentCat.subs.map(sub => (
              <TouchableOpacity key={sub} style={[s.subPill, subCat===sub && s.subPillOn]} onPress={() => setSubCat(subCat===sub ? null : sub)}>
                <Text style={[s.subPillTxt, subCat===sub && s.subPillTxtOn]}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <View style={s.searchWrap}>
          <Text style={{ color:'#9CA3AF', marginRight:8, fontSize:14 }}>🔍</Text>
          <TextInput style={s.searchInput} placeholder="Search products..." placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} autoCorrect={false} />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color:'#9CA3AF' }}>✕</Text></TouchableOpacity>}
        </View>
      </View>

      {loading ? <ActivityIndicator color="#1B5E20" style={{ flex:1 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={s.count}>{filtered.length} products found</Text>}
          ListEmptyComponent={
            <View style={{ alignItems:'center', paddingVertical:60 }}>
              <Text style={{ fontSize:40, marginBottom:12 }}>📭</Text>
              <Text style={{ fontSize:16, fontWeight:'800', color:'#111827', marginBottom:6 }}>Nothing here yet</Text>
              <Text style={{ fontSize:13, color:'#9CA3AF', textAlign:'center' }}>No products match your selection.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <GridCard product={item} isFav={favorites.has(item.id)} onToggleFav={handleToggleFav} onPress={onProductPress ?? (()=>{})} />
          )}
        />
      )}

      <View style={s.tabBar}>
        {TABS.map(tab => {
          const active = tab.id === 'market';
          return (
            <TouchableOpacity key={tab.id} style={s.tabItem} onPress={() => { if(tab.id==='home') onHome?.(); if(tab.id==='network') onNetwork?.(); if(tab.id==='wallet') onWallet?.(); if(tab.id==='market') onBack?.(); }}>
              <Text style={[s.tabIcon, active && s.tabOn]}>{tab.icon}</Text>
              <Text style={[s.tabLabel, active && s.tabLabelOn]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const cS = StyleSheet.create({
  card: { width:CARD_W, backgroundColor:'#fff', borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:'#F0F0F0', elevation:3, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:6, shadowOffset:{width:0,height:2} },
  imgWrap: { width:'100%', height:CARD_W*0.85, position:'relative' },
  img: { width:'100%', height:'100%' },
  imgPlaceholder: { width:'100%', height:'100%', alignItems:'center', justifyContent:'center' },
  heartBtn: { position:'absolute', top:6, right:6, width:26, height:26, borderRadius:13, backgroundColor:'rgba(255,255,255,0.92)', alignItems:'center', justifyContent:'center', elevation:2 },
  localBadge: { position:'absolute', top:6, left:6, backgroundColor:'#1B5E20', borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  localTxt: { fontSize:9, fontWeight:'800', color:'#fff', letterSpacing:0.5 },
  body: { padding:10 },
  name: { fontSize:12, fontWeight:'700', color:'#111827', lineHeight:17, marginBottom:4, minHeight:34 },
  price: { fontSize:14, fontWeight:'900', color:'#1B5E20', marginBottom:6 },
});

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:'#F4F6F4' },
  header: { paddingBottom:14, paddingHorizontal:20 },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  backBtn: { width:38, height:38, borderRadius:19, backgroundColor:'rgba(255,255,255,0.18)', alignItems:'center', justifyContent:'center' },
  backArrow: { fontSize:20, color:'#fff', fontWeight:'700' },
  headerTitle: { fontSize:20, fontWeight:'800', color:'#fff', letterSpacing:-0.3 },
  sticky: { backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#EBEBEB', elevation:4 },
  pillRow: { paddingHorizontal:16, paddingVertical:10, gap:8 },
  pill: { paddingHorizontal:14, paddingVertical:7, borderRadius:24, backgroundColor:'#F4F6F4', borderWidth:1, borderColor:'#E5E7EB' },
  pillOn: { backgroundColor:'#1B5E20', borderColor:'#1B5E20' },
  pillTxt: { fontSize:12, fontWeight:'600', color:'#374151' },
  pillTxtOn: { color:'#fff', fontWeight:'700' },
  subRow: { paddingHorizontal:16, paddingBottom:8, gap:8 },
  subPill: { paddingHorizontal:12, paddingVertical:5, borderRadius:20, backgroundColor:'#F0FFF4', borderWidth:1, borderColor:'#C8E6C9' },
  subPillOn: { backgroundColor:'#2E7D32', borderColor:'#2E7D32' },
  subPillTxt: { fontSize:11, fontWeight:'600', color:'#2E7D32' },
  subPillTxtOn: { color:'#fff' },
  searchWrap: { flexDirection:'row', alignItems:'center', marginHorizontal:16, marginBottom:10, backgroundColor:'#F4F6F4', borderRadius:12, paddingHorizontal:14, height:40, borderWidth:1, borderColor:'#E5E7EB' },
  searchInput: { flex:1, fontSize:13, color:'#111' },
  listContent: { padding:16, paddingBottom:100 },
  row: { justifyContent:'space-between', marginBottom:14 },
  count: { fontSize:12, color:'#9CA3AF', fontWeight:'500', marginBottom:12 },
  tabBar: { position:'absolute', bottom:0, left:0, right:0, flexDirection:'row', backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#F3F4F6', paddingBottom:20, paddingTop:10, elevation:12 },
  tabItem: { flex:1, alignItems:'center', gap:3 },
  tabIcon: { fontSize:20, color:'#9CA3AF' },
  tabOn: { color:'#1B5E20' },
  tabLabel: { fontSize:10, color:'#9CA3AF', fontWeight:'500' },
  tabLabelOn: { color:'#1B5E20', fontWeight:'700' },
});
