import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';

function ArrowIcon() {
  return (
    <View style={styles.arrowIcon} accessible={false}>
      <View style={styles.arrowLine} />
      <View style={styles.arrowHeadTop} />
      <View style={styles.arrowHeadBottom} />
    </View>
  );
}

export default function DashboardScreen() {
  const { height: screenHeight } = useWindowDimensions();
  const bannerHeight = screenHeight * 0.45;
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading]);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.screenContent}>
          <View style={styles.hero}>
            <View style={[styles.bannerFrame, { height: bannerHeight }]}>
              <Image
                source={require('@/assets/images/auth/delivery-banner.png')}
                style={styles.bannerImage}
                contentFit="cover"
                contentPosition={{ top: '65%', left: '10%', right: '10%' }}
                accessibilityLabel="VeeCleen delivery agent with branded van"
              />

              <View style={styles.heroCopy}>
                <Image
                  source={require('@/assets/images/brand/veecleen-logo.png')}
                  style={styles.brandLogo}
                  contentFit="contain"
                  accessibilityLabel="VeeCleen logo"
                />

                <View style={styles.roleBadge}>
                  <View style={styles.roleBadgeDot} />
                  <Text style={styles.roleBadgeText}>DELIVERY AGENT PORTAL</Text>
                </View>
                <Text style={styles.heading}>Agent Portal</Text>
                <Text style={styles.subheading}>
                  Signed in as{'\n'}{user.agent_id || user.username}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.contentWrapper}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Account Information</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Agent ID</Text>
                <Text style={styles.infoValue}>{user.agent_id || '—'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Username</Text>
                <Text style={styles.infoValue}>{user.username}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Registered Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>

              <View style={styles.infoRowLast}>
                <Text style={styles.infoLabel}>Role</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>Delivery Agent</Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.logoutButton,
                  pressed && styles.logoutButtonPressed,
                  isLoggingOut && styles.logoutButtonDisabled,
                ]}
                onPress={handleSignOut}
                disabled={isLoggingOut}
                accessibilityRole="button"
                accessibilityLabel="Sign out of delivery agent account">
                {isLoggingOut ? (
                  <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                ) : null}
                <Text style={styles.logoutButtonText}>
                  {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                </Text>
                {!isLoggingOut ? <ArrowIcon /> : null}
              </Pressable>
            </View>

            <Text style={styles.footerText}>
              VeeCleen Logistics Platform {'\u2022'} v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  screenContent: {
    width: '100%',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    includeFontPadding: false,
  },
  hero: {
    width: '100%',
    backgroundColor: '#DCEBFF',
  },
  bannerFrame: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#DCEBFF',
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  brandLogo: {
    width: 195,
    minWidth: 170,
    maxWidth: 200,
    height: 99,
    marginBottom: 0,
    marginTop: 0,
    padding: 0,
    margin: 0,
  },
  heroCopy: {
    position: 'absolute',
    left: 49,
    bottom: '45%',
    maxWidth: 220,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(235, 243, 255, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
  },
  roleBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16A34A',
    marginRight: 5,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.6,
    includeFontPadding: false,
  },
  heading: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'left',
    marginBottom: 3,
    includeFontPadding: false,
  },
  subheading: {
    maxWidth: 220,
    fontSize: 12,
    lineHeight: 16,
    color: '#475569',
    textAlign: 'left',
    includeFontPadding: false,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    marginHorizontal: 16,
    marginTop: -50,
    paddingHorizontal: 26,
    paddingTop: 30,
    paddingBottom: 35,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#ffffffff',
    shadowColor: '#6b84bdff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 100,
    zIndex: 2,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
    includeFontPadding: false,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    includeFontPadding: false,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    includeFontPadding: false,
  },
  statusPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    includeFontPadding: false,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#DC2626',
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  logoutButtonPressed: {
    backgroundColor: '#B91C1C',
    transform: [{ scale: 0.99 }],
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    marginRight: 8,
  },
  footerText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
    includeFontPadding: false,
    fontFamily: 'sans-serif',
  },
  arrowIcon: {
    width: 14,
    height: 12,
    justifyContent: 'center',
  },
  arrowLine: {
    width: 12,
    height: 1.8,
    borderRadius: 0.9,
    backgroundColor: '#FFFFFF',
  },
  arrowHeadTop: {
    position: 'absolute',
    right: 0,
    top: 1.5,
    width: 6,
    height: 1.8,
    borderRadius: 0.9,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  arrowHeadBottom: {
    position: 'absolute',
    right: 0,
    bottom: 1.5,
    width: 6,
    height: 1.8,
    borderRadius: 0.9,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
  },
});

