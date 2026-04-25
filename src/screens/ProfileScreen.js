import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Share, Alert, ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getCurrentUserProfile, getWalletFull, getNetworkCountByLevel, signOut,
} from '../lib/supabase';

const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
const fmtMoney = n => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:0})}`;

const RANKS = [
  { name:'Starter',           emoji:'⭐', color:'#9CA3AF', min:0,    nextName:'Bronze Director',   nextMin:10   },
  { name:'Bronze Director',   emoji:'🥉', color:'#CD7F32', min:10,   nextName:'Silver Director',   nextMin:50   },
  { name:'Silver Director',   emoji:'🥈', color:'#64748B', min:50,   nextName:'Gold Director',     nextMin:200  },
  { name:'Gold Director',     emoji:'✨', color:'#D97706', min:200,  nextName:'Platinum Director', nextMin:1000 },
  { name:'Platinum Director', emoji:'💎', color:'#7C3AED', min:1000, nextName:null,                nextMin:null },
];
function getRank(n) {
  for (let i = RANKS.length-1; i >= 0; i--) { if (n >= RANKS[i].min) return RANKS[i]; }
  return RANKS[0];
}

const TABS = [
  {id:'home',icon:'🏠',label:'Home'},{id:'market',icon:'🏪',label:'Market'},
  {id:'wallet',icon:'💳',label:'Wallet'},{id:'network',icon:'👥',label:'Network'},
  {id:'profile',icon:'🪪',label:'Profile'},
];

const MENU = [
  {id:'orders',  icon:'📦', label:'My Orders & History',  bg:'#E0F2FE', color:'#0369A1'},
  {id:'info',    icon:'👤', label:'Personal Information', bg:'#E8F5E9', color:'#1B5E20'},
  {id:'security',icon:'🛡️', label:'Security & Privacy',   bg:'#EFF6FF', color:'#1565C0'},
  {id:'kyc',     icon:'✅', label:'KYC Verification',     bg:'#FFFDE7', color:'#D97706'},
  {id:'rewards', icon:'🎖️', label:'Rewards & Bonuses',    bg:'#F5F3FF', color:'#7C3AED'},
  {id:'support', icon:'💬', label:'Support Center',       bg:'#F0FDFA', color:'#0D9488'},
];

export default function ProfileScreen({ userData, onHome, onMarket, onWallet, onNetwork, onPersonalInfo, onOrders }) {
  const [profile,  setProfile]  = useState(null);
  const [wallet,   setWallet]   = useState(null);
  const [network,  setNetwork]  = useState(0);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    const uid = userData?.userId;
    const [prof, wal, ...counts] = await Promise.all([
      getCurrentUserProfile().catch(() => null),
      getWalletFull(uid).catch(() => null),
      ...[1,2,3,4,5].map(l => getNetworkCountByLevel(uid, l).catch(() => 0)),
    ]);
    setProfile(prof);
    setWallet(wal);
    setNetwork(counts.reduce((s,c) => s + (c||0), 0));
    setLoading(false);
  }, [userData?.userId]);

  useEffect(() => { load(); }, []);

  const totalEarnings = Number(wallet?.unilevel_cash||0) + Number(wallet?.unilevel_credits||0) + Number(wallet?.share_earn||0);
  const rank       = getRank(network);
  const progress   = rank.nextMin ? Math.min(100, Math.round(((network-rank.min)/(rank.nextMin-rank.min))*100)) : 100;
  const displayName = profile?.full_name || profile?.username || 'Filkart Member';
  const username   = profile?.username || '';
  const referralCode = profile?.referral_code || '—';
  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-PH',{month:'2-digit',year:'numeric'})
    : '—';
  const isVerified  = profile?.kyc_status === 'approved';
  const kycStatus   = profile?.kyc_status || 'pending';

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    Alert.alert('Copied! 📋', `Referral code ${referralCode} copied to clipboard.`);
  };

  const handleShare = () => Share.share({
    message: `Join me on Filkart! Use my referral code: ${referralCode} when you sign up.`,
  });

  const handleLogout = () => Alert.alert('Log Out', 'Are you sure?', [
    { text:'Cancel', style:'cancel' },
    { text:'Log Out', style:'destructive', onPress: () => signOut() },
  ]);

  const kycBadge = () => {
    if (kycStatus==='approved') return <View style={[s.kycPill,{backgroundColor:'#E8F5E9'}]}><Text style={[s.kycPillTxt,{color:'#1B5E20'}]}>✓ Completed</Text></View>;
    if (kycStatus==='pending')  return <View style={[s.kycPill,{backgroundColor:'#FEF3C7'}]}><Text style={[s.kycPillTxt,{color:'#D97706'}]}>Pending</Text></View>;
    return <View style={[s.kycPill,{backgroundColor:'#FEE2E2'}]}><Text style={[s.kycPillTxt,{color:'#DC2626'}]}>Action Required</Text></View>;
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:100}}>

        {/* ── Hero ── */}
        <LinearGradient colors={['#1B5E20','#2E7D32','#33691E']} style={s.hero}>
          <View style={{height: STATUS_H}} />
          <View style={s.heroTop}>
            <View style={{width:38}} />
            <Text style={s.heroTitle}>Account Profile</Text>
            <TouchableOpacity style={s.settingsBtn}><Text style={{fontSize:18}}>⚙️</Text></TouchableOpacity>
          </View>

          <View style={s.avatarWrap}>
            <LinearGradient colors={['#FFC107','#D97706']} style={s.avatarRing}>
              <View style={s.avatarInner}>
                <Text style={s.avatarLetter}>{displayName[0]?.toUpperCase()||'?'}</Text>
              </View>
            </LinearGradient>
            {isVerified && (
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedTxt}>✓ VERIFIED</Text>
              </View>
            )}
          </View>

          <Text style={s.heroName}>{loading ? '...' : displayName}</Text>
          <View style={[s.rankBadge,{borderColor:rank.color}]}>
            <Text style={{fontSize:13}}>{rank.emoji}</Text>
            <Text style={[s.rankTxt,{color:rank.color}]}>{rank.name}</Text>
          </View>
          <View style={{height:24}} />
        </LinearGradient>

        {/* ── Referral Card ── */}
        <View style={s.referralCard}>
          <View style={{flex:1}}>
            <Text style={s.refLabel}>YOUR REFERRAL CODE</Text>
            <Text style={s.refCode} numberOfLines={1}>{referralCode}</Text>
          </View>
          <TouchableOpacity style={s.copyBtn} onPress={handleCopy} activeOpacity={0.85}>
            <Text style={s.copyTxt}>📋 Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Text style={s.shareTxt}>📤 Share</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats ── */}
        <View style={s.statsCard}>
          {[
            {val: loading ? null : fmtMoney(totalEarnings), label:'EARNINGS'},
            {val: loading ? null : network.toLocaleString(),  label:'NETWORK'},
            {val: joinedDate,                                 label:'JOINED'},
          ].map((st,i) => (
            <React.Fragment key={i}>
              {i>0 && <View style={s.statDiv}/>}
              <View style={s.statItem}>
                {st.val===null
                  ? <ActivityIndicator color="#1B5E20" size="small"/>
                  : <Text style={s.statVal}>{st.val}</Text>}
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* ── Rank Progress ── */}
        {rank.nextName && (
          <View style={s.progCard}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
              <Text style={s.progCurrent}>{rank.name}</Text>
              <Text style={s.progTarget}>{progress}% to {rank.nextName}</Text>
            </View>
            <View style={s.progTrack}>
              <View style={[s.progFill,{width:`${progress}%`,backgroundColor:rank.color}]}/>
            </View>
            <Text style={s.progSub}>{network} / {rank.nextMin} members needed</Text>
          </View>
        )}

        {/* ── Menu ── */}
        <Text style={s.sectionLabel}>ACCOUNT MANAGEMENT</Text>
        <View style={s.menuCard}>
          {MENU.map((item,idx) => (
            <TouchableOpacity
              key={item.id}
              style={[s.menuRow, idx<MENU.length-1 && s.menuBorder]}
              onPress={() => { 
                if(item.id==='info') onPersonalInfo?.(); 
                if(item.id==='orders') onOrders?.();
              }}
              activeOpacity={0.7}
            >
              <View style={[s.menuIcon,{backgroundColor:item.bg}]}>
                <Text style={{fontSize:18}}>{item.icon}</Text>
              </View>
              <Text style={s.menuLabel}>{item.label}</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                {item.id==='kyc' && kycBadge()}
                <Text style={s.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={s.logoutTxt}>↪  Logout Account</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Tab Bar ── */}
      <View style={s.tabBar}>
        {TABS.map(tab => {
          const active = tab.id==='profile';
          return (
            <TouchableOpacity key={tab.id} style={s.tabItem} activeOpacity={0.7} onPress={() => {
              if(tab.id==='home')    onHome?.();
              if(tab.id==='market') onMarket?.();
              if(tab.id==='wallet') onWallet?.();
              if(tab.id==='network') onNetwork?.();
            }}>
              <Text style={[s.tabIcon, active&&s.tabActive]}>{tab.icon}</Text>
              <Text style={[s.tabLabel, active&&s.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:'#F4F6F4'},
  hero:{paddingHorizontal:20,alignItems:'center'},
  heroTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',width:'100%',marginBottom:20},
  heroTitle:{fontSize:17,fontWeight:'800',color:'#fff'},
  settingsBtn:{width:38,height:38,borderRadius:19,backgroundColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center'},
  avatarWrap:{alignItems:'center',marginBottom:10},
  avatarRing:{width:104,height:104,borderRadius:52,padding:3,marginBottom:8},
  avatarInner:{flex:1,borderRadius:50,backgroundColor:'rgba(0,0,0,0.3)',alignItems:'center',justifyContent:'center'},
  avatarLetter:{fontSize:40,fontWeight:'900',color:'#fff'},
  verifiedBadge:{backgroundColor:'#FFC107',borderRadius:14,paddingHorizontal:12,paddingVertical:4,marginTop:-6},
  verifiedTxt:{fontSize:10,fontWeight:'800',color:'#1B5E20',letterSpacing:1},
  heroName:{fontSize:26,fontWeight:'900',color:'#fff',marginTop:8,marginBottom:10},
  rankBadge:{flexDirection:'row',alignItems:'center',gap:6,borderWidth:1.5,borderRadius:24,paddingHorizontal:16,paddingVertical:7,backgroundColor:'rgba(0,0,0,0.25)'},
  rankTxt:{fontSize:13,fontWeight:'800',letterSpacing:0.5},
  referralCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#fff',marginHorizontal:16,marginTop:-1,borderRadius:16,padding:14,elevation:6,shadowColor:'#1B5E20',shadowOpacity:0.15,shadowRadius:10,gap:10},
  refLabel:{fontSize:9,fontWeight:'700',color:'#9CA3AF',letterSpacing:1.2,marginBottom:3},
  refCode:{fontSize:18,fontWeight:'900',color:'#1B5E20',letterSpacing:2},
  copyBtn:{backgroundColor:'#E8F5E9',borderRadius:12,paddingHorizontal:14,paddingVertical:10},
  copyTxt:{fontSize:12,fontWeight:'800',color:'#1B5E20'},
  shareBtn:{backgroundColor:'#1B5E20',borderRadius:12,paddingHorizontal:14,paddingVertical:10},
  shareTxt:{fontSize:12,fontWeight:'800',color:'#fff'},
  statsCard:{flexDirection:'row',backgroundColor:'#fff',marginHorizontal:16,marginTop:12,borderRadius:16,paddingVertical:18,elevation:2,borderWidth:1,borderColor:'#F0F0F0'},
  statItem:{flex:1,alignItems:'center'},
  statVal:{fontSize:17,fontWeight:'900',color:'#111827',marginBottom:4},
  statLabel:{fontSize:9,fontWeight:'700',color:'#9CA3AF',letterSpacing:1.2},
  statDiv:{width:1,backgroundColor:'#F0F0F0'},
  progCard:{backgroundColor:'#fff',marginHorizontal:16,marginTop:12,borderRadius:16,padding:16,borderWidth:1,borderColor:'#F0F0F0',elevation:1},
  progCurrent:{fontSize:12,fontWeight:'700',color:'#374151'},
  progTarget:{fontSize:11,fontWeight:'700',color:'#1B5E20'},
  progTrack:{height:8,backgroundColor:'#F0F0F0',borderRadius:4,overflow:'hidden',marginBottom:6},
  progFill:{height:'100%',borderRadius:4},
  progSub:{fontSize:10,color:'#9CA3AF'},
  sectionLabel:{fontSize:10,fontWeight:'700',color:'#9CA3AF',letterSpacing:2,marginHorizontal:20,marginTop:20,marginBottom:10},
  menuCard:{backgroundColor:'#fff',marginHorizontal:16,borderRadius:16,elevation:2,borderWidth:1,borderColor:'#F0F0F0',overflow:'hidden'},
  menuRow:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:16,gap:14},
  menuBorder:{borderBottomWidth:1,borderBottomColor:'#F3F4F6'},
  menuIcon:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'},
  menuLabel:{flex:1,fontSize:14,fontWeight:'700',color:'#111827'},
  chevron:{fontSize:20,color:'#9CA3AF'},
  kycPill:{borderRadius:10,paddingHorizontal:8,paddingVertical:3},
  kycPillTxt:{fontSize:9,fontWeight:'800'},
  logoutBtn:{marginHorizontal:16,marginTop:16,backgroundColor:'#FEE2E2',borderRadius:16,paddingVertical:18,alignItems:'center'},
  logoutTxt:{fontSize:15,fontWeight:'800',color:'#DC2626'},
  tabBar:{position:'absolute',bottom:0,left:0,right:0,flexDirection:'row',backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#F3F4F6',paddingBottom:20,paddingTop:10,elevation:12},
  tabItem:{flex:1,alignItems:'center',gap:3},
  tabIcon:{fontSize:20,color:'#9CA3AF'},
  tabActive:{color:'#1B5E20'},
  tabLabel:{fontSize:10,color:'#9CA3AF',fontWeight:'500'},
  tabLabelActive:{color:'#1B5E20',fontWeight:'700'},
});
