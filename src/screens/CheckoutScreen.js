import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Platform, Image, TextInput, Modal, Animated, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getDeliveryAddresses, addDeliveryAddress, setDefaultAddress, deleteDeliveryAddress, placeOrder, getWallet } from '../lib/supabase';

const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
const SHIPPING = 45;
const fmt = n => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`;
const EMOJI = { farm:'🌾', pinoy:'🇵🇭', basic:'🧺', negosyo:'💼', gifts:'🎁', eservice:'📱', share:'🤝', trending:'⭐' };

// ── Wallet Balance Modal ───────────────────────────────────────────────────────
function WalletModal({ visible, wallet, onClose, onConfirm }) {
  const [selected, setSelected] = useState(null);
  const slideY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setSelected(null);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 12 }).start();
    } else {
      Animated.timing(slideY, { toValue: 600, useNativeDriver: true, duration: 220 }).start();
    }
  }, [visible]);

  const commission = Number(wallet?.share_earn      ?? 0);
  const unilevel   = Number(wallet?.unilevel_cash   ?? 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={wS.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[wS.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={wS.handle} />
        <Text style={wS.title}>Select Wallet Balance</Text>
        <Text style={wS.sub}>Choose which balance to use for this payment</Text>

        {[{ type:'commission', label:'Share & Earn',   emoji:'📈', amount: commission },
          { type:'unilevel',   label:'Unilevel Cash',  emoji:'💵', amount: unilevel },
        ].map(opt => (
          <TouchableOpacity key={opt.type} style={[wS.option, selected === opt.type && wS.optionOn]} onPress={() => setSelected(opt.type)} activeOpacity={0.8}>
            <View style={[wS.optIcon, selected === opt.type && wS.optIconOn]}>
              <Text style={{ fontSize:20 }}>{opt.emoji}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={[wS.optLabel, selected === opt.type && { color:'#1B5E20' }]}>{opt.label}</Text>
              <Text style={wS.optAmt}>{fmt(opt.amount)} available</Text>
            </View>
            <View style={[wS.radio, selected === opt.type && wS.radioOn]}>
              {selected === opt.type && <View style={wS.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[wS.confirmBtn, !selected && wS.confirmBtnDisabled]}
          onPress={() => { if (selected) onConfirm(selected); }}
          activeOpacity={selected ? 0.85 : 1}
        >
          <Text style={wS.confirmTxt}>Confirm</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ── Address Form Modal ─────────────────────────────────────────────────────────
function AddressFormModal({ visible, onClose, onSave }) {
  const [form, setForm] = useState({ recipient_name:'', phone:'', address_line1:'', city:'', province:'', postal_code:'', label:'HOME', is_default:true });
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={aS.overlay}>
        <View style={aS.sheet}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <Text style={aS.title}>Add Delivery Address</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ fontSize:20, color:'#9CA3AF' }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {[['Recipient Name', 'recipient_name'], ['Phone Number', 'phone'], ['Address', 'address_line1'], ['City', 'city'], ['Province', 'province'], ['Postal Code', 'postal_code']].map(([label, key]) => (
              <View key={key} style={{ marginBottom:14 }}>
                <Text style={aS.fieldLabel}>{label}</Text>
                <TextInput style={aS.input} placeholder={label} placeholderTextColor="#9CA3AF" value={form[key]} onChangeText={v => up(key, v)} />
              </View>
            ))}
            {/* Label */}
            <Text style={aS.fieldLabel}>Label</Text>
            <View style={{ flexDirection:'row', gap:10, marginBottom:14 }}>
              {['HOME','WORK','OTHER'].map(l => (
                <TouchableOpacity key={l} style={[aS.labelPill, form.label===l && aS.labelPillOn]} onPress={() => up('label', l)}>
                  <Text style={[aS.labelTxt, form.label===l && { color:'#fff' }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={aS.defaultRow} onPress={() => up('is_default', !form.is_default)}>
              <View style={[aS.checkbox, form.is_default && aS.checkboxOn]}>
                {form.is_default && <Text style={{ color:'#fff', fontSize:12, fontWeight:'800' }}>✓</Text>}
              </View>
              <Text style={{ fontSize:13, fontWeight:'600', color:'#374151' }}>Set as default address</Text>
            </TouchableOpacity>
            <TouchableOpacity style={aS.saveBtn} onPress={() => { if (form.recipient_name && form.address_line1) onSave(form); }}>
              <Text style={aS.saveTxt}>Save Address</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Checkout Screen ───────────────────────────────────────────────────────
export default function CheckoutScreen({ userData, cartItems = [], onBack, onOrderPlaced }) {
  const [addresses,     setAddresses]     = useState([]);
  const [selectedAddr,  setSelectedAddr]  = useState(null);
  const [payMethod,     setPayMethod]     = useState('cod');
  const [walletType,    setWalletType]    = useState(null);
  const [wallet,        setWallet]        = useState(null);
  const [showWallet,    setShowWallet]    = useState(false);
  const [showAddrForm,  setShowAddrForm]  = useState(false);
  const [placing,       setPlacing]       = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const addrs = await getDeliveryAddresses(userData?.userId);
    setAddresses(addrs);
    const def = addrs.find(a => a.is_default) ?? addrs[0];
    if (def) setSelectedAddr(def);
    const w = await getWallet(userData?.userId).catch(() => null);
    setWallet(w);
  };

  const handleSaveAddress = async (form) => {
    try {
      const saved = await addDeliveryAddress(userData?.userId, form);
      const addrs = await getDeliveryAddresses(userData?.userId);
      setAddresses(addrs);
      setSelectedAddr(saved);
      setShowAddrForm(false);
    } catch(e) { Alert.alert('Error', e.message); }
  };

  const handlePayMethodSelect = (method) => {
    setPayMethod(method);
    if (method === 'wallet') setShowWallet(true);
  };

  const handleWalletConfirm = (type) => {
    setWalletType(type);
    setShowWallet(false);
  };

  const subtotal = cartItems.reduce((s, i) => s + (i.products?.price ?? 0) * i.quantity, 0);
  const grandTotal = subtotal + SHIPPING;

  const handlePlaceOrder = async () => {
    if (!selectedAddr) { Alert.alert('Address Required', 'Please add a delivery address.'); return; }
    setPlacing(true);
    try {
      const order = await placeOrder({
        userId: userData?.userId,
        cartItems,
        paymentMethod: payMethod,
        walletType: payMethod === 'wallet' ? walletType : null,
        addressSnapshot: selectedAddr,
        subtotal,
        shippingFee: SHIPPING,
      });
      onOrderPlaced(order);
    } catch(e) {
      Alert.alert('Order Failed', e.message ?? 'Please try again.');
    } finally { setPlacing(false); }
  };

  const PAY_OPTIONS = [
    { id:'cod',    label:'Cash on Delivery', emoji:'🚚', sub:'Pay when your order arrives' },
    { id:'wallet', label:'Filkart Wallet',   emoji:'💳', sub: walletType ? `Using ${walletType === 'commission' ? 'Commission' : 'Unilevel'} Balance` : 'Pay using your wallet balance' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <WalletModal visible={showWallet} wallet={wallet} onClose={() => { setShowWallet(false); setPayMethod('cod'); }} onConfirm={handleWalletConfirm} />
      <AddressFormModal visible={showAddrForm} onClose={() => setShowAddrForm(false)} onSave={handleSaveAddress} />

      {/* Header */}
      <View style={[s.header, { paddingTop: STATUS_H + 8 }]}>
        <TouchableOpacity onPress={onBack}><Text style={{ fontSize:22, color:'#1B5E20', fontWeight:'700' }}>←</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Checkout</Text>
        <View style={{ width:24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16, paddingBottom:130 }}>

        {/* ── Delivery Address ── */}
        <Text style={s.sectionLabel}>DELIVERY ADDRESS</Text>
        {addresses.map(addr => (
          <TouchableOpacity key={addr.id} style={[s.addrCard, selectedAddr?.id === addr.id && s.addrCardOn]} onPress={() => setSelectedAddr(addr)} activeOpacity={0.85}>
            <View style={{ flexDirection:'row', alignItems:'flex-start', gap:12 }}>
              <View style={[s.radio, selectedAddr?.id === addr.id && s.radioOn]}>
                {selectedAddr?.id === addr.id && <View style={s.radioDot} />}
              </View>
              <View style={{ flex:1 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:2 }}>
                  <Text style={s.addrLabel}>{addr.label}</Text>
                  {addr.is_default && <View style={s.defaultBadge}><Text style={s.defaultBadgeTxt}>DEFAULT</Text></View>}
                </View>
                <Text style={s.addrName}>{addr.recipient_name}  {addr.phone}</Text>
                <Text style={s.addrText}>{[addr.address_line1, addr.city, addr.province, addr.postal_code].filter(Boolean).join(', ')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.addAddrBtn} onPress={() => setShowAddrForm(true)}>
          <Text style={s.addAddrTxt}>＋  Add New Address</Text>
        </TouchableOpacity>

        {/* ── Order Summary ── */}
        <Text style={[s.sectionLabel, { marginTop:20 }]}>ORDER SUMMARY</Text>
        {cartItems.map((item, i) => {
          const p = item.products ?? {};
          const pv = Math.round((p.price ?? 0) * item.quantity * 0.1);
          return (
            <View key={i} style={s.orderItem}>
              <View style={s.orderThumb}>
                {p.image_url
                  ? <Image source={{ uri: p.image_url }} style={{ width:60, height:60 }} resizeMode="cover" />
                  : <LinearGradient colors={['#2E7D32','#1B5E20']} style={{ width:60, height:60, alignItems:'center', justifyContent:'center' }}>
                      <Text style={{ fontSize:24 }}>{EMOJI[p.category]??'📦'}</Text>
                    </LinearGradient>}
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.orderName} numberOfLines={2}>{p.name}</Text>
                <Text style={s.orderQty}>Qty: {item.quantity}{item.size ? `  •  ${item.size}` : ''}</Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                  <Text style={s.orderPrice}>{fmt(p.price ?? 0)}</Text>
                  <View style={s.pvPill}><Text style={s.pvTxt}>{pv} PV</Text></View>
                </View>
              </View>
            </View>
          );
        })}

        {/* PV Banner */}
        <LinearGradient colors={['#2E7D32','#1B5E20']} style={s.pvBanner}>
          <Text style={{ fontSize:16 }}>🎁</Text>
          <Text style={s.pvBannerTxt}>You earn {cartItems.reduce((s,i)=>s+Math.round((i.products?.price??0)*i.quantity*0.1),0)} PV from this purchase.</Text>
        </LinearGradient>

        {/* ── Payment Options ── */}
        <Text style={[s.sectionLabel, { marginTop:20 }]}>PAYMENT OPTIONS</Text>
        {PAY_OPTIONS.map(opt => (
          <TouchableOpacity key={opt.id} style={[s.payOption, payMethod===opt.id && s.payOptionOn]} onPress={() => handlePayMethodSelect(opt.id)} activeOpacity={0.85}>
            <Text style={{ fontSize:22 }}>{opt.emoji}</Text>
            <View style={{ flex:1 }}>
              <Text style={[s.payLabel, payMethod===opt.id && { color:'#1B5E20' }]}>{opt.label}</Text>
              <Text style={s.paySub}>{opt.sub}</Text>
            </View>
            <View style={[s.radio, payMethod===opt.id && s.radioOn]}>
              {payMethod===opt.id && <View style={s.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}

        {/* ── Totals ── */}
        <View style={s.totalsCard}>
          <View style={s.totalRow}><Text style={s.totalLabel}>Subtotal</Text><Text style={s.totalVal}>{fmt(subtotal)}</Text></View>
          <View style={s.totalRow}><Text style={s.totalLabel}>Shipping Fee</Text><Text style={s.totalVal}>{fmt(SHIPPING)}</Text></View>
          <View style={[s.totalRow, { marginTop:10 }]}>
            <Text style={s.grandLabel}>TOTAL</Text>
            <Text style={s.grandVal}>{fmt(grandTotal)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order Button */}
      <View style={s.footer}>
        <TouchableOpacity style={[s.placeBtn, placing && { opacity:0.7 }]} onPress={handlePlaceOrder} disabled={placing} activeOpacity={0.85}>
          {placing ? <ActivityIndicator color="#1B5E20" /> : <Text style={s.placeTxt}>Place Order  •  {fmt(grandTotal)}</Text>}
        </TouchableOpacity>
        <Text style={s.terms}>By tapping "Place Order", you agree to Filkart's Terms of Service.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:'#F4F6F4' },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#fff', paddingHorizontal:20, paddingBottom:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  headerTitle: { fontSize:20, fontWeight:'900', color:'#111827' },
  sectionLabel: { fontSize:11, fontWeight:'700', color:'#9CA3AF', letterSpacing:1.5, marginBottom:10 },
  addrCard: { backgroundColor:'#fff', borderRadius:14, padding:14, marginBottom:10, borderWidth:1.5, borderColor:'#E5E7EB', elevation:1 },
  addrCardOn: { borderColor:'#1B5E20', backgroundColor:'#F0FFF4' },
  radio: { width:20, height:20, borderRadius:10, borderWidth:2, borderColor:'#D1D5DB', alignItems:'center', justifyContent:'center', marginTop:2 },
  radioOn: { borderColor:'#1B5E20' },
  radioDot: { width:10, height:10, borderRadius:5, backgroundColor:'#1B5E20' },
  addrLabel: { fontSize:11, fontWeight:'800', color:'#1B5E20', letterSpacing:0.5 },
  defaultBadge: { backgroundColor:'#E8F5E9', borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  defaultBadgeTxt: { fontSize:9, fontWeight:'800', color:'#1B5E20' },
  addrName: { fontSize:13, fontWeight:'700', color:'#111827', marginBottom:2 },
  addrText: { fontSize:12, color:'#6B7280', lineHeight:18 },
  addAddrBtn: { borderWidth:1.5, borderColor:'#1B5E20', borderRadius:14, borderStyle:'dashed', padding:14, alignItems:'center', marginBottom:4 },
  addAddrTxt: { fontSize:13, fontWeight:'700', color:'#1B5E20' },
  orderItem: { flexDirection:'row', gap:12, backgroundColor:'#fff', borderRadius:14, padding:12, marginBottom:8, borderWidth:1, borderColor:'#F0F0F0' },
  orderThumb: { width:60, height:60, borderRadius:10, overflow:'hidden' },
  orderName: { fontSize:13, fontWeight:'700', color:'#111827', marginBottom:3, lineHeight:18 },
  orderQty: { fontSize:11, color:'#9CA3AF', marginBottom:4 },
  orderPrice: { fontSize:14, fontWeight:'900', color:'#1B5E20' },
  pvPill: { backgroundColor:'#1B5E20', borderRadius:8, paddingHorizontal:6, paddingVertical:2 },
  pvTxt: { fontSize:9, fontWeight:'800', color:'#fff' },
  pvBanner: { borderRadius:14, padding:14, flexDirection:'row', alignItems:'center', gap:10, marginTop:4 },
  pvBannerTxt: { fontSize:13, fontWeight:'700', color:'#fff', flex:1 },
  payOption: { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#fff', borderRadius:14, padding:16, marginBottom:10, borderWidth:1.5, borderColor:'#E5E7EB' },
  payOptionOn: { borderColor:'#FFC107', backgroundColor:'#FFFDE7' },
  payLabel: { fontSize:14, fontWeight:'700', color:'#111827' },
  paySub: { fontSize:11, color:'#9CA3AF', marginTop:2 },
  totalsCard: { backgroundColor:'#fff', borderRadius:14, padding:16, marginTop:8, borderWidth:1, borderColor:'#F0F0F0' },
  totalRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:8 },
  totalLabel: { fontSize:13, color:'#6B7280' },
  totalVal: { fontSize:13, fontWeight:'600', color:'#374151' },
  grandLabel: { fontSize:11, fontWeight:'800', color:'#9CA3AF', letterSpacing:1 },
  grandVal: { fontSize:22, fontWeight:'900', color:'#111827' },
  footer: { position:'absolute', bottom:0, left:0, right:0, padding:16, paddingBottom:28, backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#F3F4F6', elevation:12 },
  placeBtn: { backgroundColor:'#FFC107', borderRadius:16, paddingVertical:16, alignItems:'center', elevation:3 },
  placeTxt: { fontSize:15, fontWeight:'900', color:'#1B5E20' },
  terms: { fontSize:10, color:'#9CA3AF', textAlign:'center', marginTop:8 },
});

// ── Wallet Modal Styles ────────────────────────────────────────────────────────
const wS = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)' },
  sheet: { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:36 },
  handle: { width:40, height:4, backgroundColor:'#E5E7EB', borderRadius:2, alignSelf:'center', marginBottom:20 },
  title: { fontSize:18, fontWeight:'900', color:'#111827', marginBottom:6 },
  sub: { fontSize:12, color:'#9CA3AF', marginBottom:20 },
  option: { flexDirection:'row', alignItems:'center', gap:14, borderWidth:1.5, borderColor:'#E5E7EB', borderRadius:16, padding:16, marginBottom:12 },
  optionOn: { borderColor:'#1B5E20', backgroundColor:'#F0FFF4' },
  optIcon: { width:44, height:44, borderRadius:22, backgroundColor:'#F4F6F4', alignItems:'center', justifyContent:'center' },
  optIconOn: { backgroundColor:'#E8F5E9' },
  optLabel: { fontSize:14, fontWeight:'700', color:'#111827', marginBottom:2 },
  optAmt: { fontSize:12, color:'#6B7280' },
  radio: { width:20, height:20, borderRadius:10, borderWidth:2, borderColor:'#D1D5DB', alignItems:'center', justifyContent:'center' },
  radioOn: { borderColor:'#1B5E20' },
  radioDot: { width:10, height:10, borderRadius:5, backgroundColor:'#1B5E20' },
  confirmBtn: { backgroundColor:'#FFC107', borderRadius:16, paddingVertical:16, alignItems:'center', marginTop:8 },
  confirmBtnDisabled: { backgroundColor:'#E5E7EB' },
  confirmTxt: { fontSize:15, fontWeight:'900', color:'#1B5E20' },
});

// ── Address Form Styles ────────────────────────────────────────────────────────
const aS = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end' },
  sheet: { backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, maxHeight:'90%' },
  title: { fontSize:18, fontWeight:'900', color:'#111827' },
  fieldLabel: { fontSize:12, fontWeight:'700', color:'#374151', marginBottom:6 },
  input: { borderWidth:1.5, borderColor:'#E5E7EB', borderRadius:12, paddingHorizontal:14, height:46, fontSize:14, color:'#111' },
  labelPill: { paddingHorizontal:16, paddingVertical:8, borderRadius:20, borderWidth:1.5, borderColor:'#E5E7EB' },
  labelPillOn: { backgroundColor:'#1B5E20', borderColor:'#1B5E20' },
  labelTxt: { fontSize:12, fontWeight:'700', color:'#374151' },
  defaultRow: { flexDirection:'row', alignItems:'center', gap:10, marginBottom:20 },
  checkbox: { width:22, height:22, borderRadius:6, borderWidth:2, borderColor:'#D1D5DB', alignItems:'center', justifyContent:'center' },
  checkboxOn: { backgroundColor:'#1B5E20', borderColor:'#1B5E20' },
  saveBtn: { backgroundColor:'#FFC107', borderRadius:16, paddingVertical:16, alignItems:'center' },
  saveTxt: { fontSize:15, fontWeight:'900', color:'#1B5E20' },
});
