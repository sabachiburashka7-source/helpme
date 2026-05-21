import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, Animated, Easing,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, radius, shadows, typography } from '../components/theme';
import FadeInUp from '../components/FadeInUp';
import MapPicker from '../components/MapPicker';
import { useTranslation, LanguageSwitcher } from '../components/i18n';
import { pickProfileImage, pickOfferImages, isImageUrl } from '../components/profileImage';
import { reverseGeocode } from '../components/reverseGeocode';
import { apiUrl } from '../components/apiBase';
import { getCurrentLocation } from '../components/location';
import { BgImage } from '../components/BgImage';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAX_OFFER_IMAGES = 6;
const ACCENT = '#7A1230';
const liveDark = { backgroundColor: ACCENT };

function confirmDialog(title, message) {
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
      <View
        style={[
          fieldStyles.inputWrap,
          multiline && fieldStyles.textAreaWrap,
          isFocused && fieldStyles.inputWrapFocused,
        ]}
      >
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
          style={[fieldStyles.input, multiline && fieldStyles.textArea]}
        />
      </View>
    </View>
  );
}

function PillTabs({ tabs, value, onChange }) {
  const [innerW, setInnerW] = useState(0);
  const tx = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, tabs.findIndex((t) => t.value === value));
  const segmentW = innerW > 0 ? (innerW - 8) / tabs.length : 0; // 4 padding each side

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
              {
                width: segmentW,
                transform: [{ translateX: tx }],
              },
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

