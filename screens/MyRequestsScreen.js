import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, Animated, Easing,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, glass, radius } from '../components/theme';
import FadeInUp from '../components/FadeInUp';
import MapPicker from '../components/MapPicker';
import { useTranslation, LanguageSwitcher } from '../components/i18n';
import { pickProfileImage, pickOfferImages, isImageUrl } from '../components/profileImage';
import { reverseGeocode } from '../components/reverseGeocode';
import { apiUrl } from '../components/apiBase';
import { getCurrentLocation } from '../components/location';
import { BgImage } from '../components/BgImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import ProfileScreen from './ProfileScreen';
import {
  AmbientBackground, GlassSurface, GlassField, GlassButton, GlassSegmented,
  GlassChip, PressableGlass,
} from '../components/Glass';

const MAX_OFFER_IMAGES = 6;
const ACCENT = '#7A1230';

function confirmDialog(title, message) {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

function LoadingState() {
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <GlassSurface tone="light" radius={30} shadow="base" style={styles.emptyCard}>
      <Animated.View style={[styles.emptyOrb, { opacity: pulse }]}>
        <View style={styles.emptyOrbCore} />
      </Animated.View>
      <Text style={styles.emptyTitle}>{t('Loading requests…')}</Text>
      <Text style={styles.emptySub}>{t('Hang tight')}</Text>
    </GlassSurface>
  );
}

const POST_QUOTA = { free: 3, pro: 15 };

function startOfMonthUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function postsThisMonthCount(offers) {
  const cutoff = startOfMonthUtc().getTime();
  return offers.filter((o) => {
    if (!o.created_at) return true; // optimistic temp offers — count them
    const t = new Date(o.created_at).getTime();
    return Number.isFinite(t) && t >= cutoff;
  }).length;
}

