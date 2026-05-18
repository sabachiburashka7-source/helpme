import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, Animated, Easing,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, radius, shadows, transitions, typography } from '../components/theme';
import SegmentedTabs from '../components/SegmentedTabs';
import FadeInUp from '../components/FadeInUp';
import MapPicker from '../components/MapPicker';
import { useTranslation, LanguageSwitcher } from '../components/i18n';
import { pickProfileImage, isImageUrl } from '../components/profileImage';

const KEYFRAMES_ID = 'live-gradient-keyframes';
function ensureKeyframes() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const tag = document.createElement('style');
  tag.id = KEYFRAMES_ID;
  tag.textContent = `
    @keyframes liveGradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes liveGradientLine {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
  `;
  document.head.appendChild(tag);
}

const liveDark = Platform.OS === 'web'
  ? {
      backgroundImage:
        'linear-gradient(120deg, #2A040F 0%, #5A0E25 25%, #9C2A4C 50%, #5A0E25 75%, #2A040F 100%)',
      backgroundSize: '300% 300%',
      animation: 'liveGradient 8s ease-in-out infinite',
    }
  : { backgroundColor: '#7A1230' };

const liveLine = Platform.OS === 'web'
  ? {
      backgroundImage:
        'linear-gradient(90deg, #3D0612 0%, #D4658A 50%, #3D0612 100%)',
      backgroundSize: '200% 100%',
      animation: 'liveGradientLine 3.5s linear infinite',
    }
  : { backgroundColor: '#7A1230' };

function confirmDialog(title, message) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

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

