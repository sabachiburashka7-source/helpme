import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  KeyboardAvoidingView, Platform, ScrollView, Pressable, Image, Linking,
} from 'react-native';
import { colors, glass, radius } from '../components/theme';
import FadeInUp from '../components/FadeInUp';
import { useTranslation, LanguageSwitcher } from '../components/i18n';
import { pickProfileImage, isImageUrl } from '../components/profileImage';
import { apiUrl } from '../components/apiBase';
import { BgImage } from '../components/BgImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AmbientBackground, GlassSurface, GlassPanel, GlassField, GlassButton, GlassSegmented,
} from '../components/Glass';

const RESEND_COOLDOWN_SECONDS = 30;
const ACCENT = '#7A1230';

export default function AuthScreen({ onAuthenticated }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState('details'); // 'details' | 'code'
  const [phoneLocal, setPhoneLocal] = useState('');
  const phoneDigits = phoneLocal.replace(/[^\d]/g, '');
  const phoneE164 = phoneDigits ? `+995${phoneDigits}` : '';
  const [name, setName] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const isRegister = mode === 'register';
  const errAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = setInterval(() => {
      setResendIn((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  function flashError(msg) {
    setError(msg);
    errAnim.setValue(0);
    Animated.sequence([
      Animated.timing(errAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(errAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(errAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(errAnim, { toValue: 0, duration: 60, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  }

  async function chooseProfileImage() {
    try {
      const dataUrl = await pickProfileImage();
      if (dataUrl) setProfileImage(dataUrl);
    } catch (err) {
      flashError(err?.message || t('Could not upload image'));
    }
  }

  function openPrivacy() {
    Linking.openURL(apiUrl('/privacy')).catch(() => {});
  }

  function switchMode(next) {
    setMode(next);
    setStep('details');
    setCode('');
    setError('');
  }

  function backToDetails() {
    setStep('details');
    setCode('');
    setError('');
  }

  async function sendCode({ resend = false } = {}) {
    setError('');
    if (!phoneE164 || phoneDigits.length < 8) return flashError(t('Enter your phone number'));
    if (isRegister && !name.trim()) return flashError(t('Enter your name'));

    setBusy(true);
    try {
      const r = await fetch(apiUrl('/api/auth'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_code',
          phone: phoneE164,
          intent: isRegister ? 'register' : 'login',
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        flashError(data?.error || t('Something went wrong'));
        setBusy(false);
        return;
      }
      setStep('code');
      setResendIn(RESEND_COOLDOWN_SECONDS);
      if (resend) setCode('');
    } catch {
      flashError(t('Network error. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setError('');
    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length < 4) {
      return flashError(t('Enter the code you received'));
    }

    setBusy(true);
    try {
      const r = await fetch(apiUrl('/api/auth'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_code',
          phone: phoneE164,
          code: trimmedCode,
          intent: isRegister ? 'register' : 'login',
          name: isRegister ? name.trim() : undefined,
          profile_image: isRegister ? profileImage : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        flashError(data?.error || t('Something went wrong'));
        setBusy(false);
        return;
      }
      onAuthenticated(data);
    } catch {
      flashError(t('Network error. Try again.'));
      setBusy(false);
    }
  }

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.langRow}>
              <LanguageSwitcher size="md" />
            </View>

            <FadeInUp>
              <View style={styles.header}>
                <GlassSurface
                  tone="light"
                  radius={34}
                  shadow="lifted"
                  style={styles.logoGlass}
                >
                  <Image
                    source={require('../assets/icon.png')}
                    style={styles.brandLogo}
                    resizeMode="contain"
                  />
                </GlassSurface>
                <Text style={styles.brand}>kheli</Text>
                <Text style={styles.tagline}>
                  {step === 'code'
                    ? t('We sent a code to {phone}').replace('{phone}', phoneE164)
                    : t('We’ll text you a one-time code to sign in. No password needed.')}
                </Text>
              </View>
            </FadeInUp>

            <FadeInUp delay={90}>
              <GlassPanel
                tone="light"
                radius={34}
                intensity={44}
                style={styles.panel}
                contentStyle={styles.panelInner}
              >
                {step === 'details' ? (
                  <GlassSegmented
                    tabs={[
                      { value: 'login', label: t('Sign In') },
                      { value: 'register', label: t('Register') },
                    ]}
                    value={mode}
                    onChange={switchMode}
                    style={styles.segmented}
                  />
                ) : null}

                {step === 'details' ? (
                  <>
                    {isRegister ? (
                      <View style={styles.avatarRow}>
                        <Pressable onPress={chooseProfileImage}>
                          <GlassSurface
                            tone="strong"
                            radius={radius.pill}
                            shadow="base"
                            style={styles.avatarRing}
                          >
                            <View style={styles.avatarPick}>
                              {isImageUrl(profileImage) ? (
                                <BgImage
                                  source={profileImage}
                                  resizeMode="cover"
                                  style={styles.avatarImage}
                                />
                              ) : (
                                <View style={styles.avatarEmpty}>
                                  <Text style={styles.avatarPickPlus}>+</Text>
                                </View>
                              )}
                            </View>
                          </GlassSurface>
                        </Pressable>
                        <Text style={styles.avatarHint}>
                          {profileImage ? t('Tap to change photo') : t('Add profile photo (optional)')}
                        </Text>
                      </View>
                    ) : null}

                    {isRegister ? (
                      <GlassField
                        label={t('Name')}
                        placeholder={t('Your name')}
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                      />
                    ) : null}

                    <GlassField
                      label={t('Phone')}
                      value={phoneLocal}
                      onChangeText={setPhoneLocal}
                      placeholder="555 12 34 56"
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                      left={
                        <View style={styles.phonePrefixWrap}>
                          <Text style={styles.phonePrefix}>+995</Text>
                        </View>
                      }
                      inputStyle={styles.phoneInput}
                    />
                  </>
                ) : (
                  <>
                    <GlassField
                      label={t('Verification code')}
                      placeholder="123456"
                      value={code}
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={10}
                      inputStyle={styles.codeInput}
                      containerStyle={{ marginTop: 4 }}
                    />

                    <Pressable
                      onPress={() => resendIn === 0 && !busy && sendCode({ resend: true })}
                      disabled={resendIn > 0 || busy}
                      style={styles.resendRow}
                    >
                      <Text style={[styles.resendText, (resendIn > 0 || busy) && { opacity: 0.45 }]}>
                        {resendIn > 0
                          ? t('Resend code in {n}s').replace('{n}', String(resendIn))
                          : t("Didn't get the code? Resend")}
                      </Text>
                    </Pressable>
                  </>
                )}

                {error ? (
                  <Animated.View
                    style={{
                      marginTop: 16,
                      transform: [
                        {
                          translateX: errAnim.interpolate({
                            inputRange: [-1, 0, 1],
                            outputRange: [-6, 0, 6],
                          }),
                        },
                      ],
                    }}
                  >
                    <GlassSurface tone="danger" radius={radius.lg} shadow="subtle" style={styles.errBox}>
                      <Text style={styles.errText}>{error}</Text>
                    </GlassSurface>
                  </Animated.View>
                ) : null}

                <View style={{ height: 26 }} />

                <GlassButton
                  title={
                    step === 'details'
                      ? t('Send code')
                      : isRegister
                        ? t('Create account')
                        : t('Sign in')
                  }
                  onPress={step === 'details' ? () => sendCode() : verifyCode}
                  loading={busy}
                  size="lg"
                  style={styles.cta}
                />

                <Pressable
                  onPress={
                    step === 'code'
                      ? backToDetails
                      : () => switchMode(isRegister ? 'login' : 'register')
                  }
                  style={styles.switchRow}
                >
                  <Text style={styles.switchText}>
                    {step === 'code'
                      ? t('Wrong number? ')
                      : isRegister
                        ? t('Already have an account? ')
                        : t('New here? ')}
                    <Text style={styles.switchTextStrong}>
                      {step === 'code'
                        ? t('Change it')
                        : isRegister
                          ? t('Sign in')
                          : t('Create one')}
                    </Text>
                  </Text>
                </Pressable>
              </GlassPanel>
            </FadeInUp>

            <Text style={styles.legalNote}>
              {t('By continuing you agree to our ')}
              <Text style={styles.legalLink} onPress={openPrivacy}>
                {t('Privacy Policy')}
              </Text>
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  langRow: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },

  header: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 22,
  },
  logoGlass: {
    padding: 10,
    marginBottom: 16,
  },
  brandLogo: {
    width: 84,
    height: 84,
    borderRadius: 24,
  },
  brand: {
    fontSize: 40,
    fontWeight: '500',
    color: ACCENT,
    letterSpacing: 1.4,
    lineHeight: 46,
  },
  tagline: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 18,
  },

  panel: {
    // Padding lives in `panelInner` — GlassPanel's blur/tint layers are
    // absolute and would be shrunk by padding on the outer view.
    marginTop: 4,
  },
  panelInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },
  segmented: { marginBottom: 4 },

  phonePrefixWrap: {
    paddingLeft: 16,
    paddingRight: 12,
    marginRight: 2,
    borderRightWidth: 1,
    borderRightColor: glass.strokeSoft,
    paddingVertical: 12,
  },
  phonePrefix: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  phoneInput: { paddingLeft: 12 },
  codeInput: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 16,
  },

  resendRow: { alignItems: 'center', marginTop: 16, paddingVertical: 4 },
  resendText: { fontSize: 13, color: ACCENT, fontWeight: '700' },

  errBox: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  errText: { color: colors.danger, fontSize: 13, fontWeight: '700' },

  cta: { alignSelf: 'stretch' },

  switchRow: { alignItems: 'center', marginTop: 18, paddingVertical: 4 },
  switchText: { fontSize: 13, color: colors.textSecondary },
  switchTextStrong: { color: ACCENT, fontWeight: '800' },

  legalNote: {
    marginTop: 22,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  legalLink: {
    color: ACCENT,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  avatarRing: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarPick: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  avatarEmpty: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPickPlus: {
    color: '#fff',
    fontWeight: '300',
    fontSize: 32,
    lineHeight: 34,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  avatarHint: {
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 1,
    lineHeight: 18,
  },
});
