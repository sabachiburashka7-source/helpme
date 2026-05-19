import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Animated, Easing,
  KeyboardAvoidingView, Platform, ScrollView, Pressable,
} from 'react-native';
import { colors, radius, spacing, typography, transitions } from '../components/theme';
import { Button } from '../components/Button';
import SegmentedTabs from '../components/SegmentedTabs';
import FadeInUp from '../components/FadeInUp';
import { useTranslation, LanguageSwitcher } from '../components/i18n';
import { pickProfileImage, isImageUrl } from '../components/profileImage';

const RESEND_COOLDOWN_SECONDS = 30;

function Field({ label, ...inputProps }) {
  const [isFocused, setFocused] = useState(false);
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
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
        style={[
          fieldStyles.input,
          isFocused && fieldStyles.inputFocused,
          Platform.OS === 'web' && { transition: transitions.base, outlineStyle: 'none' },
        ]}
      />
    </View>
  );
}

export default function AuthScreen({ onAuthenticated }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState('details'); // 'details' | 'code'
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
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
    setVerificationId('');
    setError('');
  }

  function backToDetails() {
    setStep('details');
    setCode('');
    setVerificationId('');
    setError('');
  }

  async function sendCode({ resend = false } = {}) {
    setError('');
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) return flashError(t('Enter your phone number'));
    if (!trimmedPhone.startsWith('+')) {
      return flashError(t('Include country code, e.g. +1 555 123 4567'));
    }
    if (isRegister && !name.trim()) return flashError(t('Enter your name'));

    setBusy(true);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_code',
          phone: trimmedPhone,
          intent: isRegister ? 'register' : 'login',
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        flashError(data?.error || t('Something went wrong'));
        setBusy(false);
        return;
      }
      setVerificationId(data?.verification_id || '');
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
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_code',
          phone: phone.trim(),
          code: trimmedCode,
          verification_id: verificationId,
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
            <View style={styles.logoDot} />
            <Text style={styles.brand}>helpme</Text>
            <Text style={styles.tagline}>
              {step === 'code'
                ? t('We sent a code to {phone}').replace('{phone}', phone.trim())
                : isRegister
                ? t('Create your account in seconds')
                : t('Welcome back — sign in to continue')}
            </Text>
          </View>
        </FadeInUp>

        {step === 'details' && (
          <FadeInUp delay={80}>
            <View style={styles.tabsWrap}>
              <SegmentedTabs
                tabs={[
                  { value: 'login', label: t('Sign In') },
                  { value: 'register', label: t('Register') },
                ]}
                value={mode}
                onChange={switchMode}
              />
            </View>
          </FadeInUp>
        )}

        <FadeInUp delay={140}>
          <View style={styles.form}>
            {step === 'details' ? (
              <>
                {isRegister && (
                  <>
                    <View style={styles.avatarRow}>
                      <Pressable
                        onPress={chooseProfileImage}
                        style={({ hovered }) => [
                          styles.avatarPick,
                          Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
                          hovered && { opacity: 0.92 },
                        ]}
                      >
                        {isImageUrl(profileImage) ? (
                          <View
                            style={[
                              styles.avatarImage,
                              Platform.OS === 'web'
                                ? {
                                    backgroundImage: `url("${profileImage}")`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                  }
                                : null,
                            ]}
                          />
                        ) : (
                          <Text style={styles.avatarPickPlus}>+</Text>
                        )}
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

                <Field
                  label={t('Phone')}
                  placeholder="+1 555 123 4567"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
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
                  style={({ hovered }) => [
                    styles.resendRow,
                    Platform.OS === 'web' && { transition: transitions.fast, cursor: resendIn === 0 ? 'pointer' : 'default' },
                    hovered && resendIn === 0 && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.resendText}>
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
              <Button
                title={isRegister ? t('Send code') : t('Send code')}
                onPress={() => sendCode()}
                loading={busy}
                size="lg"
              />
            ) : (
              <Button
                title={isRegister ? t('Create account') : t('Sign in')}
                onPress={verifyCode}
                loading={busy}
                size="lg"
              />
            )}

            {step === 'code' ? (
              <Pressable
                onPress={backToDetails}
                style={({ hovered }) => [
                  styles.switchRow,
                  Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
                  hovered && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.switchText}>
                  {t('Wrong number? ')}
                  <Text style={styles.switchTextStrong}>{t('Change it')}</Text>
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => switchMode(isRegister ? 'login' : 'register')}
                style={({ hovered }) => [
                  styles.switchRow,
                  Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
                  hovered && { opacity: 0.7 },
                ]}
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
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
  },
  langRow: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  header: { marginBottom: 32 },
  logoDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accent,
    marginBottom: 14,
  },
  brand: { ...typography.display, color: colors.text },
  tagline: { fontSize: 14, color: colors.textSecondary, marginTop: 8, lineHeight: 20 },

  tabsWrap: { marginBottom: 8 },

  form: { paddingTop: 8 },

  helperText: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  resendRow: { alignItems: 'center', marginTop: 14, paddingVertical: 6 },
  resendText: { fontSize: 13, color: colors.accent, fontWeight: '600' },

  errBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errText: { color: colors.danger, fontSize: 13, fontWeight: '500' },

  switchRow: { alignItems: 'center', marginTop: 20, paddingVertical: 6 },
  switchText: { fontSize: 13, color: colors.textSecondary },
  switchTextStrong: { color: colors.accent, fontWeight: '600' },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  avatarPick: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  avatarPickPlus: {
    color: colors.accent,
    fontWeight: '300',
    fontSize: 36,
    lineHeight: 38,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  avatarHint: {
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});

const fieldStyles = StyleSheet.create({
  wrap: { marginTop: 14 },
  label: { ...typography.label, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: '#fff',
    boxShadow: '0 0 0 4px rgba(122, 18, 48, 0.14)',
  },
});
