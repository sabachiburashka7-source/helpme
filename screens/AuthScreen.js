import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function submit() {
    setError('');
    if (!phone.trim()) return setError('Enter your phone number');
    if (!password) return setError('Enter your password');
    if (isRegister && !name.trim()) return setError('Enter your name');

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
        setError(data?.error || 'Something went wrong');
        setBusy(false);
        return;
      }
      onAuthenticated(data);
    } catch {
      setError('Network error. Try again.');
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>helpme</Text>
          <Text style={styles.tagline}>
            {isRegister ? 'Create your account' : 'Welcome back'}
          </Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, !isRegister && styles.tabActive]}
            onPress={() => switchMode('login')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, isRegister && styles.tabActive]}
            onPress={() => switchMode('register')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>
              Register
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {isRegister && (
            <>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#BBB"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </>
          )}

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 555-1234"
            placeholderTextColor="#BBB"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Min. 4 characters"
            placeholderTextColor="#BBB"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submit, busy && styles.submitBusy]}
            onPress={submit}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {isRegister ? 'Create account' : 'Sign in'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => switchMode(isRegister ? 'login' : 'register')}
            activeOpacity={0.7}
          >
            <Text style={styles.switchText}>
              {isRegister
                ? 'Already have an account? Sign in'
                : "New here? Create an account"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: { marginBottom: 36 },
  brand: { fontSize: 28, fontWeight: '800', color: '#000', letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: '#999', marginTop: 6 },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    marginBottom: 24,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 28,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: '#000' },
  tabText: { fontSize: 14, color: '#999', fontWeight: '500' },
  tabTextActive: { color: '#000', fontWeight: '600' },

  form: { flex: 1 },
  label: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000',
  },
  error: {
    color: '#C53030',
    fontSize: 13,
    marginTop: 14,
  },
  submit: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBusy: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { fontSize: 13, color: '#666' },
});
