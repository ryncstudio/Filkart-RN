import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Platform, ActivityIndicator, Alert, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getUserOrders, cancelOrder, subscribeToOrders } from '../lib/supabase';

const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
const fmt = n => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

const TABS = [
  { id: 'all',       label: 'All' },
  { id: 'placed',    label: 'Pending' }, // placed/pending
  { id: 'shipped',   label: 'Shipped' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function OrdersScreen({ userData, onBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [cancelling, setCancelling] = useState(null); // id of order being cancelled

  const loadOrders = useCallback(async () => {
    try {
      const data = await getUserOrders(userData?.userId);
      setOrders(data || []);
    } catch (e) {
      console.log('Error loading orders:', e);
    } finally {
      setLoading(false);
    }
  }, [userData?.userId]);

  useEffect(() => {
    loadOrders();
    if (!userData?.userId) return;
    const sub = subscribeToOrders(userData.userId, () => {
      loadOrders(); // Reload on any order change
    });
    return () => sub?.unsubscribe?.();
  }, [loadOrders, userData?.userId]);

  const handleCancel = (order) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? If paid via Filkart Wallet, the amount will be refunded.',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            setCancelling(order.id);
            try {
              await cancelOrder(order.id, userData?.userId);
              Alert.alert('Success', 'Order cancelled successfully.');
              loadOrders();
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to cancel order.');
            } finally {
              setCancelling(null);
            }
          }
        }
      ]
    );
  };

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'all') return true;
    if (activeTab === 'placed' && (o.status === 'placed' || o.status === 'pending')) return true;
    return o.status === activeTab;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#1B5E20';
      case 'shipped':   return '#0284C7';
      case 'cancelled': return '#DC2626';
      default:          return '#D97706'; // placed/pending
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      {/* Header */}
      <LinearGradient colors={['#1B5E20', '#2E7D32']} style={[s.header, { paddingTop: STATUS_H + 6 }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Orders</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      {/* Tabs */}
      <View style={s.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[s.tabTxt, active && s.tabTxtActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1B5E20" />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text>
          <Text style={s.emptyTxt}>No orders found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {filteredOrders.map(order => {
            const isPending = order.status === 'placed' || order.status === 'pending';
            const dateStr = new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
            
            return (
              <View key={order.id} style={s.card}>
                {/* Card Header */}
                <View style={s.cardHeader}>
                  <Text style={s.orderDate}>{dateStr}</Text>
                  <Text style={[s.statusBadge, { color: getStatusColor(order.status) }]}>
                    {order.status.toUpperCase()}
                  </Text>
                </View>

                {/* Items */}
                <View style={s.itemsWrap}>
                  {(order.order_items || []).map((item, idx) => (
                    <View key={idx} style={s.itemRow}>
                      <View style={s.itemImgWrap}>
                        <Text style={{ fontSize: 20 }}>📦</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemName} numberOfLines={1}>{item.product_name}</Text>
                        <Text style={s.itemMeta}>x{item.quantity}  {item.size ? `· ${item.size}` : ''}</Text>
                      </View>
                      <Text style={s.itemPrice}>{fmt(item.price)}</Text>
                    </View>
                  ))}
                </View>

                {/* Card Footer */}
                <View style={s.cardFooter}>
                  <View>
                    <Text style={s.totalLabel}>Order Total</Text>
                    <Text style={s.totalAmt}>{fmt(order.total)}</Text>
                  </View>
                  
                  {isPending && (
                    <TouchableOpacity 
                      style={[s.cancelBtn, cancelling === order.id && { opacity: 0.5 }]} 
                      onPress={() => handleCancel(order)}
                      disabled={cancelling === order.id}
                    >
                      {cancelling === order.id ? <ActivityIndicator size="small" color="#DC2626" /> : <Text style={s.cancelTxt}>Cancel Order</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F4' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  
  tabsWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabsScroll: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: '#1B5E20' },
  tabTxt: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTxtActive: { color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },

  list: { padding: 16, gap: 14 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0', elevation: 2, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  orderDate: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  statusBadge: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  
  itemsWrap: { padding: 14, gap: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemImgWrap: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  itemMeta: { fontSize: 12, color: '#6B7280' },
  itemPrice: { fontSize: 14, fontWeight: '800', color: '#1B5E20' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  totalLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1 },
  totalAmt: { fontSize: 16, fontWeight: '900', color: '#111827' },
  
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  cancelTxt: { fontSize: 13, fontWeight: '700', color: '#DC2626' }
});
