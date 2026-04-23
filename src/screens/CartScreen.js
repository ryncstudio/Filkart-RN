import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, StatusBar, Platform, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getCartItems, updateCartQuantity, removeFromCart, getProducts } from '../lib/supabase';

const { width } = Dimensions.get('window');
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
const SHIPPING = 45;
const fmt = n => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`;
const EMOJI = { farm:'🌾', pinoy:'🇵🇭', basic:'🧺', negosyo:'💼', gifts:'🎁', eservice:'📱', share:'🤝', trending:'⭐' };

function CartItem({ item, onQtyChange, onRemove }) {
  const p = item.products ?? {};
  const pv = Math.round((p.price ?? 0) * item.quantity * 0.1);
  return (
    <View style={s.itemCard}>
      <View style={s.itemRow}>
        {/* Image */}
        <View style={s.thumbWrap}>
          {p.image_url
            ? <Image source={{ uri: p.image_url }} style={s.thumb} resizeMode="cover" />
            : <LinearGradient colors={['#2E7D32','#1B5E20']} style={s.thumb}>
                <Text style={{ fontSize:28 }}>{EMOJI[p.category] ?? '📦'}</Text>
              </LinearGradient>}
        </View>
        {/* Info */}
        <View style={s.itemInfo}>
          <Text style={s.itemName} numberOfLines={2}>{p.name ?? 'Product'}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 }}>
            <Text style={s.itemPrice}>{fmt(p.price ?? 0)}</Text>
            <View style={s.pvPill}><Text style={s.pvTxt}>{pv} PV</Text></View>
          </View>
          {item.size && <Text style={s.itemSize}>Size: {item.size}</Text>}
          {/* Qty controls */}
          <View style={s.qtyRow}>
            <TouchableOpacity style={s.qtyBtn} onPress={() => onQtyChange(item.id, item.quantity - 1)}>
              <Text style={s.qtyBtnTxt}>−</Text>
            </TouchableOpacity>
            <Text style={s.qtyNum}>{item.quantity}</Text>
            <TouchableOpacity style={s.qtyBtn} onPress={() => onQtyChange(item.id, item.quantity + 1)}>
              <Text style={s.qtyBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Delete */}
        <TouchableOpacity style={s.deleteBtn} onPress={() => onRemove(item.id)} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Text style={{ fontSize:16, color:'#9CA3AF' }}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CartScreen({ userData, onBack, onCheckout, onProductPress }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCart = useCallback(async () => {
    const items = await getCartItems(userData?.userId);
    setCartItems(items);
    setLoading(false);
  }, [userData?.userId]);

  useEffect(() => { loadCart(); }, []);

  const handleQtyChange = async (id, newQty) => {
    if (newQty < 1) { handleRemove(id); return; }
    setCartItems(prev => prev.map(i => i.id === id ? { ...i, quantity: newQty } : i));
    await updateCartQuantity(id, newQty);
  };

  const handleRemove = async (id) => {
    setCartItems(prev => prev.filter(i => i.id !== id));
    await removeFromCart(id);
  };

  const subtotal = cartItems.reduce((sum, i) => sum + (i.products?.price ?? 0) * i.quantity, 0);
  const totalPv  = cartItems.reduce((sum, i) => sum + Math.round((i.products?.price ?? 0) * i.quantity * 0.1), 0);
  const grandTotal = subtotal + SHIPPING;

  if (loading) return <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}><ActivityIndicator color="#1B5E20" /></View>;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={[s.header, { paddingTop: STATUS_H + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
          <Text style={{ fontSize:22, color:'#1B5E20', fontWeight:'700' }}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Your Cart</Text>
        <Text style={{ fontSize:13, color:'#9CA3AF' }}>{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</Text>
      </View>

      {cartItems.length === 0 ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingBottom:80 }}>
          <Text style={{ fontSize:48, marginBottom:16 }}>🛒</Text>
          <Text style={{ fontSize:18, fontWeight:'800', color:'#111827', marginBottom:8 }}>Your cart is empty</Text>
          <Text style={{ fontSize:13, color:'#9CA3AF', textAlign:'center', paddingHorizontal:40 }}>Add products from the marketplace to get started</Text>
          <TouchableOpacity style={[s.checkoutBtn, { marginTop:24, paddingHorizontal:32 }]} onPress={onBack}>
            <Text style={s.checkoutTxt}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16, paddingBottom:130 }}>
          {/* Cart items */}
          {cartItems.map(item => (
            <CartItem key={item.id} item={item} onQtyChange={handleQtyChange} onRemove={handleRemove} />
          ))}

          {/* Loyalty Earnings */}
          <LinearGradient colors={['#1B3A1E','#1B5E20']} style={s.pvCard}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 }}>
              <Text style={{ fontSize:14 }}>⭐</Text>
              <Text style={s.pvCardLabel}>LOYALTY EARNINGS</Text>
            </View>
            <Text style={s.pvCardNum}>{totalPv} PV</Text>
            <Text style={s.pvCardSub}>These points will be added to your Network Wallet upon successful order delivery.</Text>
            {/* Decorative star */}
            <Text style={s.pvStarDeco}>★</Text>
          </LinearGradient>

          {/* Order summary */}
          <View style={s.summaryCard}>
            <View style={s.summaryRow}><Text style={s.summaryLabel}>Subtotal</Text><Text style={s.summaryVal}>{fmt(subtotal)}</Text></View>
            <View style={s.summaryRow}><Text style={s.summaryLabel}>Shipping Fee</Text><Text style={s.summaryVal}>{fmt(SHIPPING)}</Text></View>
            <View style={s.divider} />
            <View style={s.summaryRow}>
              <View>
                <Text style={s.grandLabel}>GRAND TOTAL</Text>
                <Text style={s.grandAmt}>{fmt(grandTotal)}</Text>
              </View>
              <View style={s.savePill}><Text style={{ fontSize:10, fontWeight:'700', color:'#1B5E20' }}>💎 SAVE {totalPv} PV</Text></View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Checkout Button */}
      {cartItems.length > 0 && (
        <View style={s.footer}>
          <TouchableOpacity style={s.checkoutBtn} onPress={() => onCheckout(cartItems)} activeOpacity={0.85}>
            <Text style={s.checkoutTxt}>PROCEED TO CHECKOUT  →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:'#F4F6F4' },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#fff', paddingHorizontal:20, paddingBottom:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  headerTitle: { fontSize:20, fontWeight:'900', color:'#111827' },
  itemCard: { backgroundColor:'#fff', borderRadius:16, marginBottom:12, padding:14, borderWidth:1, borderColor:'#F0F0F0', elevation:2, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6 },
  itemRow: { flexDirection:'row', gap:12 },
  thumbWrap: { width:80, height:80, borderRadius:12, overflow:'hidden', flexShrink:0 },
  thumb: { width:80, height:80, alignItems:'center', justifyContent:'center' },
  itemInfo: { flex:1 },
  itemName: { fontSize:14, fontWeight:'700', color:'#111827', marginBottom:4, lineHeight:19 },
  itemPrice: { fontSize:15, fontWeight:'900', color:'#1B5E20' },
  pvPill: { backgroundColor:'#1B5E20', borderRadius:8, paddingHorizontal:8, paddingVertical:2 },
  pvTxt: { fontSize:10, fontWeight:'800', color:'#fff' },
  itemSize: { fontSize:11, color:'#9CA3AF', marginBottom:4 },
  qtyRow: { flexDirection:'row', alignItems:'center', gap:10, marginTop:4 },
  qtyBtn: { width:28, height:28, borderRadius:14, borderWidth:1.5, borderColor:'#E5E7EB', alignItems:'center', justifyContent:'center' },
  qtyBtnTxt: { fontSize:16, fontWeight:'700', color:'#374151' },
  qtyNum: { fontSize:15, fontWeight:'800', color:'#111827', minWidth:22, textAlign:'center' },
  deleteBtn: { padding:4, alignSelf:'flex-start' },
  pvCard: { borderRadius:18, padding:20, marginBottom:12, overflow:'hidden', position:'relative' },
  pvCardLabel: { fontSize:10, fontWeight:'800', color:'rgba(255,255,255,0.7)', letterSpacing:1.5 },
  pvCardNum: { fontSize:36, fontWeight:'900', color:'#FFC107', marginVertical:4 },
  pvCardSub: { fontSize:11, color:'rgba(255,255,255,0.7)', lineHeight:16 },
  pvStarDeco: { position:'absolute', right:20, bottom:10, fontSize:80, color:'rgba(255,255,255,0.06)' },
  summaryCard: { backgroundColor:'#fff', borderRadius:16, padding:18, borderWidth:1, borderColor:'#F0F0F0', elevation:1 },
  summaryRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  summaryLabel: { fontSize:13, color:'#6B7280' },
  summaryVal: { fontSize:13, fontWeight:'600', color:'#374151' },
  divider: { height:1, backgroundColor:'#F3F4F6', marginVertical:10 },
  grandLabel: { fontSize:10, fontWeight:'700', color:'#9CA3AF', letterSpacing:1, marginBottom:2 },
  grandAmt: { fontSize:26, fontWeight:'900', color:'#111827' },
  savePill: { backgroundColor:'#E8F5E9', borderRadius:12, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:'#C8E6C9' },
  footer: { position:'absolute', bottom:0, left:0, right:0, padding:16, paddingBottom:28, backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#F3F4F6', elevation:12 },
  checkoutBtn: { backgroundColor:'#FFC107', borderRadius:16, paddingVertical:16, alignItems:'center', elevation:3 },
  checkoutTxt: { fontSize:15, fontWeight:'900', color:'#1B5E20', letterSpacing:0.5 },
});
