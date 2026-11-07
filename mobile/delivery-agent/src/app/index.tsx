import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';

import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

function UserIcon() {
  return (
    <View style={styles.userIcon} accessible={false}>
      <View style={styles.userIconHead} />
      <View style={styles.userIconBody} />
    </View>
  );
}

function HeadsetIcon() {
  return (
    <View style={styles.headsetIcon} accessible={false}>
      <View style={styles.headsetBand} />
      <View style={[styles.headsetEar, styles.headsetEarLeft]} />
      <View style={[styles.headsetEar, styles.headsetEarRight]} />
      <View style={styles.headsetMic} />
    </View>
  );
}

function ArrowIcon() {
  return (
    <View style={styles.arrowIcon} accessible={false}>
      <View style={styles.arrowLine} />
      <View style={styles.arrowHeadTop} />
      <View style={styles.arrowHeadBottom} />
    </View>
  );
}

export default function LoginScreen() {
  const screenHeight = Dimensions.get('screen').height;
  const bannerHeight = screenHeight * 0.60;
  const { requestOTP, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [identifier, setIdentifier] = useState('');
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isAuthLoading]);

  if (isAuthLoading || isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleRequestOTP = async () => {
    Keyboard.dismiss();
    const trimmed = identifier.trim();

    if (!trimmed) {
      setIdentifierError('Enter your phone number or agent ID.');
      setApiError(null);
      return;
    }

    setIdentifierError(null);
    setApiError(null);
    setIsSubmitting(true);

    try {
      const response = await requestOTP(trimmed);
      router.push({
        pathname: '/verify-otp',
        params: {
          identifier: trimmed,
          challenge_id: response.challenge_id,
          resend_cooldown_seconds: String(response.resend_cooldown_seconds || 60),
          expires_in_seconds: String(response.expires_in_seconds || 300),
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(error.message);
      } else {
        setApiError('Unable to process login request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={styles.screenContent}>
              <View style={styles.hero} pointerEvents="none">
                <View style={[styles.bannerFrame, { height: bannerHeight }]}>
                  <Image
                    source={require('@/assets/images/auth/delivery-banner.png')}
                    style={styles.bannerImage}
                    contentFit="cover"
                    contentPosition={{ top: '70%', left: '10%', right: '10%' }}
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
                    <Text style={styles.heading}>Welcome back</Text>
                    <Text style={styles.subheading}>
                      Sign in to manage your{'\n'}assigned pickups and deliveries.
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.contentWrapper}>
                <View style={styles.card}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      Agent ID or Phone Number <Text style={styles.requiredMark}>*</Text>
                    </Text>
                    <Pressable
                      accessible={false}
                      style={[
                        styles.inputContainer,
                        identifierFocused && styles.inputContainerFocused,
                        (identifierError || apiError) && styles.inputContainerError,
                      ]}
                      onPress={() => inputRef.current?.focus()}>
                      <View style={styles.inputLeading} pointerEvents="none">
                        <UserIcon />
                      </View>
                      <TextInput
                        ref={inputRef}
                        style={styles.textInput}
                        placeholder="e.g. VC-AGT-00001 or +919876543210"
                        placeholderTextColor="#94A3B8"
                        value={identifier}
                        onChangeText={(value) => {
                          setIdentifier(value);
                          if (identifierError) setIdentifierError(null);
                          if (apiError) setApiError(null);
                        }}
                        onPressIn={() => {}}
                        onPressOut={() => {}}
                        onFocus={() => setIdentifierFocused(true)}
                        onBlur={() => setIdentifierFocused(false)}
                        autoCapitalize="none"
                        autoCorrect={false}
                        accessibilityLabel="Agent ID or phone number"
                        returnKeyType="done"
                        onSubmitEditing={handleRequestOTP}
                        underlineColorAndroid="transparent"
                        cursorColor="#2563EB"
                        selectionColor="#BFDBFE"
                        editable={!isSubmitting}
                      />
                    </Pressable>
                    {identifierError ? (
                      <Text style={styles.errorText} accessibilityLiveRegion="polite">
                        {identifierError}
                      </Text>
                    ) : null}
                    {apiError ? (
                      <Text style={styles.errorText} accessibilityLiveRegion="polite">
                        {apiError}
                      </Text>
                    ) : null}
                  </View>

                  <Pressable
                    onPress={() => router.push('/password-help')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Need help signing in">
                    <Text style={styles.forgotPassword}>Need help signing in?</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.loginButton,
                      pressed && styles.loginButtonPressed,
                      isSubmitting && styles.loginButtonDisabled,
                    ]}
                    onPress={handleRequestOTP}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Request verification code">
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                    ) : null}
                    <Text style={styles.loginButtonText}>
                      {isSubmitting ? 'Sending code...' : 'Request verification code'}
                    </Text>
                    {!isSubmitting ? <ArrowIcon /> : null}
                  </Pressable>
                </View>

                <View style={styles.supportContainer}>
                  <View style={styles.supportIcon}>
                    <HeadsetIcon />
                  </View>
                  <View style={styles.supportCopyContainer}>
                    <Text style={styles.supportHeading}>Need help signing in?</Text>
                    <Text style={styles.supportCopy}>
                      Contact your Shop Administrator to verify your agent account.
                    </Text>
                  </View>
                </View>

                <Text style={styles.footerText}>
                  VeeCleen Logistics Platform {'\u2022'} v1.0.0
                </Text>
              </View>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
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
    marginTop: -79,
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
    bottom: '57%',
    maxWidth: 190,
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
    backgroundColor: '#2563EB',
    marginRight: 5,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1D4ED8',
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
    maxWidth: 190,
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
    marginTop: 0,
    paddingHorizontal: 26,
    paddingTop: 33,
    paddingBottom: 45,
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
  fieldGroup: {
    marginBottom: 10,
    paddingTop: 20,
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 7,
    includeFontPadding: false,
  },
  requiredMark: {
    color: '#DC2626',
    includeFontPadding: false,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DCE4F0',
    borderRadius: 15,
    height: 46,
    paddingLeft: 6,
    paddingRight: 6,
  },
  inputContainerFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 1,
  },
  inputContainerError: {
    borderColor: '#DC2626',
    backgroundColor: '#FFF8F8',
  },
  inputLeading: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    color: '#0F172A',
    includeFontPadding: false,
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 11,
    lineHeight: 15,
    color: '#DC2626',
    marginTop: 3,
    includeFontPadding: false,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 8,
    marginBottom: 16,
    includeFontPadding: false,
  },
  loginButton: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  loginButtonPressed: {
    backgroundColor: '#1D4ED8',
    shadowOpacity: 0.12,
    transform: [{ scale: 0.99 }],
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    marginRight: 8,
  },
  supportContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 20,
    marginHorizontal: 16,
  },
  supportIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: 10,
  },
  supportCopyContainer: {
    flex: 1,
  },
  supportHeading: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 1,
    includeFontPadding: false,
  },
  supportCopy: {
    fontSize: 11,
    lineHeight: 15,
    color: '#475569',
    includeFontPadding: false,
  },
  footerText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 10,
    includeFontPadding: false,
    fontFamily: 'sans-serif',
  },
  userIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIconHead: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
    borderWidth: 1.6,
    borderColor: '#2563EB',
    marginTop: 0.5,
  },
  userIconBody: {
    width: 13,
    height: 6.5,
    borderTopLeftRadius: 6.5,
    borderTopRightRadius: 6.5,
    borderWidth: 1.6,
    borderBottomWidth: 0,
    borderColor: '#2563EB',
    marginTop: 1.5,
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
  headsetIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
  },
  headsetBand: {
    position: 'absolute',
    top: 1.5,
    width: 14,
    height: 14,
    borderWidth: 1.6,
    borderBottomWidth: 0,
    borderColor: '#2563EB',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headsetEar: {
    position: 'absolute',
    top: 8.5,
    width: 4.5,
    height: 7,
    borderRadius: 2.5,
    backgroundColor: '#2563EB',
  },
  headsetEarLeft: {
    left: 1,
  },
  headsetEarRight: {
    right: 1,
  },
  headsetMic: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 7,
    height: 1.8,
    borderRadius: 0.9,
    backgroundColor: '#2563EB',
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
});
