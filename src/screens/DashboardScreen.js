import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function DashboardScreen({ onLogout }) {
  return (
    <LinearGradient colors={['#1B4332', '#2d6a4f']} style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <Text style={styles.emoji}>🛒</Text>
      <Text style={styles.text}>Welcome to FilKart!</Text>
      <Text style={styles.sub}>Your Dashboard is coming soon…</Text>
      <TouchableOpacity style={styles.btn} onPress={onLogout}>
        <Text style={styles.btnText}>Log Out</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emoji: { fontSize: 56, marginBottom: 16 },
  text:  { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 8 },
  sub:   { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 36 },
  btn:   { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
