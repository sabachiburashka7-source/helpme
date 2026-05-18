import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, radius, shadows, transitions, typography } from '../components/theme';
import { Button } from '../components/Button';
import SegmentedTabs from '../components/SegmentedTabs';
import FadeInUp from '../components/FadeInUp';
import MapPicker from '../components/MapPicker';

function Field({ label, multiline, ...inputProps }) {
  const [isFocused, setFocused] = useState(false);
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
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
          multiline && fieldStyles.textArea,
          isFocused && fieldStyles.inputFocused,
          Platform.OS === 'web' && { transition: transitions.base, outlineStyle: 'none' },
        ]}
      />
    </View>
  );
}

export default function MyRequestsScreen({ user, myOffers, onAddOffer, onUpdateOffer, onLogout }) {
  const [tab, setTab] = useState('new');
  const [form, setForm] = useState({
    description: '', price: '', location: '', latitude: null, longitude: null,
  });
  const [locationMode, setLocationMode] = useState('manual'); // 'manual' | 'gps'
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [gpsError, setGpsError] = useState('');

  function resetForm() {
    setForm({ description: '', price: '', location: '', latitude: null, longitude: null });
    setLocationMode('manual');
    setGpsStatus('idle');
    setGpsError('');
  }

  function detectLocation() {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('Geolocation is not available on this device');
      return;
    }
    setGpsStatus('loading');
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setForm((f) => ({
          ...f,
          latitude: lat,
          longitude: lng,
          location: `Pinned location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        }));
        setGpsStatus('success');
      },
      (err) => {
        setGpsStatus('error');
        setGpsError(err.message || 'Could not get location');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function switchMode(mode) {
    setLocationMode(mode);
    setGpsStatus('idle');
    setGpsError('');
    setForm((f) => ({ ...f, location: '', latitude: null, longitude: null }));
  }

  const profile = {
    name: user?.name || 'You',
    avatar: (user?.name || 'ME').slice(0, 2).toUpperCase(),
    phone: user?.phone || '',
  };

  async function generateImage(id, description, category) {
    try {
      const r = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, category, id }),
      });
      if (!r.ok) {
        onUpdateOffer?.(id, { generatingImage: false });
        return;
      }
      const data = await r.json();
      onUpdateOffer?.(id, { image: data.image, generatingImage: false });
    } catch {
      onUpdateOffer?.(id, { generatingImage: false });
    }
  }

  async function handleSubmit() {
    if (!form.description.trim()) return Alert.alert('Missing', 'Add a description.');
    if (!form.price.trim()) return Alert.alert('Missing', 'Add a price.');
    if (!form.location.trim()) return Alert.alert('Missing', 'Add a location.');
    const { description } = form;
    const payload = {
      description: form.description,
      price: Number(form.price),
      location: form.location,
      latitude: form.latitude,
      longitude: form.longitude,
      category: 'Other',
    };
    resetForm();
    setTab('mine');
    const id = await onAddOffer(payload);
    if (id && onUpdateOffer) {
      generateImage(id, description, 'Other');
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Profile */}
        <FadeInUp>
          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.avatar}</Text>
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
              <Text style={styles.profileSub} numberOfLines={1}>{profile.phone}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{myOffers.length}</Text>
              <Text style={styles.statLabel}>posted</Text>
            </View>
            {onLogout ? (
              <Button
                title="Sign out"
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={onLogout}
                style={{ marginLeft: 10 }}
              />
            ) : null}
          </View>
        </FadeInUp>

        {/* Tabs */}
        <View style={styles.tabsWrap}>
          <SegmentedTabs
            tabs={[
              { value: 'new', label: 'New request' },
              { value: 'mine', label: 'Mine' },
            ]}
            value={tab}
            onChange={setTab}
            hideIndicator
          />
        </View>

        {tab === 'new' ? (
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FadeInUp>
              <Field
                label="Description"
                placeholder="What do you need help with?"
                multiline
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              />
            </FadeInUp>

            <FadeInUp delay={50}>
              <Field
                label="Price (USD)"
                placeholder="50"
                keyboardType="numeric"
                value={form.price}
                onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
              />
            </FadeInUp>

            <FadeInUp delay={100}>
              <View style={fieldStyles.wrap}>
                <Text style={fieldStyles.label}>Location</Text>
                <View style={locStyles.modeRow}>
                  <Pressable
                    onPress={() => switchMode('gps')}
                    style={[locStyles.modeBtn, locationMode === 'gps' && locStyles.modeBtnActive]}
                  >
                    <Text style={[locStyles.modeBtnText, locationMode === 'gps' && locStyles.modeBtnTextActive]}>
                      Use my location
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => switchMode('manual')}
                    style={[locStyles.modeBtn, locationMode === 'manual' && locStyles.modeBtnActive]}
                  >
                    <Text style={[locStyles.modeBtnText, locationMode === 'manual' && locStyles.modeBtnTextActive]}>
                      Type address
                    </Text>
                  </Pressable>
                </View>

                {locationMode === 'gps' ? (
                  <View style={locStyles.gpsBox}>
                    {gpsStatus === 'success' && form.latitude != null ? (
                      <>
                        <Text style={locStyles.gpsTitle}>Location pinned</Text>
                        <Text style={locStyles.gpsHelp}>
                          Drag the pin on the map to adjust
                        </Text>
                        <MapPicker
                          latitude={form.latitude}
                          longitude={form.longitude}
                          onChange={(lat, lng) =>
                            setForm((f) => ({
                              ...f,
                              latitude: lat,
                              longitude: lng,
                              location: `Pinned location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                            }))
                          }
                          height={220}
                        />
                        <View style={locStyles.gpsFooter}>
                          <Text style={locStyles.gpsCoords}>
                            {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                          </Text>
                          <Pressable onPress={detectLocation} style={locStyles.gpsRefresh}>
                            <Text style={locStyles.gpsRefreshText}>Re-detect</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : gpsStatus === 'loading' ? (
                      <Text style={locStyles.gpsHint}>Detecting your location…</Text>
                    ) : (
                      <>
                        <Text style={locStyles.gpsHint}>
                          {gpsStatus === 'error'
                            ? gpsError || 'Could not get location'
                            : 'Tap detect to pin your current location on the map'}
                        </Text>
                        <Pressable onPress={detectLocation} style={locStyles.gpsBtn}>
                          <Text style={locStyles.gpsBtnText}>Detect my location</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                ) : (
                  <TextInput
                    placeholder="City, State or full address"
                    placeholderTextColor={colors.textMuted}
                    value={form.location}
                    onChangeText={(v) => setForm((f) => ({ ...f, location: v, latitude: null, longitude: null }))}
                    style={[
                      fieldStyles.input,
                      Platform.OS === 'web' && { transition: transitions.base, outlineStyle: 'none' },
                    ]}
                  />
                )}
              </View>
            </FadeInUp>

            <View style={{ height: 24 }} />
            <FadeInUp delay={150}>
              <Button title="Post request" size="lg" onPress={handleSubmit} />
            </FadeInUp>
            <View style={{ height: 32 }} />
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.myList}
            showsVerticalScrollIndicator={false}
          >
            {myOffers.length === 0 ? (
              <FadeInUp>
                <View style={styles.empty}>
                  <View style={styles.emptyDot} />
                  <Text style={styles.emptyTitle}>No requests yet</Text>
                  <Text style={styles.emptySub}>Tap "New request" to post your first one</Text>
                </View>
              </FadeInUp>
            ) : (
              myOffers.map((offer, i) => (
                <FadeInUp key={offer.id} delay={Math.min(i * 40, 240)}>
                  <MyOfferCard offer={offer} />
                </FadeInUp>
              ))
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function MyOfferCard({ offer }) {
  return (
    <View style={styles.myCard}>
      {offer.image ? (
        <View style={[styles.myCardImage, { backgroundImage: `url("${offer.image}")` }]} />
      ) : offer.generatingImage ? (
        <View style={styles.myCardImagePlaceholder}>
          <View style={styles.spinDot} />
          <Text style={styles.myCardImagePlaceholderText}>Generating image…</Text>
        </View>
      ) : null}
      <View style={styles.myCardTop}>
        <Text style={styles.myCardPrice}>${offer.price}</Text>
      </View>
      <Text style={styles.myCardDesc}>{offer.description}</Text>
      <View style={styles.myCardFooter}>
        <Text style={styles.myCardLocIcon}>📍</Text>
        <Text style={styles.myCardLoc}>{offer.location}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    ...shadows.button,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  profileName: { fontSize: 16, fontWeight: '700', color: colors.text },
  profileSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  statBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statNum: { fontSize: 16, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 9, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },

  tabsWrap: { paddingHorizontal: 20 },

  form: { paddingHorizontal: 20, paddingTop: 16 },

  myList: { paddingHorizontal: 20, paddingTop: 16 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyDot: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textTertiary, marginTop: 6 },

  myCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
    ...shadows.card,
  },
  myCardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceAlt,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderRadius: radius.md,
    marginBottom: 12,
  },
  myCardImagePlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  spinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  myCardImagePlaceholderText: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  myCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  myCardPrice: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  myCardDesc: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 8 },
  myCardFooter: { flexDirection: 'row', alignItems: 'center' },
  myCardLocIcon: { fontSize: 11, marginRight: 4 },
  myCardLoc: { fontSize: 12, color: colors.textSecondary },
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
    boxShadow: '0 0 0 4px rgba(79, 70, 229, 0.12)',
  },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
});

const locStyles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  modeBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeBtnTextActive: {
    color: colors.accent,
  },
  gpsBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'stretch',
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  gpsHelp: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 10,
  },
  gpsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  gpsCoords: {
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  gpsHint: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 10,
    lineHeight: 18,
  },
  gpsBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  gpsBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  gpsRefresh: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gpsRefreshText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
