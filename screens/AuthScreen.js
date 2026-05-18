import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Animated, Easing,
  KeyboardAvoidingView, Platform, ScrollView, Pressable,
} from 'react-native';
import { colors, radius, spacing, typography, transitions } from '../components/theme';
import { Button } from '../components/Button';
import SegmentedTabs from '../components/SegmentedTabs';
import FadeInUp from '../components/FadeInUp';
import { useTranslation, LanguageSwitcher } from '../components/i18n';

function Field({ label, focused, ...inputProps }) {
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
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const errAnim = useRef(new Animated.Value(0)).current;

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

  async function submit() {
    setError('');
    if (!phone.trim()) return flashError(t('Enter your phone number'));
    if (!password) return flashError(t('Enter your password'));
    if (isRegister && !name.trim()) return flashError(t('Enter your name'));

    setBusy(true);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isRegister ? 'register' : 'login',
          phone: phone.trim(),
          password,
          name: name.trim(),
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

  function switchMode(next) {
    setMode(next);
    setError('');
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
              {isRegister
                ? t('Create your account in seconds')
                : t('Welcome back — sign in to continue')}
            </Text>
          </View>
        </FadeInUp>

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

        <FadeInUp delay={140}>
          <View style={styles.form}>
            {isRegister && (
              <Field
                label={t('Name')}
                placeholder={t('Your name')}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}

            <Field
              label={t('Phone')}
              placeholder="+1 555-1234"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Field
              label={t('Password')}
              placeholder={t('Min. 4 characters')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

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
            <Button
              title={isRegister ? t('Create account') : t('Sign in')}
              onPress={submit}
              loading={busy}
              size="lg"
            />

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
