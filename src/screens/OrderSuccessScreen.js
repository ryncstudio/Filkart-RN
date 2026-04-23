import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, ScrollView, Image, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getProducts } from '../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;
const fmt = n => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`;
const EMOJI = { farm:'🌾', pinoy:'🇵🇭', basic:'🧺', negosyo:'💼', gifts:'🎁', eservice:'📱', share:'🤝', trending:'⭐' };

const DEMO_PRODUCTS = [
  { id:'d1', name:'Barako Premium Coffee', price:450, category:'basic', bg:['#6D4C41','#4E342E'] },
  { id:'d2', name:'Handwoven Abaca Tote',  price:1200, category:'pinoy', bg:['#5C6BC0','#3949AB'] },
  { id:'d3', name:'Wild Organic Honey',    price:650,  category:'farm',  bg:['#F9A825','#E65100'] },
  { id:'d4', name:'Guimaras Mangoes',      price:320,  category:'farm',  bg:['#F9A825','#FDD835'] },
];

export default function OrderSuccessScreen({ order, onTrackOrder, onContinueShopping, onProductPress }) {
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const [suggested, setSuggested] = useState([]);

  useEffect(() => {
    // Entry animation
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue:1, useNativeDriver:true, tension:60, friction:8 }),
      Animated.timing(opacityAnim, { toValue:1, useNativeDriver:true, duration:400 }),
    ]).start();

    // Pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue:1.08, useNativeDriver:true, duration:800 }),
        Animated.timing(pulseAnim, { toValue:1,    useNativeDriver:true, duration:800 }),
      ])
    ).start();

    // Load suggested products
    getProducts().then(p => setSuggested(p.length > 0 ? p.slice(0,4) : DEMO_PRODUCTS)).catch(() => setSuggested(DEMO_PRODUCTS));
  }, []);

  const totalPv = order?.total_pv ?? 0;
  const orderNum = order?.order_number ?? 'FK-00000';

  return (
    <View style={s.root}>
      <LinearGradient colors={['#F0FFF4','#FFFDE7','#F4F6F4']} style={s.heroBg}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:40 }}>

          {/* Trophy */}
          <View style={{ alignItems:'center', paddingTop:60, paddingBottom:24 }}>
            <Animated.View style={{ transform:[{ scale: scaleAnim }, { scale: pulseAnim }] }}>
              <View style={s.trophyRing}>
                <Text style={s.trophyEmoji}>🏆</Text>
              </View>
            </Animated.View>
            {/* Stars */}
            <Text style={[s.star, { position:'absolute', top:44, right:width/2 - 70 }]}>★</Text>
            <Text style={[s.star, { position:'absolute', top:80, left:width/2 - 90, fontSize:14 }]}>★</Text>
          </View>

          {/* Success text */}
          <Animated.View style={[{ alignItems:'center', paddingHorizontal:32 }, { opacity: opacityAnim }]}>
            <Text style={s.title}>Order Placed{'\n'}Successfully!</Text>
            <Text style={s.sub}>Thank you for supporting local. Your order is now being processed and will be with you soon.</Text>
            <Text style={s.orderNum}>{orderNum}</Text>
          </Animated.View>

          {/* PV Card */}
          <Animated.View style={[s.pvCard, { opacity: opacityAnim }]}>
            <View style={s.pvIcon}><Text style={{ fontSize:22 }}>💳</Text></View>
            <View>
              <Text style={s.pvCardTitle}>{totalPv} PV Credited</Text>
              <Text style={s.pvCardSub}>Added to your Filkart Wallet</Text>
            </View>
          </Animated.View>

          {/* Buttons */}
          <Animated.View style={[{ paddingHorizontal:24, gap:12, marginTop:8 }, { opacity: opacityAnim }]}>
            <TouchableOpacity style={s.trackBtn} onPress={onTrackOrder} activeOpacity={0.85}>
              <Text style={s.trackTxt}>Track My Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.continueBtn} onPress={onContinueShopping} activeOpacity={0.85}>
              <Text style={s.continueTxt}>Continue Shopping</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Suggested Products */}
          <Animated.View style={[{ marginTop:32, paddingHorizontal:20 }, { opacity: opacityAnim }]}>
            <Text style={s.suggestTitle}>You Might Also Like</Text>
            <FlatList
              data={suggested}
              keyExtractor={item => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={{ justifyContent:'space-between', marginBottom:14 }}
              renderItem={({ item: p }) => (
                <TouchableOpacity style={s.sugCard} onPress={() => onProductPress?.(p)} activeOpacity={0.88}>
                  <View style={s.sugImg}>
                    {p.image_url
                      ? <Image source={{ uri: p.image_url }} style={{ width:'100%', height:'100%' }} resizeMode="cover" />
                      : <LinearGradient colors={p.bg ?? ['#2E7D32','#1B5E20']} style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                          <Text style={{ fontSize:32 }}>{EMOJI[p.category]??'📦'}</Text>
                        </LinearGradient>}
                  </View>
                  <View style={{ padding:10 }}>
                    <Text style={s.sugName} numberOfLines={2}>{p.name}</Text>
                    <Text style={s.sugPrice}>{fmt(p.price)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </Animated.View>

        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex:1 },
  heroBg: { flex:1 },
  trophyRing: { width:140, height:140, borderRadius:70, backgroundColor:'#FFC107', alignItems:'center', justifyContent:'center', elevation:8, shadowColor:'#FFC107', shadowOpacity:0.5, shadowRadius:20 },
  trophyEmoji: { fontSize:72 },
  star: { fontSize:22, color:'#FFC107' },
  title: { fontSize:28, fontWeight:'900', color:'#111827', textAlign:'center', lineHeight:36, marginBottom:14 },
  sub: { fontSize:14, color:'#6B7280', textAlign:'center', lineHeight:22, marginBottom:12 },
  orderNum: { fontSize:13, fontWeight:'700', color:'#9CA3AF' },
  pvCard: { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#fff', borderRadius:18, marginHorizontal:24, marginTop:20, padding:18, borderWidth:1, borderColor:'#F0F0F0', elevation:3, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:8 },
  pvIcon: { width:48, height:48, borderRadius:24, backgroundColor:'#E8F5E9', alignItems:'center', justifyContent:'center' },
  pvCardTitle: { fontSize:15, fontWeight:'800', color:'#111827' },
  pvCardSub: { fontSize:12, color:'#6B7280', marginTop:2 },
  trackBtn: { backgroundColor:'#FFC107', borderRadius:16, paddingVertical:16, alignItems:'center', elevation:3 },
  trackTxt: { fontSize:15, fontWeight:'900', color:'#1B5E20' },
  continueBtn: { borderWidth:2, borderColor:'#1B5E20', borderRadius:16, paddingVertical:15, alignItems:'center' },
  continueTxt: { fontSize:15, fontWeight:'800', color:'#1B5E20' },
  suggestTitle: { fontSize:18, fontWeight:'900', color:'#111827', marginBottom:14 },
  sugCard: { width:CARD_W, backgroundColor:'#fff', borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:'#F0F0F0', elevation:2 },
  sugImg: { width:'100%', height:CARD_W * 0.8, overflow:'hidden' },
  sugName: { fontSize:12, fontWeight:'700', color:'#111827', marginBottom:4, lineHeight:17 },
  sugPrice: { fontSize:13, fontWeight:'900', color:'#1B5E20' },
});
