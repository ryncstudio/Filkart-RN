import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Platform, Image, ActivityIndicator, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getOrderById, subscribeToOrder } from '../lib/supabase';

const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
const fmt = n => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`;
const EMOJI = { farm:'🌾', pinoy:'🇵🇭', basic:'🧺', negosyo:'💼', gifts:'🎁', eservice:'📱', share:'🤝', trending:'⭐' };

const STEPS = [
  { key:'placed',           label:'Order Placed',     icon:'✅', sub:'Order confirmed' },
  { key:'processing',       label:'Processing',       icon:'⚙️', sub:'Preparing your items' },
  { key:'out_for_delivery', label:'Out for Delivery',  icon:'🚚', sub:'On the way to you' },
  { key:'delivered',        label:'Delivered',         icon:'🏠', sub:'Package received' },
];

const STATUS_ORDER = ['placed','processing','out_for_delivery','delivered'];

function StatusStep({ step, state }) {
  // state: 'done' | 'active' | 'pending'
  const isDone   = state === 'done';
  const isActive = state === 'active';
  return (
    <View style={tS.row}>
      {/* Left — dot + line */}
      <View style={tS.lineCol}>
        <View style={[tS.dot, isDone && tS.dotDone, isActive && tS.dotActive]}>
          {isDone   && <Text style={{ fontSize:12, color:'#fff' }}>✓</Text>}
          {isActive && <Text style={{ fontSize:12 }}>{step.icon}</Text>}
          {!isDone && !isActive && <Text style={{ fontSize:10, color:'#D1D5DB' }}>{step.icon}</Text>}
        </View>
        <View style={[tS.line, isDone && tS.lineDone]} />
      </View>
      {/* Right — text */}
      <View style={tS.textCol}>
        <Text style={[tS.stepLabel, isDone && { color:'#1B5E20' }, isActive && { color:'#FFC107' }]}>{step.label}</Text>
        <Text style={tS.stepSub}>{step.sub}</Text>
      </View>
    </View>
  );
}

export default function OrderStatusScreen({ orderId, onBack, onContinueShopping }) {
  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    getOrderById(orderId).then(o => { setOrder(o); setLoading(false); });

    // Real-time subscription
    channelRef.current = subscribeToOrder(orderId, (updated) => {
      setOrder(prev => ({ ...prev, ...updated }));
    });

    return () => { channelRef.current?.unsubscribe?.(); };
  }, [orderId]);

  if (loading) return <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}><ActivityIndicator color="#1B5E20" size="large" /></View>;

  const currentIdx  = STATUS_ORDER.indexOf(order?.status ?? 'placed');
  const addr        = order?.delivery_address_snapshot;
  const items       = order?.order_items ?? [];
  const placedDate  = order?.created_at ? new Date(order.created_at).toLocaleString('en-PH', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={[s.header, { paddingTop: STATUS_H + 8 }]}>
        <TouchableOpacity onPress={onBack}><Text style={{ fontSize:22, color:'#1B5E20', fontWeight:'700' }}>←</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Order Status</Text>
        <View style={{ width:24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16, paddingBottom:60 }}>

        {/* Order number card */}
        <View style={s.orderCard}>
          <View style={s.orderIcon}><Text style={{ fontSize:22 }}>🧾</Text></View>
          <View>
            <Text style={s.orderNum}>{order?.order_number ?? '—'}</Text>
            <Text style={s.orderDate}>Placed on {placedDate}</Text>
          </View>
          <View style={[s.statusPill, order?.status === 'delivered' && s.statusPillDone]}>
            <Text style={[s.statusPillTxt, order?.status === 'delivered' && { color:'#1B5E20' }]}>
              {(order?.status ?? 'placed').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
            </Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={s.timeline}>
          {STEPS.map((step, i) => {
            let state = 'pending';
            if (i < currentIdx)  state = 'done';
            if (i === currentIdx) state = 'active';
            return <StatusStep key={step.key} step={step} state={state} />;
          })}
        </View>

        {/* Delivery Address */}
        {addr && (
          <View style={s.section}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <Text style={{ fontSize:16 }}>📍</Text>
                <Text style={s.sectionTitle}>Delivery Address</Text>
              </View>
              {addr.label && <View style={s.labelBadge}><Text style={s.labelBadgeTxt}>{addr.label}</Text></View>}
            </View>
            {addr.recipient_name && <Text style={s.addrName}>{addr.recipient_name}  {addr.phone}</Text>}
            <Text style={s.addrText}>{[addr.address_line1, addr.address_line2, addr.city, addr.province, addr.postal_code].filter(Boolean).join(', ')}</Text>
          </View>
        )}

        {/* Items Summary */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Items Summary ({items.length})</Text>
          {items.map((item, i) => (
            <View key={i} style={s.itemRow}>
              <View style={s.itemThumb}>
                {item.product_image
                  ? <Image source={{ uri: item.product_image }} style={{ width:56, height:56 }} resizeMode="cover" />
                  : <LinearGradient colors={['#2E7D32','#1B5E20']} style={{ width:56, height:56, alignItems:'center', justifyContent:'center' }}>
                      <Text style={{ fontSize:22 }}>📦</Text>
                    </LinearGradient>}
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.itemName} numberOfLines={2}>{item.product_name}</Text>
                <Text style={s.itemMeta}>Qty: {item.quantity}{item.size ? `  •  ${item.size}` : ''}</Text>
              </View>
              <Text style={s.itemPrice}>{fmt(item.price * item.quantity)}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={s.divider} />
          <View style={{ gap:6 }}>
            <View style={s.totalRow}><Text style={s.totalLabel}>Subtotal</Text><Text style={s.totalVal}>{fmt(order?.subtotal ?? 0)}</Text></View>
            <View style={s.totalRow}><Text style={s.totalLabel}>Shipping</Text><Text style={s.totalVal}>{fmt(order?.shipping_fee ?? 0)}</Text></View>
            <View style={[s.totalRow, { marginTop:4 }]}><Text style={s.grandLabel}>Total</Text><Text style={s.grandVal}>{fmt(order?.total ?? 0)}</Text></View>
          </View>
        </View>

        {/* Contact Support */}
        <TouchableOpacity style={s.supportBtn} onPress={() => Linking.openURL('mailto:support@filkart.ph')} activeOpacity={0.85}>
          <Text style={{ fontSize:16 }}>🎧</Text>
          <Text style={s.supportTxt}>Contact Support</Text>
        </TouchableOpacity>

        {order?.status === 'delivered' && (
          <TouchableOpacity style={s.continueBtn} onPress={onContinueShopping} activeOpacity={0.85}>
            <Text style={s.continueTxt}>Continue Shopping</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const tS = StyleSheet.create({
  row: { flexDirection:'row', marginBottom:0 },
  lineCol: { alignItems:'center', width:40 },
  dot: { width:34, height:34, borderRadius:17, backgroundColor:'#F3F4F6', borderWidth:2, borderColor:'#E5E7EB', alignItems:'center', justifyContent:'center', zIndex:1 },
  dotDone: { backgroundColor:'#1B5E20', borderColor:'#1B5E20' },
  dotActive: { backgroundColor:'#FFC107', borderColor:'#FFC107' },
  line: { width:2, flex:1, backgroundColor:'#E5E7EB', minHeight:36 },
  lineDone: { backgroundColor:'#1B5E20' },
  textCol: { flex:1, paddingLeft:14, paddingBottom:28 },
  stepLabel: { fontSize:15, fontWeight:'800', color:'#9CA3AF', marginBottom:2 },
  stepSub: { fontSize:12, color:'#9CA3AF' },
});

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:'#F4F6F4' },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#fff', paddingHorizontal:20, paddingBottom:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  headerTitle: { fontSize:20, fontWeight:'900', color:'#111827' },
  orderCard: { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#fff', borderRadius:16, padding:16, marginBottom:16, borderWidth:1, borderColor:'#F0F0F0', elevation:2 },
  orderIcon: { width:44, height:44, borderRadius:22, backgroundColor:'#F0FFF4', alignItems:'center', justifyContent:'center' },
  orderNum: { fontSize:15, fontWeight:'800', color:'#111827' },
  orderDate: { fontSize:11, color:'#9CA3AF', marginTop:2 },
  statusPill: { marginLeft:'auto', backgroundColor:'#FFF9C4', borderRadius:10, paddingHorizontal:10, paddingVertical:4 },
  statusPillDone: { backgroundColor:'#E8F5E9' },
  statusPillTxt: { fontSize:10, fontWeight:'800', color:'#D97706' },
  timeline: { backgroundColor:'#fff', borderRadius:16, padding:20, marginBottom:16, borderWidth:1, borderColor:'#F0F0F0', elevation:2 },
  section: { backgroundColor:'#fff', borderRadius:16, padding:16, marginBottom:16, borderWidth:1, borderColor:'#F0F0F0', elevation:1 },
  sectionTitle: { fontSize:14, fontWeight:'800', color:'#111827' },
  labelBadge: { backgroundColor:'#E8F5E9', borderRadius:8, paddingHorizontal:8, paddingVertical:3 },
  labelBadgeTxt: { fontSize:10, fontWeight:'800', color:'#1B5E20' },
  addrName: { fontSize:13, fontWeight:'700', color:'#111827', marginBottom:4 },
  addrText: { fontSize:12, color:'#6B7280', lineHeight:20 },
  itemRow: { flexDirection:'row', alignItems:'center', gap:12, marginTop:12 },
  itemThumb: { width:56, height:56, borderRadius:10, overflow:'hidden' },
  itemName: { fontSize:13, fontWeight:'700', color:'#111827', marginBottom:2 },
  itemMeta: { fontSize:11, color:'#9CA3AF' },
  itemPrice: { fontSize:13, fontWeight:'800', color:'#1B5E20' },
  divider: { height:1, backgroundColor:'#F3F4F6', marginVertical:14 },
  totalRow: { flexDirection:'row', justifyContent:'space-between' },
  totalLabel: { fontSize:13, color:'#6B7280' },
  totalVal: { fontSize:13, fontWeight:'600', color:'#374151' },
  grandLabel: { fontSize:13, fontWeight:'800', color:'#111827' },
  grandVal: { fontSize:16, fontWeight:'900', color:'#1B5E20' },
  supportBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, borderWidth:2, borderColor:'#1B5E20', borderRadius:16, paddingVertical:14, marginBottom:12, backgroundColor:'#fff' },
  supportTxt: { fontSize:14, fontWeight:'800', color:'#1B5E20' },
  continueBtn: { backgroundColor:'#FFC107', borderRadius:16, paddingVertical:14, alignItems:'center' },
  continueTxt: { fontSize:14, fontWeight:'900', color:'#1B5E20' },
});