function LiveTabs({ tabs, value, onChange }) {
  const [width, setWidth] = useState(0);
  const tx = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, tabs.findIndex((t) => t.value === value));
  const segmentW = width > 0 ? width / tabs.length : 0;

  useEffect(() => {
    if (segmentW === 0) return;
    Animated.spring(tx, {
      toValue: segmentW * index,
      useNativeDriver: true,
      speed: 22,
      bounciness: 6,
    }).start();
  }, [index, segmentW, tx]);

  return (
    <View style={tabStyles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={tabStyles.row}>
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <Pressable
              key={t.value}
              onPress={() => onChange(t.value)}
              style={({ hovered }) => [
                tabStyles.tab,
                Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
                hovered && !active && tabStyles.tabHover,
              ]}
            >
              <Text style={[tabStyles.text, active && tabStyles.textActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={tabStyles.track}>
        {segmentW > 0 ? (
          <Animated.View
            style={[
              tabStyles.thumb,
              liveLine,
              { width: segmentW - 24, transform: [{ translateX: tx }], marginLeft: 12 },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

function GradientButton({ title, onPress, size = 'lg' }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: 'stretch' }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={({ hovered }) => [
          gradStyles.base,
          size === 'lg' && gradStyles.lg,
          size === 'md' && gradStyles.md,
          liveDark,
          hovered && gradStyles.hover,
          Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
        ]}
      >
        <Text style={gradStyles.text}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

function OutlinePill({ title, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [
        pillStyles.base,
        hovered && pillStyles.hover,
        Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
      ]}
    >
      <Text style={pillStyles.text}>{title}</Text>
    </Pressable>
  );
}

function LoadingState() {
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.empty}>
      <Animated.View style={[styles.emptyDot, liveDark, { opacity: pulse }]} />
      <Text style={styles.emptyTitle}>{t('Loading requests…')}</Text>
      <Text style={styles.emptySub}>{t('Hang tight')}</Text>
    </View>
  );
}

export default function MyRequestsScreen({ user, myOffers, loading, onAddOffer, onUpdateOffer, onRemoveOffer, onLogout, onUpdateProfileImage }) {
  useEffect(() => { ensureKeyframes(); }, []);
  const { t } = useTranslation();

  const [tab, setTab] = useState('new');
  const [form, setForm] = useState({
    description: '', price: '', location: '', latitude: null, longitude: null,
  });
  const [locationMode, setLocationMode] = useState('manual');
  const [gpsStatus, setGpsStatus] = useState('idle');
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
    profileImage: user?.profile_image || null,
    phone: user?.phone || '',
  };

  async function handlePickProfileImage() {
    if (!onUpdateProfileImage) return;
    try {
      const dataUrl = await pickProfileImage();
      if (!dataUrl) return;
      await onUpdateProfileImage(dataUrl);
    } catch (err) {
      Alert.alert(t('Upload failed'), err?.message || t('Could not upload image'));
    }
  }

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
    if (!form.description.trim()) return Alert.alert(t('Missing'), t('Add a description.'));
    if (!form.price.trim()) return Alert.alert(t('Missing'), t('Add a price.'));
    if (!form.location.trim()) return Alert.alert(t('Missing'), t('Add a location.'));
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
        {/* Profile — centered, symmetric */}
        <FadeInUp>
          <View style={styles.profile}>
            <View style={styles.langWrap}>
              <LanguageSwitcher />
            </View>
            {onLogout ? (
              <View style={styles.signOutWrap}>
                <OutlinePill title={t('Sign out')} onPress={onLogout} />
              </View>
            ) : null}
            <Pressable
              onPress={handlePickProfileImage}
              style={({ hovered }) => [
                styles.avatar,
                !isImageUrl(profile.profileImage) && liveDark,
                Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
                hovered && { opacity: 0.92 },
              ]}
            >
              {isImageUrl(profile.profileImage) ? (
                <View
                  style={[
                    styles.avatarImage,
                    Platform.OS === 'web'
                      ? {
                          backgroundImage: `url("${profile.profileImage}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : null,
                  ]}
                />
              ) : (
                <Text style={styles.avatarPlus}>+</Text>
              )}
            </Pressable>
            <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
            {profile.phone ? (
              <Text style={styles.profileSub} numberOfLines={1}>{profile.phone}</Text>
            ) : null}
          </View>
        </FadeInUp>

        {/* Tabs */}
        <LiveTabs
          tabs={[
            { value: 'new', label: t('New request') },
            { value: 'mine', label: t('Mine') },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'new' ? (
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FadeInUp>
              <Field
                label={t('Description')}
                placeholder={t('What do you need help with?')}
                multiline
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              />
            </FadeInUp>

            <FadeInUp delay={50}>
              <Field
                label={t('Price (USD)')}
                placeholder="50"
                keyboardType="numeric"
                value={form.price}
                onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
              />
            </FadeInUp>

            <FadeInUp delay={100}>
              <View style={fieldStyles.wrap}>
                <Text style={fieldStyles.label}>{t('Location')}</Text>
                <View style={locStyles.modeRow}>
                  <Pressable
                    onPress={() => switchMode('gps')}
                    style={[locStyles.modeBtn, locationMode === 'gps' && locStyles.modeBtnActive]}
                  >
                    <Text style={[locStyles.modeBtnText, locationMode === 'gps' && locStyles.modeBtnTextActive]}>
                      {t('Use my location')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => switchMode('manual')}
                    style={[locStyles.modeBtn, locationMode === 'manual' && locStyles.modeBtnActive]}
                  >
                    <Text style={[locStyles.modeBtnText, locationMode === 'manual' && locStyles.modeBtnTextActive]}>
                      {t('Type address')}
                    </Text>
                  </Pressable>
                </View>

                {locationMode === 'gps' ? (
                  <View style={locStyles.gpsBox}>
                    {gpsStatus === 'success' && form.latitude != null ? (
                      <>
                        <Text style={locStyles.gpsTitle}>{t('Location pinned')}</Text>
                        <Text style={locStyles.gpsHelp}>
                          {t('Drag the pin on the map to adjust')}
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
                            <Text style={locStyles.gpsRefreshText}>{t('Re-detect')}</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : gpsStatus === 'loading' ? (
                      <Text style={locStyles.gpsHint}>{t('Detecting your location…')}</Text>
                    ) : (
                      <View style={locStyles.gpsCenter}>
                        <Text style={locStyles.gpsHint}>
                          {gpsStatus === 'error'
                            ? gpsError || t('Could not get location')
                            : t('Tap detect to pin your current location on the map')}
                        </Text>
                        <Pressable
                          onPress={detectLocation}
                          style={({ hovered }) => [
                            locStyles.gpsBtn,
                            liveDark,
                            hovered && { opacity: 0.92 },
                            Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
                          ]}
                        >
                          <Text style={locStyles.gpsBtnText}>{t('Detect my location')}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ) : (
                  <TextInput
                    placeholder={t('City, State or full address')}
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
              <GradientButton title={t('Post request')} onPress={handleSubmit} />
            </FadeInUp>
            <View style={{ height: 32 }} />
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.myList}
            showsVerticalScrollIndicator={false}
          >
            {myOffers.length === 0 ? (
              loading ? (
                <LoadingState />
              ) : (
                <FadeInUp>
                  <View style={styles.empty}>
                    <View style={[styles.emptyDot, liveDark]} />
                    <Text style={styles.emptyTitle}>{t('No requests yet')}</Text>
                    <Text style={styles.emptySub}>{t('Tap "New request" to post your first one')}</Text>
                  </View>
                </FadeInUp>
              )
            ) : (
              myOffers.map((offer, i) => (
                <FadeInUp key={offer.id} delay={Math.min(i * 40, 240)}>
                  <MyOfferCard offer={offer} onRemove={onRemoveOffer} />
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

function MyOfferCard({ offer, onRemove }) {
  const { t } = useTranslation();

  async function handleDelete() {
    const ok = await confirmDialog(t('Delete request?'), t('This will permanently remove this request.'));
    if (!ok) return;
    onRemove?.(offer.id);
  }

  return (
    <View style={styles.myCard}>
      {offer.image ? (
        <View style={[styles.myCardImage, { backgroundImage: `url("${offer.image}")` }]} />
      ) : offer.generatingImage ? (
        <View style={styles.myCardImagePlaceholder}>
          <View style={[styles.spinDot, liveDark]} />
          <Text style={styles.myCardImagePlaceholderText}>{t('Generating image…')}</Text>
        </View>
      ) : null}
      <View style={styles.myCardTop}>
        <Text style={styles.myCardPrice}>${offer.price}</Text>
        {onRemove ? (
          <Pressable
            onPress={handleDelete}
            style={({ hovered }) => [
              styles.deleteBtn,
              hovered && styles.deleteBtnHover,
              Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
            ]}
          >
            <DeleteGlyph />
            <Text style={styles.deleteBtnText}>{t('Delete')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.myCardDesc}>{offer.description}</Text>
      <View style={styles.myCardFooter}>
        <Text style={styles.myCardLocIcon}>📍</Text>
        <Text style={styles.myCardLoc}>{offer.location}</Text>
      </View>
    </View>
  );
}

function DeleteGlyph() {
  return <Text style={glyphStyles.icon}>✕</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  profile: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 18,
    paddingHorizontal: 20,
    position: 'relative',
  },
  signOutWrap: {
    position: 'absolute',
    top: 18,
    right: 20,
  },
  langWrap: {
    position: 'absolute',
    top: 18,
    left: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    boxShadow: '0 8px 24px rgba(122, 18, 48, 0.28)',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 20, letterSpacing: 0.5 },
  avatarPlus: { color: '#fff', fontWeight: '300', fontSize: 36, lineHeight: 38 },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: colors.surfaceAlt,
  },
  profileName: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  profileSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2, textAlign: 'center' },

  form: { paddingHorizontal: 20, paddingTop: 16 },

  myList: { paddingHorizontal: 20, paddingTop: 16 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyDot: {
    width: 40,
    height: 40,
    borderRadius: 12,
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

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  deleteBtnHover: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  deleteBtnText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginLeft: 6,
  },
});

const glyphStyles = StyleSheet.create({
  icon: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    lineHeight: 11,
  },
});

const tabStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabHover: { opacity: 0.85 },
  text: {
    fontSize: 14,
    color: colors.textTertiary,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  textActive: {
    color: colors.text,
    fontWeight: '700',
  },
  track: {
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 0,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 0,
    height: 2,
    borderRadius: 2,
  },
});

const gradStyles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(122, 18, 48, 0.32)',
  },
  md: { paddingVertical: 13, paddingHorizontal: 18 },
  lg: { paddingVertical: 15, paddingHorizontal: 22 },
  hover: { boxShadow: '0 14px 30px rgba(122, 18, 48, 0.42)' },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

const pillStyles = StyleSheet.create({
  base: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hover: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  text: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.2,
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
    fontWeight: '700',
  },
  gpsBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'stretch',
  },
  gpsCenter: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  gpsHelp: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 10,
    textAlign: 'center',
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
    marginBottom: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  gpsBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
  gpsBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
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
