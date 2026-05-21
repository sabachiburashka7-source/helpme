import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Animated, Easing,
  KeyboardAvoidingView, Platform, ScrollView, Pressable,
} from 'react-native';
import { colors, shadows } from '../components/theme';
import FadeInUp from '../components/FadeInUp';
import { useTranslation, LanguageSwitcher } from '../components/i18n';
import { pickProfileImage, isImageUrl } from '../components/profileImage';
import { apiUrl } from '../components/apiBase';
import { BgImage } from '../components/BgImage';
import { SafeAreaView } from 'react-native-safe-area-context';

const RESEND_COOLDOWN_SECONDS = 30;
const ACCENT = '#7A1230';
const liveDark = { backgroundColor: ACCENT };

function Field({ label, ...inputProps }) {
  const [isFocused, setFocused] = useState(false);
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View
        style={[
          fieldStyles.inputWrap,
          isFocused && fieldStyles.inputWrapFocused,
        ]}
      >
        <TextInput
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          placeholderTextColor={colors.textMuted}
          style={fieldStyles.input}
        />
      </View>
    </View>
  );
}

function PhoneField({ label, value, onChangeText }) {
  const [isFocused, setFocused] = useState(false);
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View
        style={[
          fieldStyles.inputWrap,
          fieldStyles.phoneRow,
          isFocused && fieldStyles.inputWrapFocused,
        ]}
      >
        <Text style={fieldStyles.phonePrefix}>+995</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="555 12 34 56"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          style={fieldStyles.phoneInput}
        />
      </View>
    </View>
  );
}

