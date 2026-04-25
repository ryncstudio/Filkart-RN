import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Platform, Image, FlatList,
  Modal, Animated, PanResponder, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { addToCart } from '../lib/supabase';

const { width, height } = Dimensions.get('window');
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

const fmt = (n) => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`;
const EMOJI = { farm:'🌾', pinoy:'🇵🇭', basic:'🧺', negosyo:'💼', gifts:'🎁', eservice:'📱', share:'🤝', trending:'⭐' };
const SIZES = ['Small', 'Medium', 'Large', 'XL'];

// ── Image Carousel ────────────────────────────────────────────────────────────
function ImageCarousel({ product }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const bg = product.bg ?? ['#2E7D32','#1B5E20'];
  const icon = EMOJI[product.category] ?? '📦';

  // Build 3 "slides" from the product (demo — same image/gradient 3x)
  const slides = product.image_url
    ? [product.image_url, product.image_url, product.image_url]
    : ['gradient', 'gradient2', 'gradient3'];

  const onScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIdx(idx);
  };

  return (
    <View>
      <FlatList
        data={slides}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width, height: 320 }}>
            {product.image_url
              ? <Image source={{ uri: item }} style={{ width, height: 320 }} resizeMode="cover" />
              : <LinearGradient colors={bg} style={{ width, height: 320, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ fontSize: 100 }}>{icon}</Text>
                </LinearGradient>
            }
          </View>
        )}
      />
      {/* Dots */}
      <View style={carS.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[carS.dot, i === activeIdx && carS.dotActive]} />
        ))}
      </View>
    </View>
  );
}

// ── Options Bottom Sheet ──────────────────────────────────────────────────────
function OptionsModal({ visible, product, mode, onClose, onConfirm }) {
  const [selectedSize, setSelectedSize] = useState(null);
  const [qty, setQty] = useState(1);
  const slideAnim = useRef(new Animated.Value(height)).current;

  React.useEffect(() => {
    if (visible) {
      setSelectedSize(null); setQty(1);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, useNativeDriver: true, duration: 250 }).start();
    }
  }, [visible]);

  const bg = product?.bg ?? ['#2E7D32','#1B5E20'];
  const icon = EMOJI[product?.category] ?? '📦';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={mS.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[mS.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={mS.handle} />

        {/* Product summary */}
        <View style={mS.summary}>
          <View style={mS.thumbWrap}>
            {product?.image_url
              ? <Image source={{ uri: product.image_url }} style={mS.thumb} resizeMode="cover" />
              : <LinearGradient colors={bg} style={mS.thumb}><Text style={{ fontSize:28 }}>{icon}</Text></LinearGradient>
            }
          </View>
          <View style={{ flex:1 }}>
            <Text style={mS.sumName} numberOfLines={2}>{product?.name}</Text>
            <Text style={mS.sumPrice}>{fmt(product?.price)}</Text>
            <Text style={mS.sumPartner}>By: {product?.partner_name ?? 'Kart Partner'}</Text>
          </View>
        </View>

        <View style={mS.divider} />

        {/* Size selector */}
        <Text style={mS.optTitle}>Size</Text>
        <View style={mS.sizeRow}>
          {SIZES.map(sz => (
            <TouchableOpacity key={sz} style={[mS.sizePill, selectedSize===sz && mS.sizePillOn]} onPress={() => setSelectedSize(sz)}>
              <Text style={[mS.sizeTxt, selectedSize===sz && mS.sizeTxtOn]}>{sz}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={mS.divider} />

        {/* Quantity */}
        <View style={mS.qtyRow}>
          <Text style={mS.optTitle}>Quantity</Text>
          <View style={mS.qtyControl}>
            <TouchableOpacity style={mS.qtyBtn} onPress={() => setQty(q => Math.max(1, q-1))}>
              <Text style={mS.qtyBtnTxt}>−</Text>
            </TouchableOpacity>
            <Text style={mS.qtyNum}>{qty}</Text>
            <TouchableOpacity style={mS.qtyBtn} onPress={() => setQty(q => q+1)}>
              <Text style={mS.qtyBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={mS.divider} />

        {/* Total */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:16 }}>
          <Text style={{ fontSize:13, color:'#6B7280' }}>Total</Text>
          <Text style={{ fontSize:16, fontWeight:'900', color:'#1B5E20' }}>{fmt((product?.price??0)*qty)}</Text>
        </View>

        {/* CTA */}
        <View style={mS.ctaRow}>
          <TouchableOpacity
            style={[mS.ctaBtn, mS.ctaOutline]}
            onPress={() => { if (!selectedSize) return; onConfirm('cart', selectedSize, qty); }}
          >
            <Text style={mS.ctaOutlineTxt}>🛒  Add to Cart</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[mS.ctaBtn, mS.ctaFilled]}
            onPress={() => { if (!selectedSize) return; onConfirm('buy', selectedSize, qty); }}
          >
            <Text style={mS.ctaFilledTxt}>Buy Now</Text>
          </TouchableOpacity>
        </View>
        {!selectedSize && <Text style={{ color:'#EF4444', fontSize:11, textAlign:'center', marginTop:6 }}>Please select a size to continue</Text>}
      </Animated.View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProductDetailScreen({ product, userData, onBack, onCartPress, onBuyNow }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode,    setModalMode]    = useState('cart');
  const [isFav,        setIsFav]        = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [toast,        setToast]        = useState('');

  const openModal = (mode) => { setModalMode(mode); setModalVisible(true); };

  const handleConfirm = async (mode, size, qty) => {
    setModalVisible(false);
    if (mode === 'cart') {
      try { 
        await addToCart(userData?.userId, product.id, qty, size); 
        showToast('Added to cart! 🛒');
      } catch(e) {
        Alert.alert('Cart Error', e.message || 'Failed to add item to cart.');
      }
    } else {
      // Buy Now — send single item directly to checkout
      const checkoutItem = [{
        id: `buynow-${product.id}`,
        quantity: qty,
        size,
        products: product,
      }];
      onBuyNow?.(checkoutItem);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const desc = product?.description ?? `A premium quality product sourced directly from local Filipino farmers and artisans. Crafted with care to bring you the best of what the Philippines has to offer. Each item is handpicked for quality, freshness, and authenticity.`;
  const specs = product?.specs ?? `• Origin: ${product?.origin ?? 'Philippines'}\n• Partner: ${product?.partner_name ?? 'Kart Partner'}\n• Category: ${product?.category ?? 'General'}\n• Delivery: 2–5 business days`;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Options Modal */}
      <OptionsModal
        visible={modalVisible}
        product={product}
        mode={modalMode}
        onClose={() => setModalVisible(false)}
        onConfirm={handleConfirm}
      />

      {/* Toast */}
      {toast.length > 0 && (
        <View style={s.toast}><Text style={s.toastTxt}>{toast}</Text></View>
      )}

      {/* Floating back btn */}
      <TouchableOpacity style={[s.floatBack, { top: STATUS_H + 8 }]} onPress={onBack} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={24} color="#111" />
      </TouchableOpacity>
      <TouchableOpacity style={[s.floatHeart, { top: STATUS_H + 8 }]} onPress={() => setIsFav(f => !f)} activeOpacity={0.8}>
        <Text style={{ fontSize:16, color: isFav ? '#EF4444' : '#9CA3AF' }}>{isFav ? '♥' : '♡'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.floatCart, { top: STATUS_H + 8 }]} onPress={onCartPress} activeOpacity={0.8}>
        <Text style={{ fontSize:16 }}>🛒</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Carousel */}
        <ImageCarousel product={product ?? {}} />

        {/* Badges */}
        <View style={s.badgeRow}>
          <View style={s.badge}><Text style={s.badgeTxt}>🌿 100% LOCAL</Text></View>
          <View style={[s.badge, s.badgeGold]}><Text style={[s.badgeTxt, { color:'#1B5E20' }]}>🤝 Share & Earn</Text></View>
        </View>

        {/* Price + Name */}
        <View style={s.infoCard}>
          <Text style={s.price}>{fmt(product?.price)}</Text>
          <Text style={s.name}>{product?.name ?? 'Product Name'}</Text>
          <Text style={s.partner}>By: {product?.partner_name ?? 'Kart Partner'}</Text>

          {/* Ratings */}
          <View style={s.ratingRow}>
            <Text style={{ color:'#FFC107', fontSize:14 }}>{'★'.repeat(Math.floor(product?.rating ?? 4))}</Text>
            <Text style={s.ratingNum}>{(product?.rating ?? 4.5).toFixed(1)}</Text>
            <Text style={s.ratingCount}>({product?.review_count ?? 0} ratings)</Text>
            <View style={s.dividerV} />
            <Text style={s.soldTxt}>{(product?.review_count ?? 0) * 3} sold</Text>
          </View>
        </View>

        {/* Description */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Product Description</Text>
          <Text style={s.descTxt} numberOfLines={descExpanded ? undefined : 3}>{desc}</Text>
          <TouchableOpacity onPress={() => setDescExpanded(e => !e)}>
            <Text style={s.readMore}>{descExpanded ? 'Show less ▲' : 'Read more ▼'}</Text>
          </TouchableOpacity>
        </View>

        {/* Specifications */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Product Details</Text>
          <Text style={s.specTxt}>{specs}</Text>
        </View>

        {/* Origin */}
        <View style={[s.section, { flexDirection:'row', alignItems:'center', gap:10 }]}>
          <Text style={{ fontSize:24 }}>📍</Text>
          <View>
            <Text style={s.sectionTitle}>Place of Origin</Text>
            <Text style={s.specTxt}>{product?.origin ?? 'Philippines'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={s.bottomBar}>
        <TouchableOpacity style={s.cartBarBtn} onPress={() => openModal('cart')} activeOpacity={0.85}>
          <Text style={s.cartBarTxt}>🛒  Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.buyBarBtn} onPress={() => openModal('buy')} activeOpacity={0.85}>
          <Text style={s.buyBarTxt}>Buy Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Carousel Styles ───────────────────────────────────────────────────────────
const carS = StyleSheet.create({
  dots: { flexDirection:'row', justifyContent:'center', gap:6, paddingVertical:10, backgroundColor:'#fff' },
  dot: { width:7, height:7, borderRadius:4, backgroundColor:'#D1D5DB' },
  dotActive: { backgroundColor:'#1B5E20', width:20 },
});

// ── Modal Styles ──────────────────────────────────────────────────────────────
const mS = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)' },
  sheet: {
    position:'absolute', bottom:0, left:0, right:0,
    backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24,
    padding:24, paddingBottom:36,
    elevation:20,
  },
  handle: { width:40, height:4, backgroundColor:'#E5E7EB', borderRadius:2, alignSelf:'center', marginBottom:20 },
  summary: { flexDirection:'row', gap:14, marginBottom:16 },
  thumbWrap: { width:80, height:80, borderRadius:12, overflow:'hidden' },
  thumb: { width:80, height:80, alignItems:'center', justifyContent:'center' },
  sumName: { fontSize:14, fontWeight:'700', color:'#111827', flex:1, marginBottom:4 },
  sumPrice: { fontSize:18, fontWeight:'900', color:'#1B5E20', marginBottom:2 },
  sumPartner: { fontSize:11, color:'#9CA3AF' },
  divider: { height:1, backgroundColor:'#F3F4F6', marginVertical:14 },
  optTitle: { fontSize:14, fontWeight:'700', color:'#111827', marginBottom:10 },
  sizeRow: { flexDirection:'row', gap:10, flexWrap:'wrap' },
  sizePill: { paddingHorizontal:18, paddingVertical:9, borderRadius:10, borderWidth:1.5, borderColor:'#E5E7EB', backgroundColor:'#F9FAFB' },
  sizePillOn: { borderColor:'#1B5E20', backgroundColor:'#F0FFF4' },
  sizeTxt: { fontSize:13, fontWeight:'600', color:'#374151' },
  sizeTxtOn: { color:'#1B5E20', fontWeight:'800' },
  qtyRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  qtyControl: { flexDirection:'row', alignItems:'center', gap:16 },
  qtyBtn: { width:36, height:36, borderRadius:18, backgroundColor:'#F4F6F4', borderWidth:1, borderColor:'#E5E7EB', alignItems:'center', justifyContent:'center' },
  qtyBtnTxt: { fontSize:18, fontWeight:'700', color:'#111827' },
  qtyNum: { fontSize:18, fontWeight:'800', color:'#111827', minWidth:28, textAlign:'center' },
  ctaRow: { flexDirection:'row', gap:12 },
  ctaBtn: { flex:1, paddingVertical:16, borderRadius:16, alignItems:'center' },
  ctaOutline: { borderWidth:2, borderColor:'#1B5E20', backgroundColor:'#fff' },
  ctaFilled: { backgroundColor:'#FFC107' },
  ctaOutlineTxt: { fontSize:14, fontWeight:'800', color:'#1B5E20' },
  ctaFilledTxt: { fontSize:14, fontWeight:'800', color:'#1B5E20' },
});

// ── Screen Styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex:1, backgroundColor:'#fff' },
  floatBack: {
    position:'absolute', left:16, zIndex:10,
    width:38, height:38, borderRadius:19,
    backgroundColor:'rgba(255,255,255,0.9)',
    alignItems:'center', justifyContent:'center',
    elevation:4, shadowColor:'#000', shadowOpacity:0.15, shadowRadius:6,
  },
  floatHeart: {
    position:'absolute', right:16, zIndex:10,
    width:38, height:38, borderRadius:19,
    backgroundColor:'rgba(255,255,255,0.9)',
    alignItems:'center', justifyContent:'center',
    elevation:4,
  },
  floatCart: {
    position:'absolute', right:62, zIndex:10,
    width:38, height:38, borderRadius:19,
    backgroundColor:'rgba(255,255,255,0.9)',
    alignItems:'center', justifyContent:'center',
    elevation:4,
  },
  badgeRow: { flexDirection:'row', gap:8, paddingHorizontal:16, paddingVertical:10, backgroundColor:'#fff' },
  badge: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#F0FFF4', paddingHorizontal:10, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'#C8E6C9' },
  badgeGold: { backgroundColor:'#FFFDE7', borderColor:'#FFF176' },
  badgeTxt: { fontSize:11, fontWeight:'700', color:'#1B5E20' },
  infoCard: { backgroundColor:'#fff', paddingHorizontal:16, paddingBottom:16 },
  price: { fontSize:26, fontWeight:'900', color:'#1B5E20', marginBottom:4 },
  name: { fontSize:18, fontWeight:'800', color:'#111827', marginBottom:4, lineHeight:24 },
  partner: { fontSize:12, color:'#9CA3AF', marginBottom:12, fontStyle:'italic' },
  ratingRow: { flexDirection:'row', alignItems:'center', gap:6 },
  ratingNum: { fontSize:13, fontWeight:'700', color:'#374151' },
  ratingCount: { fontSize:12, color:'#9CA3AF' },
  dividerV: { width:1, height:14, backgroundColor:'#E5E7EB', marginHorizontal:4 },
  soldTxt: { fontSize:12, color:'#6B7280' },
  section: { backgroundColor:'#fff', marginTop:8, padding:16 },
  sectionTitle: { fontSize:14, fontWeight:'800', color:'#111827', marginBottom:8 },
  descTxt: { fontSize:13, color:'#4B5563', lineHeight:21 },
  readMore: { fontSize:12, fontWeight:'700', color:'#1B5E20', marginTop:6 },
  specTxt: { fontSize:13, color:'#4B5563', lineHeight:22 },
  bottomBar: {
    position:'absolute', bottom:0, left:0, right:0,
    flexDirection:'row', gap:12,
    backgroundColor:'#fff', padding:16, paddingBottom:28,
    borderTopWidth:1, borderTopColor:'#F3F4F6',
    elevation:12,
  },
  cartBarBtn: { flex:1, paddingVertical:15, borderRadius:16, alignItems:'center', borderWidth:2, borderColor:'#1B5E20' },
  cartBarTxt: { fontSize:14, fontWeight:'800', color:'#1B5E20' },
  buyBarBtn: { flex:1, paddingVertical:15, borderRadius:16, alignItems:'center', backgroundColor:'#FFC107', elevation:2 },
  buyBarTxt: { fontSize:14, fontWeight:'800', color:'#1B5E20' },
  toast: { position:'absolute', bottom:120, alignSelf:'center', backgroundColor:'#1B5E20', paddingHorizontal:20, paddingVertical:10, borderRadius:24, zIndex:99, elevation:10 },
  toastTxt: { color:'#fff', fontWeight:'700', fontSize:13 },
});
