import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    image: require('../../assets/onboard1.png'),
    title: 'Shop Local, Shop Smart',
    subtitle:
      'Discover the best products from local sellers right in your community. Fresh, affordable, and always nearby.',
    accent: '#2a7d2e',
  },
  {
    id: '2',
    image: require('../../assets/onboard2.png'),
    title: 'Earn While You Share',
    subtitle:
      'Invite friends, earn rewards, and get cashback on every purchase. The more you share, the more you earn!',
    accent: '#c8960a',
  },
  {
    id: '3',
    image: require('../../assets/onboard3.png'),
    title: 'Proudly Philippines First',
    subtitle:
      'Support local communities and Filipino businesses. Together, we build a stronger nation — one purchase at a time.',
    accent: '#1a6b5a',
  },
];

export default function OnboardingScreen({ onDone }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const goToNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      onDone();
    }
  };

  const goToSlide = (index) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const renderSlide = ({ item, index }) => (
    <View style={styles.slide}>
      {/* Top illustration area */}
      <View style={styles.imageWrap}>
        <Image source={item.image} style={styles.illustration} resizeMode="contain" />
      </View>

      {/* Bottom content card */}
      <View style={styles.card}>
        {/* Accent bar */}
        <View style={[styles.accentBar, { backgroundColor: item.accent }]} />

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#f8fff4', '#fffde7']}
        style={StyleSheet.absoluteFill}
      />

      {/* Skip button */}
      {currentIndex < SLIDES.length - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={onDone}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        renderItem={renderSlide}
        scrollEventThrottle={16}
      />

      {/* Bottom controls */}
      <View style={styles.controls}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });

            return (
              <TouchableOpacity key={i} onPress={() => goToSlide(i)}>
                <Animated.View
                  style={[
                    styles.dot,
                    { width: dotWidth, opacity: dotOpacity },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Next / Get Started button */}
        <TouchableOpacity onPress={goToNext} activeOpacity={0.85}>
          <LinearGradient
            colors={['#3a9e40', '#2a7a30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtn}
          >
            <Text style={styles.nextText}>
              {currentIndex === SLIDES.length - 1 ? 'Get Started 🚀' : 'Next →'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fff4',
  },

  /* Skip */
  skipBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },

  /* Slide */
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },

  /* Illustration */
  imageWrap: {
    width: width,
    height: height * 0.48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: width * 0.88,
    height: height * 0.42,
  },

  /* Card */
  card: {
    marginHorizontal: 24,
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    alignItems: 'center',
    width: width - 48,
  },
  accentBar: {
    width: 48,
    height: 4,
    borderRadius: 4,
    marginBottom: 16,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
  },

  /* Controls */
  controls: {
    paddingBottom: 44,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2a7a30',
    marginHorizontal: 2,
  },

  /* Button */
  nextBtn: {
    paddingHorizontal: 52,
    paddingVertical: 16,
    borderRadius: 32,
    shadowColor: '#2a7a30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
