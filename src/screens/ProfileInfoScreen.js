import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Platform, TextInput, Alert, ActivityIndicator, Linking, KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentUserProfile, updateUserProfile } from '../lib/supabase';

const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

// ⚠️ Update this URL when you have an EAS build or hosted APK link
const APK_DOWNLOAD_URL = 'https://expo.dev/artifacts/eas/your-build-link-here';

const MOP_OPTIONS = [
  { id:'gcash', label:'GCash',         emoji:'💛' },
  { id:'maya',  label:'Maya',          emoji:'💚' },
  { id:'bank',  label:'Bank Transfer', emoji:'🏦' },
];

function Field({ label, value, onChangeText, keyboardType, editable = true, placeholder }) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <TextInput
        style={[f.input, !editable && f.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        editable={editable}
        placeholder={placeholder || ''}
        placeholderTextColor="#9CA3AF"
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function ProfileInfoScreen({ userData, onBack }) {
  const [fullName,   setFullName]   = useState('');
  const [username,   setUsername]   = useState('');
  const [mobile,     setMobile]     = useState('');
  const [email,      setEmail]      = useState('');
  const [birthday,   setBirthday]   = useState('');
  const [payMop,     setPayMop]     = useState('gcash');
  const [payName,    setPayName]    = useState('');
  const [payNumber,  setPayNumber]  = useState('');
  const [payBank,    setPayBank]    = useState('');
  const [referrer,   setReferrer]   = useState('');
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    getCurrentUserProfile().then(prof => {
      if (!prof) return;
      setFullName(prof.full_name   || '');
      setUsername(prof.username    || '');
      setMobile(  prof.phone       || '');
      setEmail(   prof.email       || '');
      setBirthday(prof.birthday    || '');
      setPayMop(  prof.payout_mop  || 'gcash');
      setPayName( prof.payout_account_name   || '');
      setPayNumber(prof.payout_account_number || '');
      setPayBank( prof.payout_bank_name      || '');
      setReferrer(prof.referrer_username || '');
    }).catch(()=>{}).finally(() => setLoading(false));
  }, []);

  const referralLink = `filkart.com/ref/${username || (userData?.userId||'').slice(0,8)}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile(userData?.userId, {
        full_name:              fullName,
        username:               username.trim().toLowerCase(),
        phone:                  mobile,
        birthday:               birthday || null,
        payout_mop:             payMop,
        payout_account_name:    payName,
        payout_account_number:  payNumber,
        payout_bank_name:       payMop === 'bank' ? payBank : null,
      });
      Alert.alert('Saved ✅', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save changes.');
    } finally { setSaving(false); }
  };

  const handleDownloadAPK = () => Linking.openURL(APK_DOWNLOAD_URL).catch(() => Alert.alert('Error', 'Could not open download link.'));

  if (loading) return (
    <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#F4F6F4'}}>
      <ActivityIndicator color="#1B5E20" size="large" />
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      {/* Header */}
      <LinearGradient colors={['#1B5E20','#2E7D32']} style={[s.header,{paddingTop: STATUS_H + 6}]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={{fontSize:20,color:'#fff',fontWeight:'700'}}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Personal Information</Text>
        <View style={{width:38}}/>
      </LinearGradient>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:16,paddingBottom:40}}>

          {/* Avatar */}
          <View style={s.avatarSection}>
            <View style={s.avatarRing}>
              <View style={s.avatarInner}>
                <Text style={s.avatarLetter}>{(fullName||username||'?')[0].toUpperCase()}</Text>
              </View>
              <View style={s.camBtn}><Text style={{fontSize:14}}>📷</Text></View>
            </View>
            <Text style={s.memberLabel}>Filkart Premium Member</Text>
            <Text style={s.memberSub}>Manage your account details</Text>
          </View>

          {/* Fields */}
          <View style={s.card}>
            <Field label="FULL NAME"     value={fullName}  onChangeText={setFullName}  placeholder="Your full name" />
            <Field label="USERNAME"      value={username}  onChangeText={setUsername}  placeholder="e.g. juandelacruz" />
            <Field label="MOBILE NUMBER" value={mobile}    onChangeText={setMobile}    keyboardType="phone-pad" placeholder="+63 9XX XXX XXXX" />
            <Field label="EMAIL ADDRESS" value={email}     onChangeText={()=>{}}       editable={false} placeholder="your@email.com" />
            <Field label="BIRTHDAY"      value={birthday}  onChangeText={setBirthday}  placeholder="YYYY-MM-DD" />
          </View>

          {referrer ? (
            <View style={s.referrerRow}>
              <Text style={s.referrerLabel}>Sponsored by:</Text>
              <Text style={s.referrerName}>@{referrer}</Text>
            </View>
          ) : null}

          {/* Save */}
          <TouchableOpacity style={[s.saveBtn, saving&&{opacity:0.7}]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#1B5E20"/> : <Text style={s.saveTxt}>Save Changes</Text>}
          </TouchableOpacity>
          <Text style={s.privacyNote}>Your data is secure and encrypted. Filkart values your privacy.</Text>

          {/* Referral Link */}
          <Text style={s.sectionLabel}>YOUR REFERRAL LINK</Text>
          <View style={s.refCard}>
            <Text style={s.refLink} numberOfLines={1}>{referralLink}</Text>
            <TouchableOpacity style={s.copyBtn} activeOpacity={0.8}
              onPress={() => Alert.alert('Link Ready 📋', `Your link:\n${referralLink}\n\nUse the Share button to send it!`)}>
              <Text style={s.copyTxt}>📋 Copy</Text>
            </TouchableOpacity>
          </View>

          {/* Payout Information */}
          <Text style={s.sectionLabel}>PAYOUT INFORMATION</Text>
          <View style={s.card}>
            <Text style={s.payLabel}>Payment Method</Text>
            <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
              {MOP_OPTIONS.map(o => (
                <TouchableOpacity key={o.id} style={[s.mopPill, payMop===o.id && s.mopPillOn]} onPress={()=>setPayMop(o.id)}>
                  <Text style={{fontSize:14}}>{o.emoji}</Text>
                  <Text style={[s.mopTxt, payMop===o.id&&{color:'#fff'}]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="ACCOUNT NAME"   value={payName}   onChangeText={setPayName}   placeholder="Full name on account" />
            <Field label="ACCOUNT NUMBER" value={payNumber} onChangeText={setPayNumber} keyboardType="numeric" placeholder="0000 0000 0000" />
            {payMop==='bank' && (
              <Field label="BANK NAME" value={payBank} onChangeText={setPayBank} placeholder="e.g. BDO, BPI, UnionBank" />
            )}
            <Text style={s.payNote}>This will auto-fill your withdrawal requests.</Text>
          </View>

          {/* Download APK */}
          <View style={s.apkCard}>
            <View style={{flex:1}}>
              <Text style={s.apkTitle}>Get the Filkart App</Text>
              <Text style={s.apkSub}>Experience the full power on your mobile device</Text>
            </View>
            <TouchableOpacity style={s.apkBtn} onPress={handleDownloadAPK} activeOpacity={0.85}>
              <Text style={s.apkBtnTxt}>⬇ Download APK Now</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:{flex:1,backgroundColor:'#F4F6F4'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:14},
  backBtn:{width:38,height:38,borderRadius:19,backgroundColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center'},
  headerTitle:{fontSize:17,fontWeight:'800',color:'#fff'},
  avatarSection:{alignItems:'center',paddingVertical:24},
  avatarRing:{width:90,height:90,borderRadius:45,borderWidth:3,borderColor:'#FFC107',padding:3,marginBottom:10},
  avatarInner:{flex:1,borderRadius:42,backgroundColor:'#1B5E20',alignItems:'center',justifyContent:'center'},
  avatarLetter:{fontSize:34,fontWeight:'900',color:'#fff'},
  camBtn:{position:'absolute',bottom:0,right:0,width:28,height:28,borderRadius:14,backgroundColor:'#FFC107',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#fff'},
  memberLabel:{fontSize:17,fontWeight:'800',color:'#1B5E20'},
  memberSub:{fontSize:12,color:'#9CA3AF',marginTop:3},
  card:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:16,borderWidth:1,borderColor:'#F0F0F0',elevation:2},
  sectionLabel:{fontSize:10,fontWeight:'700',color:'#9CA3AF',letterSpacing:1.5,marginBottom:8,marginTop:4},
  referrerRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:16,paddingHorizontal:4},
  referrerLabel:{fontSize:12,color:'#9CA3AF',fontWeight:'600'},
  referrerName:{fontSize:12,fontWeight:'800',color:'#1B5E20'},
  saveBtn:{backgroundColor:'#FFC107',borderRadius:16,paddingVertical:16,alignItems:'center',marginBottom:8},
  saveTxt:{fontSize:15,fontWeight:'900',color:'#1B5E20'},
  privacyNote:{fontSize:11,color:'#9CA3AF',textAlign:'center',marginBottom:20,lineHeight:16},
  refCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderRadius:14,padding:14,borderWidth:1.5,borderColor:'#E5E7EB',marginBottom:20,gap:10},
  refLink:{flex:1,fontSize:13,fontWeight:'700',color:'#374151'},
  copyBtn:{backgroundColor:'#1B5E20',borderRadius:10,paddingHorizontal:12,paddingVertical:8},
  copyTxt:{fontSize:12,fontWeight:'800',color:'#fff'},
  payLabel:{fontSize:10,fontWeight:'700',color:'#9CA3AF',letterSpacing:1,marginBottom:10},
  mopPill:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,paddingVertical:10,borderRadius:12,borderWidth:1.5,borderColor:'#E5E7EB'},
  mopPillOn:{backgroundColor:'#1B5E20',borderColor:'#1B5E20'},
  mopTxt:{fontSize:10,fontWeight:'700',color:'#374151'},
  payNote:{fontSize:10,color:'#9CA3AF',marginTop:4,lineHeight:15},
  apkCard:{backgroundColor:'#fff',borderRadius:16,padding:18,borderWidth:1,borderColor:'#F0F0F0',elevation:2,marginBottom:8},
  apkTitle:{fontSize:15,fontWeight:'800',color:'#1B5E20',marginBottom:4},
  apkSub:{fontSize:11,color:'#9CA3AF',lineHeight:16,marginBottom:14},
  apkBtn:{backgroundColor:'#FFC107',borderRadius:14,paddingVertical:14,alignItems:'center'},
  apkBtnTxt:{fontSize:14,fontWeight:'900',color:'#1B5E20'},
});

const f = StyleSheet.create({
  wrap:{marginBottom:14},
  label:{fontSize:10,fontWeight:'700',color:'#9CA3AF',letterSpacing:1,marginBottom:6},
  input:{borderWidth:1.5,borderColor:'#E5E7EB',borderRadius:12,paddingHorizontal:14,height:48,fontSize:14,color:'#111827',backgroundColor:'#fff'},
  inputDisabled:{backgroundColor:'#F9FAFB',color:'#9CA3AF'},
});