function PillTabs({ tabs, value, onChange }) {
  const [innerW, setInnerW] = useState(0);
  const tx = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, tabs.findIndex((t) => t.value === value));
  const segmentW = innerW > 0 ? (innerW - 8) / tabs.length : 0;

  useEffect(() => {
    if (segmentW === 0) return;
    Animated.spring(tx, {
      toValue: segmentW * index,
      useNativeDriver: true,
      speed: 22,
      bounciness: 8,
    }).start();
  }, [index, segmentW, tx]);

  return (
    <View style={tabStyles.outer}>
      <View
        style={tabStyles.inner}
        onLayout={(e) => setInnerW(e.nativeEvent.layout.width)}
      >
        {segmentW > 0 ? (
          <Animated.View
            style={[
              tabStyles.thumb,
              { width: segmentW, transform: [{ translateX: tx }] },
            ]}
          />
        ) : null}
        <View style={tabStyles.row}>
          {tabs.map((t) => {
            const active = t.value === value;
            return (
              <Pressable
                key={t.value}
                onPress={() => onChange(t.value)}
                style={tabStyles.tab}
              >
                <Text style={[tabStyles.text, active && tabStyles.textActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function SoftButton({ title, onPress, loading, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  const isDisabled = !!(loading || disabled);

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: 'stretch' }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => !isDisabled && animate(0.97)}
        onPressOut={() => animate(1)}
        disabled={isDisabled}
        style={[btnStyles.base, isDisabled && { opacity: 0.6 }]}
      >
        <Text style={btnStyles.text}>{loading ? '…' : title}</Text>
      </Pressable>
    </Animated.View>
  );
}

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
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
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
              <View style={styles.logoRing}>
                <View style={[styles.logoDot, liveDark]}>
                  <Text style={styles.logoLetter}>h</Text>
                </View>
              </View>
              <Text style={styles.brand}>helpme</Text>
              <Text style={styles.tagline}>
                {step === 'code'
                  ? t('We sent a code to {phone}').replace('{phone}', phoneE164)
                  : isRegister
                  ? t('Create your account in seconds')
                  : t('Welcome back — sign in to continue')}
              </Text>
            </View>
          </FadeInUp>

          {step === 'details' && (
            <FadeInUp delay={80}>
              <PillTabs
                tabs={[
                  { value: 'login', label: t('Sign In') },
                  { value: 'register', label: t('Register') },
                ]}
                value={mode}
                onChange={switchMode}
              />
            </FadeInUp>
          )}

          <FadeInUp delay={140}>
            <View style={styles.form}>
              {step === 'details' ? (
                <>
                  {isRegister && (
                    <>
                      <View style={styles.avatarRow}>
                        <Pressable onPress={chooseProfileImage} style={styles.avatarRing}>
                          <View
                            style={[
                              styles.avatarPick,
                              !isImageUrl(profileImage) && liveDark,
                            ]}
                          >
                            {isImageUrl(profileImage) ? (
                              <BgImage
                                source={profileImage}
                                resizeMode="cover"
                                style={styles.avatarImage}
                              />
                            ) : (
                              <Text style={styles.avatarPickPlus}>+</Text>
                            )}
                          </View>
                        </Pressable>
                        <Text style={styles.avatarHint}>
                          {profileImage ? t('Tap to change photo') : t('Add profile photo (optional)')}
                        </Text>
                      </View>
                      <Field
                        label={t('Name')}
                        placeholder={t('Your name')}
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                      />
                    </>
                  )}

                  <PhoneField
                    label={t('Phone')}
                    value={phoneLocal}
                    onChangeText={setPhoneLocal}
                  />

                  <Text style={styles.helperText}>
                    {t('We’ll text you a one-time code to sign in. No password needed.')}
                  </Text>
                </>
              ) : (
                <>
                  <Field
                    label={t('Verification code')}
                    placeholder="123456"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={10}
                  />

                  <Pressable
                    onPress={() => resendIn === 0 && !busy && sendCode({ resend: true })}
                    disabled={resendIn > 0 || busy}
                    style={styles.resendRow}
                  >
                    <Text style={[styles.resendText, (resendIn > 0 || busy) && { opacity: 0.5 }]}>
                      {resendIn > 0
                        ? t('Resend code in {n}s').replace('{n}', String(resendIn))
                        : t("Didn't get the code? Resend")}
                    </Text>
                  </Pressable>
                </>
              )}

              <Animated.View
                style={{
                  transform: [
                    {
                      translateX: errAnim.interpolate({
                        inputRange: [-1, 0, 1],
                        outputRange: [-6, 0, 6],
                      }),
                    },
                  ],
                  opacity: error ? 1 : 0,
                  marginTop: error ? 14 : 0,
                  height: error ? undefined : 0,
                }}
              >
                {error ? (
                  <View style={styles.errBox}>
                    <Text style={styles.errText}>{error}</Text>
                  </View>
                ) : null}
              </Animated.View>

              <View style={{ height: 24 }} />

              {step === 'details' ? (
                <SoftButton
                  title={t('Send code')}
                  onPress={() => sendCode()}
                  loading={busy}
                />
              ) : (
                <SoftButton
                  title={isRegister ? t('Create account') : t('Sign in')}
                  onPress={verifyCode}
                  loading={busy}
                />
              )}

              {step === 'code' ? (
                <Pressable onPress={backToDetails} style={styles.switchRow}>
                  <Text style={styles.switchText}>
                    {t('Wrong number? ')}
                    <Text style={styles.switchTextStrong}>{t('Change it')}</Text>
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => switchMode(isRegister ? 'login' : 'register')}
                  style={styles.switchRow}
                >
                  <Text style={styles.switchText}>
                    {isRegister ? t('Already have an account? ') : t('New here? ')}
                    <Text style={styles.switchTextStrong}>
                      {isRegister ? t('Sign in') : t('Create one')}
                    </Text>
                  </Text>
                </Pressable>
              )}
            </View>
          </FadeInUp>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  langRow: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },

  // Header
  header: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 22,
  },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    boxShadow: '0 8px 22px rgba(122, 18, 48, 0.16)',
  },
  logoDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  form: { paddingTop: 8 },

  helperText: {
    marginTop: 14,
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  resendRow: { alignItems: 'center', marginTop: 14, paddingVertical: 6 },
  resendText: { fontSize: 13, color: ACCENT, fontWeight: '700' },

  errBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errText: { color: colors.danger, fontSize: 13, fontWeight: '600' },

  switchRow: { alignItems: 'center', marginTop: 20, paddingVertical: 6 },
  switchText: { fontSize: 13, color: colors.textSecondary },
  switchTextStrong: { color: ACCENT, fontWeight: '700' },

  // Avatar picker
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    boxShadow: '0 6px 18px rgba(122, 18, 48, 0.18)',
  },
  avatarPick: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  },
});

const tabStyles = StyleSheet.create({
  outer: {
    marginBottom: 8,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
  },
  inner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    padding: 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: '#fff',
    borderRadius: 999,
    boxShadow: '0 2px 8px rgba(15, 15, 30, 0.10)',
  },
  row: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 999,
  },
  text: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textActive: {
    color: ACCENT,
    fontWeight: '700',
  },
});

const btnStyles = StyleSheet.create({
  base: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 28px rgba(122, 18, 48, 0.34)',
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

const fieldStyles = StyleSheet.create({
  wrap: { marginTop: 16 },
  label: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 4,
    ...shadows.card,
  },
  inputWrapFocused: {
    borderColor: ACCENT,
    boxShadow: '0 0 0 4px rgba(122, 18, 48, 0.12)',
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.text,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  phonePrefix: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 14,
    marginRight: 10,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: 14,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 14,
    fontSize: 14,
    color: colors.text,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
});
