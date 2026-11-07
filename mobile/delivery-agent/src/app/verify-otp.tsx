import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
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

function LockIcon() {
  return (
    <View style={styles.lockIcon} accessible={false}>
      <View style={styles.lockShackle} />
      <View style={styles.lockBody}>
        <View style={styles.lockKeyhole} />
      </View>
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

export default function VerifyOTPScreen() {
  const screenHeight = Dimensions.get('screen').height;
  const bannerHeight = screenHeight * 0.60;
  const params = useLocalSearchParams<{
    identifier?: string;
    challenge_id?: string;
    resend_cooldown_seconds?: string;
    expires_in_seconds?: string;
  }>();

  const identifier = params.identifier || '';
  const [challengeId, setChallengeId] = useState(params.challenge_id || '');
  const initialCooldown = parseInt(params.resend_cooldown_seconds || '60', 10) || 60;

  const { verifyOTP, requestOTP, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const otpInputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [otp, setOtp] = useState('');
  const [otpFocused, setOtpFocused] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(initialCooldown);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isAuthLoading]);

  // Resend countdown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleVerify = async () => {
    Keyboard.dismiss();
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      setOtpError('Enter the 6-digit verification code.');
      setApiError(null);
      return;
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      setOtpError('Verification code must be exactly 6 numeric digits.');
      setApiError(null);
      return;
    }

    if (!challengeId) {
      setApiError('Verification challenge missing or expired. Please request a new code.');
      return;
    }

    setOtpError(null);
    setApiError(null);
    setApiSuccess(null);
    setIsSubmitting(true);

    try {
      await verifyOTP(challengeId, cleanOtp);
      router.replace('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(error.message);
      } else {
        setApiError('Unable to verify code. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldownRemaining > 0 || isResending) return;
    if (!identifier) {
      setApiError('Identifier missing. Please return to login.');
      return;
    }

    setIsResending(true);
    setApiError(null);
    setApiSuccess(null);

    try {
      const response = await requestOTP(identifier);
      setChallengeId(response.challenge_id);
      setCooldownRemaining(response.resend_cooldown_seconds || 60);
      setApiSuccess('A new verification code has been sent.');
      setOtp('');
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(error.message);
        if (error.resendCooldownSeconds) {
          setCooldownRemaining(error.resendCooldownSeconds);
        }
      } else {
        setApiError('Unable to resend code right now. Please try again.');
      }
    } finally {
      setIsResending(false);
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
                      <Text style={styles.roleBadgeText}>OTP VERIFICATION</Text>
                    </View>
                    <Text style={styles.heading}>Enter code</Text>
                    <Text style={styles.subheading}>
                      A 6-digit login code was sent{'\n'}for {identifier || 'your account'}.
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.contentWrapper}>
                <View style={styles.card}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      6-Digit Verification Code <Text style={styles.requiredMark}>*</Text>
                    </Text>
                    <Pressable
                      accessible={false}
                      style={[
                        styles.inputContainer,
                        otpFocused && styles.inputContainerFocused,
                        (otpError || apiError) && styles.inputContainerError,
                      ]}
                      onPress={() => otpInputRef.current?.focus()}>
                      <View style={styles.inputLeading} pointerEvents="none">
                        <LockIcon />
                      </View>
                      <TextInput
                        ref={otpInputRef}
                        style={styles.otpInput}
                        placeholder="••••••"
                        placeholderTextColor="#94A3B8"
                        value={otp}
                        onChangeText={(value) => {
                          const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
                          setOtp(digitsOnly);
                          if (otpError) setOtpError(null);
                          if (apiError) setApiError(null);
                        }}
                        onPressIn={() => {}}
                        onPressOut={() => {}}
                        onFocus={() => setOtpFocused(true)}
                        onBlur={() => setOtpFocused(false)}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoCapitalize="none"
                        autoCorrect={false}
                        accessibilityLabel="6-digit verification code"
                        returnKeyType="done"
                        onSubmitEditing={handleVerify}
                        underlineColorAndroid="transparent"
                        cursorColor="#2563EB"
                        selectionColor="#BFDBFE"
                        editable={!isSubmitting}
                      />
                    </Pressable>
                    {otpError ? (
                      <Text style={styles.errorText} accessibilityLiveRegion="polite">
                        {otpError}
                      </Text>
                    ) : null}
                    {apiError ? (
                      <Text style={styles.errorText} accessibilityLiveRegion="polite">
                        {apiError}
                      </Text>
                    ) : null}
                    {apiSuccess ? (
                      <Text style={styles.successText} accessibilityLiveRegion="polite">
                        {apiSuccess}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.resendRow}>
                    {cooldownRemaining > 0 ? (
                      <Text style={styles.resendCountdown}>
                        Resend code in {cooldownRemaining}s
                      </Text>
                    ) : (
                      <Pressable
                        onPress={handleResend}
                        disabled={isResending}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Resend verification code">
                        <Text style={styles.resendAction}>
                          {isResending ? 'Resending...' : 'Resend verification code'}
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.loginButton,
                      pressed && styles.loginButtonPressed,
                      isSubmitting && styles.loginButtonDisabled,
                    ]}
                    onPress={handleVerify}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Verify and sign in">
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                    ) : null}
                    <Text style={styles.loginButtonText}>
                      {isSubmitting ? 'Verifying...' : 'Verify & Sign in'}
                    </Text>
                    {!isSubmitting ? <ArrowIcon /> : null}
                  </Pressable>

                  <Pressable
                    onPress={() => router.back()}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Change agent ID or phone number"
                    style={styles.changeIdentifierBtn}>
                    <Text style={styles.changeIdentifierText}>
                      Change Agent ID or phone number
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.supportContainer}>
                  <View style={styles.supportIcon}>
                    <HeadsetIcon />
                  </View>
                  <View style={styles.supportCopyContainer}>
                    <Text style={styles.supportHeading}>{"Didn't receive a code?"}</Text>
                    <Text style={styles.supportCopy}>
                      Codes are sent to your verified registered email address.
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
  otpInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 6,
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
  successText: {
    fontSize: 11,
    lineHeight: 15,
    color: '#16A34A',
    marginTop: 3,
    includeFontPadding: false,
  },
  resendRow: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  resendCountdown: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: '#64748B',
    includeFontPadding: false,
  },
  resendAction: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#2563EB',
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
  changeIdentifierBtn: {
    marginTop: 14,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeIdentifierText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    includeFontPadding: false,
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
  lockIcon: {
    width: 18,
    height: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockShackle: {
    width: 9,
    height: 8,
    borderWidth: 1.6,
    borderBottomWidth: 0,
    borderColor: '#2563EB',
    borderTopLeftRadius: 4.5,
    borderTopRightRadius: 4.5,
    marginBottom: -1,
  },
  lockBody: {
    width: 13,
    height: 10,
    borderRadius: 2.5,
    borderWidth: 1.6,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockKeyhole: {
    width: 2.5,
    height: 3.5,
    borderRadius: 1.2,
    backgroundColor: '#2563EB',
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
});
