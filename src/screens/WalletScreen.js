import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Platform, Modal, TextInput, Animated, ActivityIndicator, Alert, KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getWalletFull, getWalletTransactions, requestWithdrawal,
  convertToCredits, subscribeToWallet, subscribeToWalletTransactions,
} from '../lib/supabase';

const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
const fmt = n => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

const MOP_OPTIONS = [
  { id: 'gcash', label: 'GCash', emoji: '💛' },
  { id: 'maya',  label: 'Maya',  emoji: '💚' },
  { id: 'bank_transfer', label: 'Bank Transfer', emoji: '🏦' },
];

const TXN_LABELS = {
  purchase_bonus:  'Purchase Bonus',
  direct_referral: 'Direct Referral Bonus',
  partner_referral:'Partner Seller Referral',
  withdrawal:      'Withdrawal',
  convert:         'Convert to Credits',
  credit_spend:    'Credits Spent',
};

// ── Withdrawal Modal ────────────────────────────────────────────────────────────
function WithdrawalModal({ visible, walletType, availableBalance, userId, onClose, onSuccess }) {
  const [amount, setAmount]   = useState('');
  const [mop,    setMop]      = useState('gcash');
  const [acctName, setAcctName]   = useState('');
  const [acctNum,  setAcctNum]    = useState('');
  const [bankName, setBankName]   = useState('');
  const [loading,  setLoading]    = useState(false);
  const slideY = useRef(new Animated.Value(700)).current;

  useEffect(() => {
    Animated.spring(slideY, { toValue: visible ? 0 : 700, useNativeDriver: true, tension: 65, friction: 12 }).start();
    if (!visible) { setAmount(''); setMop('gcash'); setAcctName(''); setAcctNum(''); setBankName(''); }
  }, [visible]);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid Amount', 'Enter a valid amount.'); return; }
    if (amt > availableBalance) { Alert.alert('Insufficient Balance', `Max: ${fmt(availableBalance)}`); return; }
    if (!acctName || !acctNum) { Alert.alert('Missing Info', 'Fill in account details.'); return; }
    setLoading(true);
    try {
      await requestWithdrawal({ userId, walletType, amount: amt, mop, accountName: acctName, accountNumber: acctNum, bankName: mop === 'bank_transfer' ? bankName : null });
      onSuccess();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={wS.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[wS.sheet, { transform: [{ translateY: slideY }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={wS.handle} />
          <Text style={wS.title}>Withdraw Funds</Text>
          <Text style={wS.available}>Available: {fmt(availableBalance)}</Text>

          <Text style={wS.label}>Amount</Text>
          <TextInput style={wS.input} placeholder="₱0.00" keyboardType="numeric" value={amount} onChangeText={setAmount} />

          <Text style={wS.label}>Payment Method</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {MOP_OPTIONS.map(o => (
              <TouchableOpacity key={o.id} style={[wS.mopPill, mop === o.id && wS.mopPillOn]} onPress={() => setMop(o.id)}>
                <Text style={{ fontSize: 14 }}>{o.emoji}</Text>
                <Text style={[wS.mopTxt, mop === o.id && { color: '#fff' }]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={wS.label}>Account Name</Text>
          <TextInput style={wS.input} placeholder="Full name" value={acctName} onChangeText={setAcctName} />
          <Text style={wS.label}>Account Number</Text>
          <TextInput style={wS.input} placeholder="0000 0000 0000" keyboardType="numeric" value={acctNum} onChangeText={setAcctNum} />

          {mop === 'bank_transfer' && (
            <>
              <Text style={wS.label}>Bank Name</Text>
              <TextInput style={wS.input} placeholder="e.g. BDO, BPI, UnionBank" value={bankName} onChangeText={setBankName} />
            </>
          )}

          <TouchableOpacity style={[wS.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#1B5E20" /> : <Text style={wS.submitTxt}>Submit Withdrawal Request</Text>}
          </TouchableOpacity>
          <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>Processing: 1–3 business days</Text>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ── Convert to Credits Modal ─────────────────────────────────────────────────────
function ConvertModal({ visible, shareEarnBalance, userId, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const slideY = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    Animated.spring(slideY, { toValue: visible ? 0 : 500, useNativeDriver: true, tension: 65, friction: 12 }).start();
    if (!visible) setAmount('');
  }, [visible]);

  const handleConvert = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    if (amt > shareEarnBalance) { Alert.alert('Insufficient', `Max: ${fmt(shareEarnBalance)}`); return; }
    setLoading(true);
    try { await convertToCredits(userId, amt); onSuccess(); }
    catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={wS.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[wS.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={wS.handle} />
        <Text style={wS.title}>Convert to Credits</Text>
        <Text style={wS.available}>Available Share & Earn: {fmt(shareEarnBalance)}</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 14, lineHeight: 18 }}>
          Credits will be added to your Unilevel Wallet and can be used for eligible purchases.
        </Text>
        <Text style={wS.label}>Amount to Convert</Text>
        <TextInput style={wS.input} placeholder="₱0.00" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <TouchableOpacity style={[wS.submitBtn, loading && { opacity: 0.7 }]} onPress={handleConvert} disabled={loading}>
          {loading ? <ActivityIndicator color="#1B5E20" /> : <Text style={wS.submitTxt}>Confirm Convert</Text>}
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ── Transaction Row ────────────────────────────────────────────────────────────
function TxnRow({ txn }) {
  const isNeg   = txn.amount < 0;
  const dateStr = new Date(txn.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <View style={tS.row}>
      <View style={{ flex: 1 }}>
        <Text style={tS.date}>{dateStr.toUpperCase()}</Text>
        <Text style={tS.label}>{TXN_LABELS[txn.transaction_type] ?? txn.transaction_type}</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
          {txn.source_label && <View><Text style={tS.metaKey}>SOURCE</Text><Text style={tS.metaVal}>{txn.source_label}</Text></View>}
          {txn.level != null && <View><Text style={tS.metaKey}>LEVEL</Text><Text style={tS.metaVal}>Level {txn.level}</Text></View>}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={[tS.badge, txn.status === 'pending' ? tS.badgePending : tS.badgeDone]}>
          <Text style={[tS.badgeTxt, txn.status === 'pending' ? { color: '#D97706' } : { color: '#1B5E20' }]}>
            {(txn.status ?? 'completed').toUpperCase()}
          </Text>
        </View>
        <Text style={[tS.amount, isNeg ? tS.amountNeg : tS.amountPos]}>
          {isNeg ? '-' : '+'}₱{Math.abs(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function WalletScreen({ userData, onBack, onHome, onNetwork, onMarket }) {
  const [wallet,     setWallet]     = useState(null);
  const [txns,       setTxns]       = useState([]);
  const [txnTab,     setTxnTab]     = useState('unilevel');
  const [loading,    setLoading]    = useState(true);
  const [showWithdrawType, setShowWithdrawType] = useState(null); // 'unilevel_cash' | 'share_earn'
  const [showConvert,      setShowConvert]      = useState(false);
  const walletChRef = useRef(null);
  const txnsChRef   = useRef(null);

  const load = useCallback(async () => {
    const uid = userData?.userId;
    const [w, t] = await Promise.all([
      getWalletFull(uid),
      getWalletTransactions(uid, txnTab),
    ]);
    setWallet(w);
    setTxns(t);
    setLoading(false);
  }, [userData?.userId, txnTab]);

  useEffect(() => {
    load();
    const uid = userData?.userId;
    walletChRef.current = subscribeToWallet(uid, updated => setWallet(prev => ({ ...prev, ...updated })));
    txnsChRef.current   = subscribeToWalletTransactions(uid, newTxn => setTxns(prev => [newTxn, ...prev]));
    return () => { walletChRef.current?.unsubscribe?.(); txnsChRef.current?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!loading) getWalletTransactions(userData?.userId, txnTab).then(setTxns);
  }, [txnTab]);

  const uniTotal   = Number(wallet?.unilevel_cash ?? 0) + Number(wallet?.unilevel_credits ?? 0);
  const uniCash    = Number(wallet?.unilevel_cash    ?? 0);
  const uniCredits = Number(wallet?.unilevel_credits ?? 0);
  const shareEarn  = Number(wallet?.share_earn       ?? 0);

  const TABS = [
    { id: 'home', icon: '🏠', label: 'Home' }, { id: 'market', icon: '🏪', label: 'Market' },
    { id: 'wallet', icon: '💳', label: 'Wallet' }, { id: 'network', icon: '👥', label: 'Network' },
    { id: 'profile', icon: '🪪', label: 'Profile' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F4" />

      <WithdrawalModal
        visible={!!showWithdrawType}
        walletType={showWithdrawType ?? 'unilevel_cash'}
        availableBalance={showWithdrawType === 'share_earn' ? shareEarn : uniCash}
        userId={userData?.userId}
        onClose={() => setShowWithdrawType(null)}
        onSuccess={() => { setShowWithdrawType(null); load(); Alert.alert('Request Submitted ✅', 'Your withdrawal is pending admin approval.'); }}
      />
      <ConvertModal
        visible={showConvert}
        shareEarnBalance={shareEarn}
        userId={userData?.userId}
        onClose={() => setShowConvert(false)}
        onSuccess={() => { setShowConvert(false); load(); }}
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: STATUS_H + 8, justifyContent: 'center' }]}>
        <Text style={[s.headerTitle, { textAlign: 'center' }]}>Your Wallets</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* ── Unilevel Wallet Card ── */}
        <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} style={s.uniCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={s.cardLabel}>Unilevel Wallet</Text>
              {loading ? <ActivityIndicator color="#fff" style={{ marginVertical: 8 }} /> : <Text style={s.cardAmount}>{fmt(uniTotal)}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={s.splitPill}>
                  <Text style={s.splitPillLabel}>💵 Cash</Text>
                  <Text style={s.splitPillAmt}>{fmt(uniCash)}</Text>
                </View>
                <View style={[s.splitPill, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Text style={s.splitPillLabel}>🪙 Credits</Text>
                  <Text style={s.splitPillAmt}>{fmt(uniCredits)}</Text>
                </View>
              </View>
            </View>
            <View style={s.cardIcon}><Text style={{ fontSize: 22 }}>📊</Text></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity style={s.cardBtnWhite} onPress={() => setShowWithdrawType('unilevel_cash')} activeOpacity={0.85}>
              <Text style={s.cardBtnWhiteTxt}>Withdraw Cash</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.cardNote}>Credits cannot be used for Basic Needs or Farm to Table items.</Text>
        </LinearGradient>

        {/* ── Share & Earn Card ── */}
        <LinearGradient colors={['#F59E0B', '#D97706', '#B45309']} style={s.shareCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={s.cardLabel}>Share & Earn Wallet</Text>
              {loading ? <ActivityIndicator color="#fff" style={{ marginVertical: 8 }} /> : <Text style={s.cardAmount}>{fmt(shareEarn)}</Text>}
              <Text style={[s.cardNote, { marginTop: 6 }]}>100% withdrawable · No restrictions</Text>
            </View>
            <View style={s.cardIcon}><Text style={{ fontSize: 22 }}>📈</Text></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity style={s.cardBtnWhite} onPress={() => setShowWithdrawType('share_earn')} activeOpacity={0.85}>
              <Text style={s.cardBtnWhiteTxt}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cardBtnOutline} onPress={() => setShowConvert(true)} activeOpacity={0.85}>
              <Text style={s.cardBtnOutlineTxt}>Convert to Credits</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── How You Earn ── */}
        <View style={s.earnCard}>
          <Text style={s.earnTitle}>How You Earn</Text>
          <View style={s.earnRow}><Text style={{ fontSize: 16 }}>🛒</Text><View style={{ flex: 1 }}><Text style={s.earnLabel}>Purchase Bonus</Text><Text style={s.earnSub}>5 pts per ₱1,000 spent · split 50% cash / 50% credits</Text></View></View>
          <View style={s.earnRow}><Text style={{ fontSize: 16 }}>🤝</Text><View style={{ flex: 1 }}><Text style={s.earnLabel}>Affiliate Referral</Text><Text style={s.earnSub}>₱100 credited to Share & Earn</Text></View></View>
          <View style={s.earnRow}><Text style={{ fontSize: 16 }}>🏪</Text><View style={{ flex: 1 }}><Text style={s.earnLabel}>Partner Seller Referral</Text><Text style={s.earnSub}>₱200 credited to Share & Earn</Text></View></View>
        </View>

        {/* ── Transactions ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={s.sectionTitle}>Recent Transactions</Text>
        </View>
        <View style={s.tabRow}>
          {['unilevel', 'share'].map(t => (
            <TouchableOpacity key={t} style={[s.tab, txnTab === t && s.tabOn]} onPress={() => setTxnTab(t)}>
              <Text style={[s.tabTxt, txnTab === t && s.tabTxtOn]}>{t === 'unilevel' ? 'Unilevel' : 'Share & Earn'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <ActivityIndicator color="#1B5E20" style={{ marginTop: 20 }} /> : txns.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>📭</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151' }}>No transactions yet</Text>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Your earnings will appear here</Text>
          </View>
        ) : txns.map(t => <TxnRow key={t.id} txn={t} />)}

      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={s.tabBar}>
        {TABS.map(tab => {
          const active = tab.id === 'wallet';
          return (
            <TouchableOpacity key={tab.id} style={s.tabItem} onPress={() => {
              if (tab.id === 'home')    onHome?.();
              if (tab.id === 'market') onMarket?.();
              if (tab.id === 'network') onNetwork?.();
            }}>
              <Text style={[s.tabIcon, active && s.tabActive]}>{tab.icon}</Text>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F4' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  uniCard: { borderRadius: 20, padding: 20, marginBottom: 14, elevation: 6, shadowColor: '#1B5E20', shadowOpacity: 0.3, shadowRadius: 12 },
  shareCard: { borderRadius: 20, padding: 20, marginBottom: 14, elevation: 6, shadowColor: '#F59E0B', shadowOpacity: 0.3, shadowRadius: 12 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 1, marginBottom: 4 },
  cardAmount: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  splitPill: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  splitPillLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 },
  splitPillAmt: { fontSize: 13, fontWeight: '900', color: '#fff', marginTop: 2 },
  cardBtnWhite: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  cardBtnWhiteTxt: { fontSize: 13, fontWeight: '800', color: '#1B5E20' },
  cardBtnOutline: { flex: 1, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  cardBtnOutlineTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
  cardNote: { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 10, lineHeight: 15 },
  earnCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0F0F0', elevation: 1 },
  earnTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 12 },
  earnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  earnLabel: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 2 },
  earnSub: { fontSize: 11, color: '#9CA3AF', lineHeight: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 11 },
  tabOn: { backgroundColor: '#1B5E20' },
  tabTxt: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  tabTxtOn: { color: '#fff' },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingBottom: 20, paddingTop: 10, elevation: 12 },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon: { fontSize: 20, color: '#9CA3AF' },
  tabActive: { color: '#1B5E20' },
  tabLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  tabLabelActive: { color: '#1B5E20', fontWeight: '700' },
});

const wS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '900', color: '#111827', marginBottom: 4 },
  available: { fontSize: 13, color: '#1B5E20', fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, color: '#111', marginBottom: 14 },
  mopPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  mopPillOn: { backgroundColor: '#1B5E20', borderColor: '#1B5E20' },
  mopTxt: { fontSize: 11, fontWeight: '700', color: '#374151' },
  submitBtn: { backgroundColor: '#FFC107', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  submitTxt: { fontSize: 15, fontWeight: '900', color: '#1B5E20' },
});

const tS = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0F0F0', elevation: 1 },
  date: { fontSize: 9, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5, marginBottom: 3 },
  label: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 2 },
  metaKey: { fontSize: 8, color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.8 },
  metaVal: { fontSize: 11, fontWeight: '600', color: '#374151' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDone: { backgroundColor: '#E8F5E9' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeTxt: { fontSize: 9, fontWeight: '800' },
  amount: { fontSize: 15, fontWeight: '900' },
  amountPos: { color: '#1B5E20' },
  amountNeg: { color: '#EF4444' },
});