export default function MyRequestsScreen({ user, myOffers, loading, onAddOffer, onUpdateOffer, onRemoveOffer, onLogout, onDeleteAccount, onCancelSubscription, onUpgrade, onUpdateProfileImage }) {
  const { t, lang } = useTranslation();
  const tabBarHeight = useBottomTabBarHeight();
  const [profileOpen, setProfileOpen] = useState(false);

  const tier = user?.tier === 'pro' ? 'pro' : 'free';
  const quotaLimit = POST_QUOTA[tier];
  const quotaUsed = postsThisMonthCount(myOffers);
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);

  function showPaywall() {
    Alert.alert(
      t('Monthly limit reached'),
      t('You have used all {n} posts allowed this month. Please try again next month.').replace('{n}', String(quotaLimit)),
      [{ text: t('OK'), style: 'cancel' }]
    );
  }

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
    // Cheap pre-check so the user gets the paywall before we wipe the form.
    // The server enforces this independently as the source of truth.
    if (quotaRemaining <= 0) {
      showPaywall();
      return;
    }
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
    const result = await onAddOffer(payload);
    if (result && typeof result === 'object' && result.error === 'quota_exceeded') {
      showPaywall();
      return;
    }
    const id = typeof result === 'string' ? result : null;
    if (id && onUpdateOffer) {
      generateImage(id, description, 'Other');
    }
  }

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.container}>
            <FadeInUp>
              <View style={styles.heroOuter}>
                <GlassSurface tone="light" radius={32} shadow="lifted" style={styles.hero}>
                  <View style={styles.heroTopRow}>
                    <LanguageSwitcher />
                    <GlassChip label={t('Profile')} onPress={() => setProfileOpen(true)} />
                  </View>

                  <Pressable onPress={handlePickProfileImage}>
                    <GlassSurface
                      tone="strong"
                      radius={radius.pill}
                      shadow="base"
                      style={styles.avatarRing}
                    >
                      <View style={styles.avatar}>
                        {isImageUrl(profile.profileImage) ? (
                          <BgImage
                            source={profile.profileImage}
                            resizeMode="cover"
                            style={styles.avatarImage}
                          />
                        ) : (
                          <View style={styles.avatarEmpty}>
                            <Text style={styles.avatarPlus}>+</Text>
                          </View>
                        )}
                      </View>
                    </GlassSurface>
                  </Pressable>

                  <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
                  {profile.phone ? (
                    <Text style={styles.profileSub} numberOfLines={1}>{profile.phone}</Text>
                  ) : null}

                  <View style={styles.quotaRow}>
                    {tier === 'pro' ? (
                      <View style={styles.tierBadgePro}>
                        <Text style={styles.tierBadgeTextPro}>{t('Pro')}</Text>
                      </View>
                    ) : null}
                    <GlassSurface
                      tone="soft"
                      radius={radius.pill}
                      shadow="none"
                      sheen={false}
                      style={styles.quotaPill}
                    >
                      <Text style={styles.quotaText}>
                        {t('{used}/{limit} posts this month')
                          .replace('{used}', String(Math.min(quotaUsed, quotaLimit)))
                          .replace('{limit}', String(quotaLimit))}
                      </Text>
                    </GlassSurface>
                  </View>
                </GlassSurface>
              </View>
            </FadeInUp>

            <View style={styles.tabsWrap}>
              <GlassSegmented
                tabs={[
                  { value: 'new', label: t('New request') },
                  { value: 'mine', label: t('Mine') },
                ]}
                value={tab}
                onChange={setTab}
              />
            </View>

            {tab === 'new' ? (
              <ScrollView
                contentContainerStyle={[styles.form, { paddingBottom: tabBarHeight + 40 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <FadeInUp>
                  <GlassField
                    label={t('Description')}
                    placeholder={t('What do you need help with?')}
                    multiline
                    value={form.description}
                    onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                  />
                </FadeInUp>

                <FadeInUp delay={50}>
                  <GlassField
                    label={t('Price (GEL)')}
                    placeholder="50"
                    keyboardType="numeric"
                    value={form.price}
                    onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                    left={<Text style={styles.currencyMark}>₾</Text>}
                    inputStyle={{ paddingLeft: 8 }}
                  />
                </FadeInUp>

                <FadeInUp delay={100}>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{t('Location')}</Text>
                    <GlassSegmented
                      tabs={[
                        { value: 'gps', label: t('Use my location') },
                        { value: 'manual', label: t('Type address') },
                      ]}
                      value={locationMode}
                      onChange={switchMode}
                      style={{ marginBottom: 12 }}
                    />

                    {locationMode === 'gps' ? (
                      <GlassSurface tone="light" radius={28} shadow="base" style={styles.gpsBox}>
                        {gpsStatus === 'success' && form.latitude != null ? (
                          <>
                            <Text style={styles.gpsTitle}>{t('Location pinned')}</Text>
                            <Text style={styles.gpsHelp}>{t('Drag the pin on the map to adjust')}</Text>
                            <View style={styles.mapWrap}>
                              <MapPicker
                                latitude={form.latitude}
                                longitude={form.longitude}
                                onChange={(lat, lng) => applyPin(lat, lng)}
                                height={220}
                              />
                            </View>
                            <View style={styles.gpsFooter}>
                              <Text style={styles.gpsCoords} numberOfLines={1}>{form.location}</Text>
                              <GlassChip label={t('Re-detect')} onPress={detectLocation} />
                            </View>
                          </>
                        ) : gpsStatus === 'loading' ? (
                          <Text style={styles.gpsHint}>{t('Detecting your location…')}</Text>
                        ) : (
                          <View style={styles.gpsCenter}>
                            <Text style={styles.gpsHint}>
                              {gpsStatus === 'error'
                                ? gpsError || t('Could not get location')
                                : t('Tap detect to pin your current location on the map')}
                            </Text>
                            <GlassButton
                              title={t('Detect my location')}
                              onPress={detectLocation}
                              size="sm"
                            />
                          </View>
                        )}
                      </GlassSurface>
                    ) : (
                      <GlassSurface tone="strong" radius={radius.lg} shadow="subtle" style={styles.plainInputWrap}>
                        <TextInput
                          placeholder={t('City, State or full address')}
                          placeholderTextColor={colors.textMuted}
                          value={form.location}
                          onChangeText={(v) => setForm((f) => ({ ...f, location: v, latitude: null, longitude: null }))}
                          style={styles.plainInput}
                        />
                      </GlassSurface>
                    )}
                  </View>
                </FadeInUp>

                <FadeInUp delay={140}>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{t('Photos (optional)')}</Text>
                    {(form.images || []).length > 0 ? (
                      <View style={styles.thumbRow}>
                        {(form.images || []).map((src, i) => (
                          <View key={i} style={styles.thumbWrap}>
                            <View style={styles.thumb}>
                              <BgImage source={src} resizeMode="cover" style={styles.thumbImage} />
                            </View>
                            <Pressable
                              onPress={() => removeOfferImage(i)}
                              style={styles.removeBtn}
                              accessibilityLabel={t('Remove photo')}
                            >
                              <Text style={styles.removeBtnText}>✕</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {(form.images || []).length < MAX_OFFER_IMAGES ? (
                      <PressableGlass onPress={handlePickOfferImages} scaleTo={0.98}>
                        <GlassSurface tone="soft" radius={24} shadow="none" style={styles.addBtn}>
                          <View style={styles.addBtnIcon}>
                            <Text style={styles.addBtnPlus}>+</Text>
                          </View>
                          <Text style={styles.addBtnText}>{t('Add photos')}</Text>
                        </GlassSurface>
                      </PressableGlass>
                    ) : null}
                  </View>
                </FadeInUp>

                <View style={{ height: 30 }} />
                <FadeInUp delay={170}>
                  <GlassButton
                    title={t('Post request')}
                    onPress={handleSubmit}
                    size="lg"
                    style={{ alignSelf: 'stretch' }}
                  />
                </FadeInUp>
              </ScrollView>
            ) : (
              <ScrollView
                contentContainerStyle={[styles.myList, { paddingBottom: tabBarHeight + 30 }]}
                showsVerticalScrollIndicator={false}
              >
                {myOffers.length === 0 ? (
                  loading ? (
                    <LoadingState />
                  ) : (
                    <FadeInUp>
                      <GlassSurface tone="light" radius={30} shadow="base" style={styles.emptyCard}>
                        <View style={styles.emptyOrb}>
                          <View style={styles.emptyOrbCore} />
                        </View>
                        <Text style={styles.emptyTitle}>{t('No requests yet')}</Text>
                        <Text style={styles.emptySub}>{t('Tap "New request" to post your first one')}</Text>
                      </GlassSurface>
                    </FadeInUp>
                  )
                ) : (
                  myOffers.map((offer, i) => (
                    <FadeInUp key={offer.id} delay={Math.min(i * 40, 240)}>
                      <MyOfferCard offer={offer} onRemove={onRemoveOffer} />
                    </FadeInUp>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ProfileScreen
        visible={profileOpen}
        user={user}
        onClose={() => setProfileOpen(false)}
        onLogout={onLogout}
        onDeleteAccount={onDeleteAccount}
        onCancelSubscription={onCancelSubscription}
        onUpgrade={onUpgrade}
      />
    </AmbientBackground>
  );
}

function MyOfferCard({ offer, onRemove }) {
  const { t } = useTranslation();

  async function handleDelete() {
    const ok = await confirmDialog(t('Delete request?'), t('This will permanently remove this request.'));
    if (!ok) return;
    onRemove?.(offer.id);
  }

  const hasVisual = !!offer.image || !!offer.generatingImage;

  return (
    <View style={styles.myCardWrap}>
      {hasVisual ? (
        <View style={styles.myCardImageFrame}>
          {offer.image ? (
            <BgImage source={offer.image} resizeMode="cover" style={styles.myCardImage} />
          ) : (
            <View style={styles.myCardImagePlaceholder}>
              <View style={styles.spinDot} />
              <Text style={styles.myCardImagePlaceholderText}>{t('Generating image…')}</Text>
            </View>
          )}
        </View>
      ) : null}

      <GlassSurface
        tone="strong"
        radius={28}
        shadow="base"
        style={[styles.myCardPanel, hasVisual && styles.myCardPanelOverlap]}
      >
        <View style={styles.myCardTop}>
          <GlassSurface tone="accent" radius={radius.pill} shadow="none" style={styles.priceChip}>
            <Text style={styles.priceChipText}>₾{offer.price}</Text>
          </GlassSurface>
          {onRemove ? (
            <Pressable onPress={handleDelete} accessibilityLabel={t('Delete')}>
              <GlassSurface tone="soft" radius={radius.pill} shadow="none" style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </GlassSurface>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.myCardDesc}>{offer.description}</Text>

        <View style={styles.myCardFooter}>
          <View style={styles.locDot} />
          <Text style={styles.myCardLoc} numberOfLines={1}>{offer.location}</Text>
        </View>

        {Array.isArray(offer.images) && offer.images.length > 0 ? (
          <View style={styles.myCardPhotos}>
            {offer.images.map((src, i) => (
              <View key={i} style={styles.myCardPhoto}>
                <BgImage source={src} resizeMode="cover" style={styles.myCardPhotoImage} />
              </View>
            ))}
          </View>
        ) : null}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  container: { flex: 1 },

  // Hero
  heroOuter: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: 'center',
  },
  heroTopRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatarRing: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
  },
  avatarEmpty: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlus: { color: '#fff', fontWeight: '300', fontSize: 32, lineHeight: 34 },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  profileSub: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 3,
    textAlign: 'center',
    fontWeight: '600',
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 8,
    flexWrap: 'wrap',
  },
  quotaPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  quotaText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  tierBadgePro: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: ACCENT,
  },
  tierBadgeTextPro: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#fff',
  },

  tabsWrap: { paddingHorizontal: 20, marginBottom: 4 },

  form: { paddingHorizontal: 20, paddingTop: 12 },
  myList: { paddingHorizontal: 16, paddingTop: 16 },

  fieldBlock: { marginTop: 18 },
  fieldLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 6,
  },
  currencyMark: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.accent,
    paddingLeft: 16,
  },
  plainInputWrap: { paddingHorizontal: 2 },
  plainInput: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: colors.text,
  },

  // Empty / loading
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  emptyOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: glass.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: glass.accentStroke,
  },
  emptyOrbCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptySub: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 19,
  },

  // My offer card
  myCardWrap: { marginBottom: 20 },
  myCardImageFrame: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.stroke,
    backgroundColor: colors.surfaceAlt,
    shadowColor: '#0F0F1E',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  myCardImage: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  myCardImagePlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  spinDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 8,
    backgroundColor: ACCENT,
  },
  myCardImagePlaceholderText: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  myCardPanel: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  myCardPanelOverlap: {
    marginTop: -42,
    marginHorizontal: 12,
  },
  myCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceChip: {
    paddingHorizontal: 15,
    paddingVertical: 7,
  },
  priceChipText: {
    fontSize: 16,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.2,
  },
  myCardDesc: {
    fontSize: 14.5,
    color: colors.text,
    lineHeight: 21,
    marginBottom: 12,
    fontWeight: '500',
  },
  myCardFooter: { flexDirection: 'row', alignItems: 'center' },
  locDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
    opacity: 0.55,
    marginRight: 7,
  },
  myCardLoc: { fontSize: 12.5, color: colors.textSecondary, flexShrink: 1, fontWeight: '500' },
  myCardPhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  myCardPhoto: {
    width: 74,
    height: 74,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.stroke,
    backgroundColor: colors.surfaceAlt,
  },
  myCardPhotoImage: { width: '100%', height: '100%' },

  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '800',
    lineHeight: 15,
  },

  // GPS box
  gpsBox: {
    padding: 16,
    alignItems: 'stretch',
  },
  gpsCenter: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  gpsTitle: {
    fontSize: 15,
    fontWeight: '800',
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
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: glass.stroke,
  },
  gpsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  gpsCoords: {
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
    fontWeight: '500',
  },
  gpsHint: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 16,
    lineHeight: 19,
    textAlign: 'center',
  },

  // Photos
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  thumbWrap: {
    width: 76,
    height: 76,
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.stroke,
    backgroundColor: colors.surfaceAlt,
  },
  thumbImage: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
  },
  addBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 60,
    borderStyle: 'dashed',
    borderColor: glass.accentStroke,
  },
  addBtnIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: glass.accentFillMd,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addBtnPlus: {
    fontSize: 19,
    fontWeight: '500',
    color: ACCENT,
    lineHeight: 21,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
});
