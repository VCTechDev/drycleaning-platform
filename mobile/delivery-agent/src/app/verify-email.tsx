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

import {
  ApiError,
  confirmDeliveryAgentEmailVerification,
  requestDeliveryAgentEmailVerification,
} from '../services/api';

function UserIcon() {
  return (
    <View style={styles.userIcon} accessible={false}>
      <View style={styles.userIconHead} />
      <View style={styles.userIconBody} />
    </View>
  );
}

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

function CheckIcon() {
  return (
    <View style={styles.checkIconWrapper} accessible={false}>
      <View style={styles.checkStemShort} />
      <View style={styles.checkStemLong} />
    </View>
  );
}

function InfoIcon() {
  return (
    <View style={styles.infoIconCircle} accessible={false}>
      <Text style={styles.infoIconLetter}>i</Text>
    </View>
  );
}

type VerificationStep = 'request' | 'confirm' | 'success';

export default function VerifyEmailScreen() {
  const screenHeight = Dimensions.get('screen').height;
  const bannerHeight = screenHeight * 0.52;
  const params = useLocalSearchParams<{ identifier?: string }>();

  const [step, setStep] = useState<VerificationStep>('request');
  const [identifier, setIdentifier] = useState(params.identifier || '');
  const [otp, setOtp] = useState('');

  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const identifierInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const otpInputRef = useRef<ComponentRef<typeof TextInput>>(null);



  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleRequestCode = async () => {
    Keyboard.dismiss();
    const trimmed = identifier.trim();

    if (!trimmed) {
      setIdentifierError('Enter your phone number or agent ID.');
      setApiError(null);
      return;
    }

    setIdentifierError(null);
    setApiError(null);
    setResendNotice(null);
    setIsSubmitting(true);

    try {
      const response = await requestDeliveryAgentEmailVerification(trimmed);
      setCooldownRemaining(response.resend_cooldown_seconds || 60);
      setStep('confirm');
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(error.message);
        if (error.resendCooldownSeconds) {
          setCooldownRemaining(error.resendCooldownSeconds);
        }
      } else {
        setApiError('Unable to process verification request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCode = async () => {
    Keyboard.dismiss();
    const trimmedId = identifier.trim();
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

    setOtpError(null);
    setApiError(null);
    setResendNotice(null);
    setIsSubmitting(true);

    try {
      await confirmDeliveryAgentEmailVerification(trimmedId, cleanOtp);
      setStep('success');
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
    const trimmed = identifier.trim();
    if (!trimmed) {
      setStep('request');
      return;
    }

    setIsResending(true);
    setApiError(null);
    setResendNotice(null);

    try {
      const response = await requestDeliveryAgentEmailVerification(trimmed);
      setCooldownRemaining(response.resend_cooldown_seconds || 60);
      setResendNotice(
        'If an eligible account matches these details, a verification code will be sent to its registered email address.'
      );
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

  const handleBackToLogin = () => {
    const trimmed = identifier.trim();
    router.replace({
      pathname: '/',
      params: trimmed ? { identifier: trimmed } : undefined,
    });
  };

  const handleProceedToSignIn = () => {
    router.replace({
      pathname: '/',
      params: { identifier: identifier.trim() },
    });
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
            {/* Hero Banner */}
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
                    <Text style={styles.roleBadgeText}>DELIVERY AGENT ONBOARDING</Text>
                  </View>
                  <Text style={styles.heading}>Email Verification</Text>
                  <Text style={styles.subheading}>
                    Verify your email address before{'\n'}signing in for the first time.
                  </Text>
                </View>
              </View>
            </View>

            {/* Main Content Surface */}
            <View style={styles.contentWrapper}>
              <View style={styles.card}>
                {step === 'request' && (
                  <>
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
                        onPress={() => identifierInputRef.current?.focus()}>
                        <View style={styles.inputLeading} pointerEvents="none">
                          <UserIcon />
                        </View>
                        <TextInput
                          ref={identifierInputRef}
                          style={styles.textInput}
                          placeholder="e.g. VC-AGT-00001 or +919876543210"
                          placeholderTextColor="#94A3B8"
                          value={identifier}
                          onChangeText={(value) => {
                            setIdentifier(value);
                            if (identifierError) setIdentifierError(null);
                            if (apiError) setApiError(null);
                          }}
                          onFocus={() => setIdentifierFocused(true)}
                          onBlur={() => setIdentifierFocused(false)}
                          autoCapitalize="none"
                          autoCorrect={false}
                          accessibilityLabel="Agent ID or phone number"
                          returnKeyType="done"
                          onSubmitEditing={handleRequestCode}
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

                    <View style={styles.guidanceBox}>
                      <View style={styles.guidanceIconContainer}>
                        <InfoIcon />
                      </View>
                      <View style={styles.guidanceContent}>
                        <Text style={styles.guidanceTitle}>Already verified your email?</Text>
                        <Text style={styles.guidanceCopy}>
                          Email verification is only required once during onboarding. If you have already verified your email, return to login and request a login OTP.
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.securityNotice}>
                      If an eligible account matches these details, a verification code will be sent
                      to its registered email address.
                    </Text>

                    <Pressable
                      style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.primaryButtonPressed,
                        isSubmitting && styles.primaryButtonDisabled,
                      ]}
                      onPress={handleRequestCode}
                      disabled={isSubmitting}
                      accessibilityRole="button"
                      accessibilityLabel="Send verification code">
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                      ) : null}
                      <Text style={styles.primaryButtonText}>
                        {isSubmitting ? 'Sending code...' : 'Send verification code'}
                      </Text>
                      {!isSubmitting ? <ArrowIcon /> : null}
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.secondaryButtonPressed,
                      ]}
                      onPress={handleBackToLogin}
                      accessibilityRole="button"
                      accessibilityLabel="Back to Login">
                      <Text style={styles.secondaryButtonText}>{'\u2190'} Back to Login</Text>
                    </Pressable>
                  </>
                )}

                {step === 'confirm' && (
                  <>
                    <View style={styles.identifierBadgeRow}>
                      <View style={styles.identifierPill}>
                        <Text style={styles.identifierPillLabel}>Agent:</Text>
                        <Text style={styles.identifierPillValue}>{identifier.trim()}</Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          setStep('request');
                          setApiError(null);
                          setOtpError(null);
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Change identifier">
                        <Text style={styles.changeLinkText}>Change</Text>
                      </Pressable>
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        Verification Code <Text style={styles.requiredMark}>*</Text>
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
                          style={[styles.textInput, styles.otpTextInput]}
                          placeholder="6-digit code"
                          placeholderTextColor="#94A3B8"
                          value={otp}
                          onChangeText={(value) => {
                            const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
                            setOtp(digitsOnly);
                            if (otpError) setOtpError(null);
                            if (apiError) setApiError(null);
                            if (resendNotice) setResendNotice(null);
                          }}
                          onFocus={() => setOtpFocused(true)}
                          onBlur={() => setOtpFocused(false)}
                          keyboardType="number-pad"
                          maxLength={6}
                          accessibilityLabel="6-digit verification code"
                          returnKeyType="done"
                          onSubmitEditing={handleConfirmCode}
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
                      {resendNotice ? (
                        <Text style={styles.infoNoticeText} accessibilityLiveRegion="polite">
                          {resendNotice}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.expiryNotice}>
                      Codes expire in 10 minutes.
                    </Text>

                    <Pressable
                      style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.primaryButtonPressed,
                        isSubmitting && styles.primaryButtonDisabled,
                      ]}
                      onPress={handleConfirmCode}
                      disabled={isSubmitting}
                      accessibilityRole="button"
                      accessibilityLabel="Verify email">
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                      ) : null}
                      <Text style={styles.primaryButtonText}>
                        {isSubmitting ? 'Verifying...' : 'Verify Email'}
                      </Text>
                      {!isSubmitting ? <ArrowIcon /> : null}
                    </Pressable>

                    <View style={styles.resendRow}>
                      <Pressable
                        onPress={handleResend}
                        disabled={cooldownRemaining > 0 || isResending}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Resend verification code">
                        <Text
                          style={[
                            styles.resendText,
                            (cooldownRemaining > 0 || isResending) && styles.resendTextDisabled,
                          ]}>
                          {isResending
                            ? 'Sending...'
                            : cooldownRemaining > 0
                            ? `Resend code in ${cooldownRemaining}s`
                            : 'Resend code'}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.confirmNoticeBox}>
                      <View style={styles.guidanceIconContainer}>
                        <InfoIcon />
                      </View>
                      <View style={styles.guidanceContent}>
                        <Text style={styles.confirmNoticeTitle}>{"Didn't receive an email?"}</Text>
                        <Text style={styles.confirmNoticeCopy}>
                          Verification codes are only delivered to accounts that still need email verification. If your email was already verified, please return to login and request your login OTP.
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.secondaryButtonPressed,
                      ]}
                      onPress={handleBackToLogin}
                      accessibilityRole="button"
                      accessibilityLabel="Back to Login">
                      <Text style={styles.secondaryButtonText}>{'\u2190'} Back to Login</Text>
                    </Pressable>
                  </>
                )}

                {step === 'success' && (
                  <View style={styles.successContainer}>
                    <View style={styles.successIconCircle}>
                      <CheckIcon />
                    </View>
                    <Text style={styles.successHeading}>Email Verified Successfully</Text>
                    <Text style={styles.successDescription}>
                      Your registered email address has been verified. You may now return to the
                      sign-in screen and log in using your Agent ID or phone number.
                    </Text>

                    <Pressable
                      style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.primaryButtonPressed,
                      ]}
                      onPress={handleProceedToSignIn}
                      accessibilityRole="button"
                      accessibilityLabel="Proceed to sign in">
                      <Text style={styles.primaryButtonText}>Proceed to Sign In</Text>
                      <ArrowIcon />
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Informational Footer Support */}
              <View style={styles.supportContainer}>
                <Text style={styles.supportHeading}>Need help?</Text>
                <Text style={styles.supportCopy}>
                  Contact your Shop Administrator if you need to update your registered email
                  address or agent details.
                </Text>
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
    paddingBottom: 24,
  },
  screenContent: {
    width: '100%',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    marginTop: -60,
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
    width: 180,
    height: 70,
    marginBottom: 2,
  },
  heroCopy: {
    position: 'absolute',
    left: 40,
    bottom: '48%',
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
    marginBottom: 3,
    includeFontPadding: false,
  },
  subheading: {
    fontSize: 12,
    lineHeight: 16,
    color: '#475569',
    includeFontPadding: false,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    includeFontPadding: false,
  },
  requiredMark: {
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  inputContainerFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FAFCFF',
  },
  inputContainerError: {
    borderColor: '#EF4444',
  },
  inputLeading: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  otpTextInput: {
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    includeFontPadding: false,
  },
  securityNotice: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
    marginBottom: 16,
    includeFontPadding: false,
  },
  expiryNotice: {
    fontSize: 11,
    lineHeight: 15,
    color: '#64748B',
    marginBottom: 14,
    includeFontPadding: false,
  },
  infoNoticeText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#0D9488',
    marginTop: 6,
    includeFontPadding: false,
  },
  identifierBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  identifierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  identifierPillLabel: {
    fontSize: 11,
    color: '#64748B',
    includeFontPadding: false,
  },
  identifierPillValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    includeFontPadding: false,
  },
  changeLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    includeFontPadding: false,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonPressed: {
    backgroundColor: '#1D4ED8',
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
    includeFontPadding: false,
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonPressed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#94A3B8',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
  },
  guidanceBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  guidanceIconContainer: {
    marginRight: 10,
    marginTop: 1,
  },
  guidanceContent: {
    flex: 1,
  },
  guidanceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 3,
    includeFontPadding: false,
  },
  guidanceCopy: {
    fontSize: 11,
    lineHeight: 16,
    color: '#1E3A8A',
    includeFontPadding: false,
  },
  confirmNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  confirmNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 3,
    includeFontPadding: false,
  },
  confirmNoticeCopy: {
    fontSize: 11,
    lineHeight: 16,
    color: '#475569',
    includeFontPadding: false,
  },
  infoIconCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconLetter: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 12,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    includeFontPadding: false,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 14,
  },
  resendText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
    includeFontPadding: false,
  },
  resendTextDisabled: {
    color: '#94A3B8',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 8,
    textAlign: 'center',
    includeFontPadding: false,
  },
  successDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
    includeFontPadding: false,
  },
  supportContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  supportHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    includeFontPadding: false,
  },
  supportCopy: {
    fontSize: 11,
    lineHeight: 16,
    color: '#64748B',
    includeFontPadding: false,
  },
  footerText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    includeFontPadding: false,
  },
  userIcon: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIconHead: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#64748B',
    marginBottom: 1,
  },
  userIconBody: {
    width: 13,
    height: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#64748B',
  },
  lockIcon: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockShackle: {
    width: 8,
    height: 6,
    borderWidth: 1.5,
    borderColor: '#64748B',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomWidth: 0,
    marginBottom: -1,
  },
  lockBody: {
    width: 13,
    height: 9,
    borderRadius: 2,
    backgroundColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockKeyhole: {
    width: 2,
    height: 3,
    backgroundColor: '#FFFFFF',
  },
  arrowIcon: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLine: {
    width: 8,
    height: 2,
    backgroundColor: '#FFFFFF',
    marginRight: 2,
  },
  arrowHeadTop: {
    position: 'absolute',
    right: 2,
    top: 4,
    width: 5,
    height: 2,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  arrowHeadBottom: {
    position: 'absolute',
    right: 2,
    bottom: 4,
    width: 5,
    height: 2,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
  },
  checkIconWrapper: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkStemShort: {
    position: 'absolute',
    left: 6,
    bottom: 9,
    width: 6,
    height: 2.5,
    backgroundColor: '#10B981',
    transform: [{ rotate: '45deg' }],
  },
  checkStemLong: {
    position: 'absolute',
    left: 9,
    bottom: 11,
    width: 12,
    height: 2.5,
    backgroundColor: '#10B981',
    transform: [{ rotate: '-45deg' }],
  },
});
