import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PasswordHelpScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.container}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
          <Text style={styles.backText}>Back to sign in</Text>
        </Pressable>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>?</Text>
          </View>
          <Text style={styles.title}>Need help signing in?</Text>
          <Text style={styles.description}>
            Password resets are handled by your Shop Administrator. We do not offer an
            automated reset service from this app.
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What to do</Text>
            <View style={styles.stepRow}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>Contact your Shop Administrator.</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>Ask them to update or reset your credentials.</Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Return to sign in"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
            <Text style={styles.primaryButtonText}>Return to sign in</Text>
          </Pressable>
        </View>

        <Text style={styles.footerText}>VeeCleen Logistics Platform {'\u2022'} v1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7FAFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.65,
  },
  backArrow: {
    fontSize: 21,
    color: '#2563EB',
    marginRight: 7,
    includeFontPadding: false,
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    includeFontPadding: false,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 410,
    alignSelf: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
    marginBottom: 18,
  },
  iconText: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    color: '#2563EB',
    includeFontPadding: false,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 9,
    includeFontPadding: false,
  },
  description: {
    maxWidth: 330,
    fontSize: 14,
    lineHeight: 21,
    color: '#5B6B84',
    textAlign: 'center',
    includeFontPadding: false,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4EAF3',
    paddingHorizontal: 18,
    paddingVertical: 17,
    marginTop: 24,
    marginBottom: 18,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#233451',
    marginBottom: 12,
    includeFontPadding: false,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stepNumber: {
    width: 23,
    height: 23,
    borderRadius: 8,
    backgroundColor: '#EAF2FF',
    color: '#2563EB',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 10,
    includeFontPadding: false,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#5B6B84',
    includeFontPadding: false,
  },
  primaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    backgroundColor: '#1D4ED8',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  footerText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#94A3B8',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