function SoftButton({ title, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: 'stretch' }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={btnStyles.base}
      >
        <Text style={btnStyles.text}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

function OutlinePill({ title, onPress }) {
  return (
    <Pressable onPress={onPress} style={pillStyles.base}>
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
  const { t, lang } = useTranslation();

  const [tab, setTab] = useState('new');
  const [form, setForm] = useState({
    description: '', price: '', location: '', latitude: null, longitude: null, images: [],
  });
  const [locationMode, setLocationMode] = useState('manual');
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [gpsError, setGpsError] = useState('');

  function resetForm() {
    setForm({ description: '', price: '', location: '', latitude: null, longitude: null, images: [] });
    setLocationMode('manual');
    setGpsStatus('idle');
    setGpsError('');
  }

  async function handlePickOfferImages() {
    try {
      const dataUrls = await pickOfferImages();
      if (!dataUrls || dataUrls.length === 0) return;
      setForm((f) => ({
        ...f,
        images: [...(f.images || []), ...dataUrls].slice(0, MAX_OFFER_IMAGES),
      }));
    } catch (err) {
      Alert.alert(t('Upload failed'), err?.message || t('Could not upload image'));
    }
  }

  function removeOfferImage(idx) {
    setForm((f) => ({ ...f, images: (f.images || []).filter((_, i) => i !== idx) }));
  }

  function applyPin(lat, lng) {
    setForm((f) => ({
      ...f,
      latitude: lat,
      longitude: lng,
      location: `Pinned location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    }));
    reverseGeocode(lat, lng, lang).then((name) => {
      if (!name) return;
      setForm((f) => {
        if (f.latitude !== lat || f.longitude !== lng) return f;
        return { ...f, location: name };
      });
    });
  }

  async function detectLocation() {
    setGpsStatus('loading');
    setGpsError('');
    try {
      const coords = await getCurrentLocation();
      applyPin(coords.latitude, coords.longitude);
      setGpsStatus('success');
    } catch (err) {
      setGpsStatus('error');
      setGpsError(err?.message || 'Could not get location');
    }
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
      const r = await fetch(apiUrl('/api/generate-image'), {
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
      images: Array.isArray(form.images) ? form.images : [],
    };
    resetForm();
    setTab('mine');
    const id = await onAddOffer(payload);
    if (id && onUpdateOffer) {
      generateImage(id, description, 'Other');
    }
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* Hero — soft-tinted rounded profile card */}
          <FadeInUp>
            <View style={styles.heroOuter}>
              <View style={styles.hero}>
                <View style={styles.heroTopRow}>
                  <LanguageSwitcher />
                  {onLogout ? (
                    <OutlinePill title={t('Sign out')} onPress={onLogout} />
                  ) : <View />}
                </View>

                <Pressable
                  onPress={handlePickProfileImage}
                  style={[
                    styles.avatarRing,
                  ]}
                >
                  <View
                    style={[
                      styles.avatar,
                      !isImageUrl(profile.profileImage) && liveDark,
                    ]}
                  >
                    {isImageUrl(profile.profileImage) ? (
                      <BgImage
                        source={profile.profileImage}
                        resizeMode="cover"
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.avatarPlus}>+</Text>
                    )}
                  </View>
                </Pressable>

                <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
                {profile.phone ? (
                  <Text style={styles.profileSub} numberOfLines={1}>{profile.phone}</Text>
                ) : null}
              </View>
            </View>
          </FadeInUp>

          {/* Pill tabs */}
          <PillTabs
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

              <FadeInUp delay={40}>
                <View style={fieldStyles.wrap}>
                  <Text style={fieldStyles.label}>{t('Photos (optional)')}</Text>
                  {(form.images || []).length > 0 ? (
                    <View style={photoStyles.thumbRow}>
                      {(form.images || []).map((src, i) => (
                        <View key={i} style={photoStyles.thumbWrap}>
                          <BgImage
                            source={src}
                            resizeMode="cover"
                            style={photoStyles.thumb}
                          />
                          <Pressable
                            onPress={() => removeOfferImage(i)}
                            style={photoStyles.removeBtn}
                            accessibilityLabel={t('Remove photo')}
                          >
                            <Text style={photoStyles.removeBtnText}>✕</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {(form.images || []).length < MAX_OFFER_IMAGES ? (
                    <Pressable onPress={handlePickOfferImages} style={photoStyles.addBtn}>
                      <View style={photoStyles.addBtnIcon}>
                        <Text style={photoStyles.addBtnPlus}>+</Text>
                      </View>
                      <Text style={photoStyles.addBtnText}>{t('Add photos')}</Text>
                    </Pressable>
                  ) : null}
                </View>
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
                          <View style={locStyles.mapWrap}>
                            <MapPicker
                              latitude={form.latitude}
                              longitude={form.longitude}
                              onChange={(lat, lng) => applyPin(lat, lng)}
                              height={220}
                            />
                          </View>
                          <View style={locStyles.gpsFooter}>
                            <Text style={locStyles.gpsCoords} numberOfLines={1}>
                              {form.location}
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
                          <Pressable onPress={detectLocation} style={[locStyles.gpsBtn, liveDark]}>
                            <Text style={locStyles.gpsBtnText}>{t('Detect my location')}</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={fieldStyles.inputWrap}>
                      <TextInput
                        placeholder={t('City, State or full address')}
                        placeholderTextColor={colors.textMuted}
                        value={form.location}
                        onChangeText={(v) => setForm((f) => ({ ...f, location: v, latitude: null, longitude: null }))}
                        style={fieldStyles.input}
                      />
                    </View>
                  )}
                </View>
              </FadeInUp>

              <View style={{ height: 28 }} />
              <FadeInUp delay={150}>
                <SoftButton title={t('Post request')} onPress={handleSubmit} />
              </FadeInUp>
              <View style={{ height: 36 }} />
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
              <View style={{ height: 28 }} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
        <BgImage source={offer.image} resizeMode="cover" style={styles.myCardImage} />
      ) : offer.generatingImage ? (
        <View style={styles.myCardImagePlaceholder}>
          <View style={[styles.spinDot, liveDark]} />
          <Text style={styles.myCardImagePlaceholderText}>{t('Generating image…')}</Text>
        </View>
      ) : null}

      <View style={styles.myCardBody}>
        <View style={styles.myCardTop}>
          <View style={styles.priceChip}>
            <Text style={styles.priceChipText}>${offer.price}</Text>
          </View>
          {onRemove ? (
            <Pressable onPress={handleDelete} style={styles.deleteBtn} accessibilityLabel={t('Delete')}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.myCardDesc}>{offer.description}</Text>

        <View style={styles.myCardFooter}>
          <Text style={styles.myCardLocIcon}>📍</Text>
          <Text style={styles.myCardLoc} numberOfLines={1}>{offer.location}</Text>
        </View>

        {Array.isArray(offer.images) && offer.images.length > 0 ? (
          <View style={styles.myCardPhotos}>
            {offer.images.map((src, i) => (
              <BgImage
                key={i}
                source={src}
                resizeMode="cover"
                style={styles.myCardPhoto}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Hero
  heroOuter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  hero: {
    backgroundColor: colors.accentSoft,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
  },
  heroTopRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 12,
    boxShadow: '0 10px 28px rgba(122, 18, 48, 0.22)',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarPlus: { color: '#fff', fontWeight: '300', fontSize: 40, lineHeight: 42 },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: colors.surfaceAlt,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  profileSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    textAlign: 'center',
  },

  form: { paddingHorizontal: 20, paddingTop: 18 },

  myList: { paddingHorizontal: 16, paddingTop: 18 },

  // Empty / loading
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textTertiary, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 },

  // Card
  myCard: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  myCardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceAlt,
  },
  myCardImagePlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  spinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  myCardImagePlaceholderText: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  myCardBody: { padding: 16 },
  myCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
  },
  priceChipText: {
    fontSize: 16,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.2,
  },
  myCardDesc: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 10,
  },
  myCardFooter: { flexDirection: 'row', alignItems: 'center' },
  myCardLocIcon: { fontSize: 12, marginRight: 6 },
  myCardLoc: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  myCardPhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  myCardPhoto: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
  },

  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '700',
    lineHeight: 14,
  },
});

const tabStyles = StyleSheet.create({
  outer: {
    paddingHorizontal: 20,
    marginBottom: 8,
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

const pillStyles = StyleSheet.create({
  base: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 12,
    color: ACCENT,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

const fieldStyles = StyleSheet.create({
  wrap: { marginTop: 16 },
  label: { ...typography.label, marginBottom: 8, marginLeft: 4 },
  inputWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 4,
    ...shadows.card,
  },
  inputWrapFocused: {
    borderColor: colors.accent,
    boxShadow: '0 0 0 4px rgba(122, 18, 48, 0.12)',
  },
  textAreaWrap: {
    borderRadius: 22,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
});

const photoStyles = StyleSheet.create({
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  thumbWrap: {
    width: 76,
    height: 76,
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 11,
  },
  addBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  addBtnIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addBtnPlus: {
    fontSize: 18,
    fontWeight: '500',
    color: ACCENT,
    lineHeight: 20,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
});

const locStyles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modeBtnActive: {
    backgroundColor: '#fff',
    boxShadow: '0 2px 8px rgba(15, 15, 30, 0.10)',
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  modeBtnTextActive: {
    color: ACCENT,
    fontWeight: '700',
  },
  gpsBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 16,
    alignItems: 'stretch',
    ...shadows.card,
  },
  gpsCenter: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  gpsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  gpsHelp: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 12,
    textAlign: 'center',
  },
  mapWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  gpsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
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
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    alignSelf: 'center',
    boxShadow: '0 8px 20px rgba(122, 18, 48, 0.28)',
  },
  gpsBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  gpsRefresh: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  gpsRefreshText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
