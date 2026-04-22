import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

const { width } = Dimensions.get('window');

// ── Check icon (SVG-free, using Unicode) ──────────────────────────────────────
const CheckIcon = ({ gold }) => (
  <View style={[styles.checkCircle, gold && styles.checkCircleGold]}>
    <Text style={[styles.checkMark, gold && styles.checkMarkGold]}>✓</Text>
  </View>
);

export default function MembershipScreen({ onSelect }) {
  const [selected, setSelected] = useState(null);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  const handleSelect = (planId, amount) => {
    setSelected(planId);
    // Save plan_id and amount to session, navigate to Payment
    onSelect({ plan_id: planId, amount });
  };

  const affiliateFeatures = [
    'Standard commission rates',
    'Full access to marketplace',
    'Weekly payouts',
  ];

  const partnerFeatures = [
    'Higher commission rates',
    'Priority dedicated support',
    'Network spillover eligibility',
    'Advanced analytics dashboard',
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FBF9" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.label}>Filkart Subscriptions</Text>
          <Text style={styles.mainTitle}>Choose Your Plan</Text>
          <Text style={styles.mainSubtitle}>
            Unlock your earning potential with the right tier. Join a community
            built for sustainable growth.
          </Text>
        </View>

        {/* ── Affiliate Plan Card ── */}
        <View style={styles.affiliateCard}>
          <Text style={styles.affiliateTitle}>Affiliate Plan</Text>
          <Text style={styles.affiliateSub}>
            Start your journey and access the marketplace.
          </Text>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.affiliatePrice}>₱880</Text>
            <Text style={styles.pricePer}>/yr</Text>
          </View>

          {/* Features */}
          <View style={styles.featuresWrap}>
            {affiliateFeatures.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <CheckIcon />
                <Text style={styles.affiliateFeatureText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Select Button */}
          <TouchableOpacity
            style={styles.affiliateBtn}
            activeOpacity={0.8}
            onPress={() => handleSelect('affiliate', 880)}
          >
            <Text style={styles.affiliateBtnText}>Select Plan</Text>
          </TouchableOpacity>
        </View>

        {/* ── Partner Sales Card ── */}
        <LinearGradient
          colors={['#1B4332', '#2E5C38', '#2E7D32']}
          locations={[0, 0.5, 1]}
          style={styles.partnerCard}
        >
          {/* Title row with badge */}
          <View style={styles.partnerTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerTitle}>Partner{'\n'}Sales</Text>
            </View>
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>MOST{'\n'}POPULAR</Text>
            </View>
          </View>

          <Text style={styles.partnerSub}>
            Maximize your earning potential and build your network.
          </Text>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.partnerPrice}>₱1,500</Text>
            <Text style={styles.partnerPricePer}>/yr</Text>
          </View>

          {/* Features */}
          <View style={styles.featuresWrap}>
            {partnerFeatures.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <CheckIcon gold />
                <Text style={styles.partnerFeatureText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Select Button — solid gold */}
          <TouchableOpacity
            style={styles.partnerBtn}
            activeOpacity={0.85}
            onPress={() => handleSelect('partner', 1500)}
          >
            <Text style={styles.partnerBtnText}>Select Plan</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FBF9',
  },
  scroll: {
    paddingTop: 56,
    paddingHorizontal: 20,
  },

  /* ── Header ── */
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#2E7D32',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  mainTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: '#111111',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 38,
  },
  mainSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
  },

  /* ── Affiliate Card ── */
  affiliateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  affiliateTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#111111',
    marginBottom: 4,
  },
  affiliateSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#888888',
    marginBottom: 16,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  affiliatePrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    color: '#111111',
    lineHeight: 44,
  },
  pricePer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#888888',
    marginBottom: 6,
    marginLeft: 2,
  },
  featuresWrap: {
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  affiliateFeatureText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  affiliateBtn: {
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    borderRadius: 32,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  affiliateBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: '#111111',
  },

  /* ── Check icons ── */
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkCircleGold: {
    borderColor: '#FBC02D',
  },
  checkMark: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '700',
    lineHeight: 14,
  },
  checkMarkGold: {
    color: '#FBC02D',
  },

  /* ── Partner Card ── */
  partnerCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 4,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
  },
  partnerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  partnerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
    lineHeight: 30,
  },
  popularBadge: {
    backgroundColor: '#FBC02D',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  popularText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#1B2A1E',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 13,
  },
  partnerSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.70)',
    marginBottom: 16,
    lineHeight: 20,
  },
  partnerPrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    color: '#FBC02D',
    lineHeight: 44,
  },
  partnerPricePer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 6,
    marginLeft: 2,
  },
  partnerFeatureText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.90)',
    flex: 1,
  },
  partnerBtn: {
    backgroundColor: '#FBC02D',
    borderRadius: 32,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#FBC02D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  partnerBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: '#1B2A1E',
  },
});
