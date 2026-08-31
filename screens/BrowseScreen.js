import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Modal, Animated, Easing,
  StyleSheet, Linking, TextInput, Pressable,
} from 'react-native';
import { colors, glass, radius, typography } from '../components/theme';
import FadeInUp from '../components/FadeInUp';
import { useTranslation } from '../components/i18n';
import { isImageUrl } from '../components/profileImage';
import { reverseGeocode, getCachedLocationName, isPinnedCoordinateString } from '../components/reverseGeocode';
import { getCurrentLocation } from '../components/location';
import { BgImage } from '../components/BgImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import MapPicker from '../components/MapPicker';
import {
  AmbientBackground, BlurSurface, GlassSurface, GlassChip, GlassButton,
  PressableGlass, usePressScale,
} from '../components/Glass';

function useDisplayLocation(offer) {
  const { lang } = useTranslation();
  const hasCoords = offer && typeof offer.latitude === 'number' && typeof offer.longitude === 'number';
  const needsGeocode = hasCoords && isPinnedCoordinateString(offer?.location);
  const initial = needsGeocode
    ? getCachedLocationName(offer.latitude, offer.longitude, lang) || offer.location
    : offer?.location || '';
  const [name, setName] = useState(initial);

  useEffect(() => {
    if (!needsGeocode) {
      setName(offer?.location || '');
      return;
    }
    const cached = getCachedLocationName(offer.latitude, offer.longitude, lang);
    if (cached) {
      setName(cached);
      return;
    }
    setName(offer.location);
    let alive = true;
    reverseGeocode(offer.latitude, offer.longitude, lang).then((n) => {
      if (alive && n) setName(n);
    });
    return () => { alive = false; };
  }, [offer?.id, offer?.latitude, offer?.longitude, offer?.location, needsGeocode, lang]);

  return name;
}

const HEADER_HEIGHT = 72;
const SEARCH_PANEL_HEIGHT = 148;

const buildRadiusOptions = (t) => [
  { value: null, label: t('Any') },
  { value: 1, label: '1 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
];

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function BrowseScreen({ dbOffers, loading }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [radiusKm, setRadiusKm] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [locStatus, setLocStatus] = useState('idle'); // idle | loading | granted | error
  const [locError, setLocError] = useState('');

  const headerOffset = useRef(new Animated.Value(0)).current;
  const headerVisible = useRef(true);
  const lastScrollY = useRef(0);

  const showHeader = () => {
    if (headerVisible.current) return;
    headerVisible.current = true;
    Animated.spring(headerOffset, {
      toValue: 0,
      useNativeDriver: true,
      speed: 16,
      bounciness: 4,
    }).start();
  };

  const hideHeader = () => {
    if (!headerVisible.current) return;
    headerVisible.current = false;
    Animated.spring(headerOffset, {
      toValue: -(HEADER_HEIGHT + insets.top),
      useNativeDriver: true,
      speed: 16,
      bounciness: 0,
    }).start();
  };

  const handleScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastScrollY.current;
    if (filterOpen || y < 10) showHeader();
    else if (dy > 6) hideHeader();
    else if (dy < -6) showHeader();
    lastScrollY.current = y;
  };

  async function pickRadius(km) {
    setRadiusKm(km);
    if (km == null) return;
    if (userCoords) return;
    setLocStatus('loading');
    setLocError('');
    try {
      const coords = await getCurrentLocation({ highAccuracy: false });
      setUserCoords({ lat: coords.latitude, lng: coords.longitude });
      setLocStatus('granted');
    } catch (err) {
      setLocStatus('error');
      setLocError(err?.message || t('Could not get location'));
      setRadiusKm(null);
    }
  }

  const allOffers = dbOffers.filter((o) => o.image);
  const filtered = allOffers.filter((o) => {
    if (search) {
      const q = search.toLowerCase();
      const matches =
        o.description.toLowerCase().includes(q) ||
        o.location.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (radiusKm != null && userCoords) {
      if (typeof o.latitude !== 'number' || typeof o.longitude !== 'number') return false;
      const d = haversineKm(userCoords, { lat: o.latitude, lng: o.longitude });
      if (d > radiusKm) return false;
    }
    return true;
  });

  return (
    <AmbientBackground>
      <ScrollView
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: HEADER_HEIGHT + insets.top + 14,
            paddingBottom: tabBarHeight + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {filtered.length === 0 && (
          loading ? (
            <LoadingState />
          ) : (
            <EmptyState
              title={t('No matches')}
              subtitle={t('Try a different search')}
            />
          )
        )}
        {filtered.map((offer, i) => (
          <FadeInUp key={offer.id} delay={Math.min(i * 40, 240)}>
            <OfferCard offer={offer} onPress={() => setSelected(offer)} />
          </FadeInUp>
        ))}
      </ScrollView>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.headerFloat,
          { transform: [{ translateY: headerOffset }] },
        ]}
      >
        <BlurSurface tone="soft" intensity={38} style={styles.headerBlur}>
          <View style={[styles.headerInner, { paddingTop: insets.top }]}>
            <View style={styles.headerBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>{t('Browse')}</Text>
                <Text style={styles.headerSub}>
                  {filtered.length} {filtered.length === 1 ? t('request') : t('requests')}
                  {radiusKm != null && userCoords ? ` · ${t('within')} ${radiusKm} km` : ` · ${t('nearby')}`}
                </Text>
              </View>
              <FilterButton
                open={filterOpen}
                onPress={() => {
                  if (filterOpen) setSearch('');
                  setFilterOpen((v) => !v);
                }}
              />
            </View>

            <SearchPanel
              open={filterOpen}
              value={search}
              onChange={setSearch}
              radiusKm={radiusKm}
              onPickRadius={pickRadius}
              locStatus={locStatus}
              locError={locError}
              t={t}
            />
          </View>
          <View pointerEvents="none" style={styles.headerHairline} />
        </BlurSurface>
      </Animated.View>

      <DetailsModal offer={selected} onClose={() => setSelected(null)} />
    </AmbientBackground>
  );
}

function EmptyState({ title, subtitle, pulseDot = false }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (!pulseDot) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseDot]);

  return (
    <GlassSurface tone="light" radius={30} shadow="base" style={styles.emptyCard}>
      <Animated.View style={[styles.emptyOrb, pulseDot && { opacity: pulse }]}>
        <View style={styles.emptyOrbCore} />
      </Animated.View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
    </GlassSurface>
  );
}

function LoadingState() {
  const { t } = useTranslation();
  return <EmptyState title={t('Loading requests…')} subtitle={t('Hang tight')} pulseDot />;
}

function SearchGlyph({ color }) {
  return (
    <View style={glyphStyles.searchWrap}>
      <View style={[glyphStyles.searchCircle, { borderColor: color }]} />
      <View style={[glyphStyles.searchHandle, { backgroundColor: color }]} />
    </View>
  );
}

function CloseGlyph({ color }) {
  return (
    <View style={glyphStyles.closeWrap}>
      <View style={[glyphStyles.closeBar, { backgroundColor: color, transform: [{ rotate: '45deg' }] }]} />
      <View style={[glyphStyles.closeBar, { backgroundColor: color, transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

function FilterButton({ open, onPress }) {
  const anim = useRef(new Animated.Value(0)).current;
  const { scale, onPressIn, onPressOut } = usePressScale(0.9);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 7,
    }).start();
  }, [open, anim]);

  const searchOpacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const searchScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });
  const closeOpacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const closeScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <GlassSurface
          tone={open ? 'accent' : 'strong'}
          radius={radius.pill}
          shadow="base"
          style={[
            styles.filterBtn,
            open && { backgroundColor: colors.accent, borderColor: glass.accentStrokeStrong },
          ]}
        >
          <Animated.View style={[glyphStyles.layer, { opacity: searchOpacity, transform: [{ scale: searchScale }] }]}>
            <SearchGlyph color={colors.accent} />
          </Animated.View>
          <Animated.View style={[glyphStyles.layer, { opacity: closeOpacity, transform: [{ scale: closeScale }] }]}>
            <CloseGlyph color="#fff" />
          </Animated.View>
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
}

const glyphStyles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    width: 18,
    height: 18,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  searchCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  searchHandle: {
    position: 'absolute',
    width: 2,
    height: 7,
    borderRadius: 1,
    bottom: 0,
    right: 1,
    transform: [{ rotate: '-45deg' }],
  },
  closeWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBar: {
    position: 'absolute',
    width: 16,
    height: 2,
    borderRadius: 1,
  },
});

function SearchPanel({ open, value, onChange, radiusKm, onPickRadius, locStatus, locError, t }) {
  const RADIUS_OPTIONS = buildRadiusOptions(t);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [open, anim]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, SEARCH_PANEL_HEIGHT] }),
        overflow: 'hidden',
      }}
    >
      <GlassSurface tone="strong" radius={radius.lg} shadow="subtle" style={styles.searchWrap}>
        <SearchGlyph color={colors.textTertiary} />
        <TextInput
          style={styles.search}
          placeholder={t('Search requests…')}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChange}
          autoFocus={open}
        />
      </GlassSurface>

      <View style={styles.radiusRow}>
        <Text style={styles.radiusLabel}>{t('Radius')}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.radiusChips}
        keyboardShouldPersistTaps="handled"
      >
        {RADIUS_OPTIONS.map((opt) => (
          <GlassChip
            key={String(opt.value)}
            label={opt.label}
            active={radiusKm === opt.value}
            onPress={() => onPickRadius(opt.value)}
            style={{ marginRight: 8 }}
          />
        ))}
      </ScrollView>

      {locStatus === 'loading' ? (
        <Text style={styles.radiusHint}>{t('Getting your location…')}</Text>
      ) : locStatus === 'error' ? (
        <Text style={[styles.radiusHint, styles.radiusError]}>{locError}</Text>
      ) : null}
    </Animated.View>
  );
}

function OfferCard({ offer, onPress }) {
  const { t } = useTranslation();
  const displayLocation = useDisplayLocation(offer);
  return (
    <PressableGlass onPress={onPress} style={styles.cardWrap} scaleTo={0.985}>
      <View style={styles.card}>
        <View style={styles.cardImageFrame}>
          <BgImage
            source={offer.image}
            resizeMode="cover"
            placeholderText={offer.category}
            style={styles.cardImage}
          >
            {offer.generatingImage && !offer.image ? (
              <GlassSurface tone="strong" radius={radius.pill} shadow="subtle" style={styles.imageLoadingBadge}>
                <View style={styles.spinDot} />
                <Text style={styles.imageLoadingText}>{t('Generating image…')}</Text>
              </GlassSurface>
            ) : null}
          </BgImage>
          <GlassSurface
            tone="dark"
            radius={radius.pill}
            shadow="subtle"
            style={styles.cardPriceTag}
          >
            <Text style={styles.cardPriceTagText}>₾{offer.price}</Text>
          </GlassSurface>
        </View>

        <GlassSurface tone="strong" radius={26} shadow="base" style={styles.cardPanel}>
          <Text style={styles.desc} numberOfLines={2}>{offer.description}</Text>
          <View style={styles.cardBottomRow}>
            <Text style={styles.cardName} numberOfLines={1}>{offer.name}</Text>
            <View style={styles.cardLocWrap}>
              <View style={styles.locDot} />
              <Text style={styles.cardLoc} numberOfLines={1}>{displayLocation}</Text>
            </View>
          </View>
        </GlassSurface>
      </View>
    </PressableGlass>
  );
}

function OfferMap({ offer, t }) {
  const hasCoords = typeof offer.latitude === 'number' && typeof offer.longitude === 'number';
  if (!hasCoords) return null;
  const linkHref = `https://www.google.com/maps/search/?api=1&query=${offer.latitude},${offer.longitude}`;
  return (
    <View style={styles.mapWrap}>
      <View style={styles.mapFrame}>
        <MapPicker
          latitude={offer.latitude}
          longitude={offer.longitude}
          onChange={() => {}}
          draggable={false}
          height={200}
        />
      </View>
      <Pressable onPress={() => Linking.openURL(linkHref)} style={styles.mapOpenBtn}>
        <Text style={styles.mapOpenText}>{t('Open in Google Maps ↗')}</Text>
      </Pressable>
    </View>
  );
}

function DetailsModal({ offer, onClose }) {
  const { t } = useTranslation();
  const open = !!offer;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const [renderOffer, setRenderOffer] = useState(offer);

  useEffect(() => {
    if (open) setRenderOffer(offer);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: open ? 1 : 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: open ? 1 : 0.94,
        useNativeDriver: true,
        speed: 18,
        bounciness: 6,
      }),
    ]).start(({ finished }) => {
      if (finished && !open) setRenderOffer(null);
    });
  }, [open, offer, opacity, scale]);

  const data = offer || renderOffer;
  const displayLocation = useDisplayLocation(data);
  if (!renderOffer && !open) return null;
  if (!data) return null;

  return (
    <Modal visible={open || !!renderOffer} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalBackdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.modalCardWrap, { transform: [{ scale }] }]}>
          <GlassSurface tone="light" radius={32} shadow="lifted" clip style={styles.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <BgImage
                source={data.image}
                resizeMode="cover"
                placeholderText={data.category}
                style={styles.modalImage}
              />

              <View style={styles.modalBody}>
                <GlassSurface tone="strong" radius={24} shadow="subtle" style={styles.modalHeaderCard}>
                  <View style={styles.modalHeaderRow}>
                    <View style={styles.avatar}>
                      {isImageUrl(data.profile_image) ? (
                        <BgImage
                          source={data.profile_image}
                          resizeMode="cover"
                          style={styles.avatarImage}
                        />
                      ) : (
                        <Text style={styles.avatarPlus}>
                          {(data.name || '?').slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalName} numberOfLines={1}>{data.name}</Text>
                      <Text style={styles.modalSub} numberOfLines={1}>{displayLocation}</Text>
                    </View>
                    <Text style={styles.modalPrice}>₾{data.price}</Text>
                  </View>
                </GlassSurface>

                <Text style={styles.modalDesc}>{data.description}</Text>

                <GlassSurface tone="soft" radius={20} shadow="none" style={styles.detailGroup}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('Number')}</Text>
                    <Text style={styles.detailValue}>{data.phone}</Text>
                  </View>
                </GlassSurface>

                <OfferMap offer={data} t={t} />

                {Array.isArray(data.images) && data.images.length > 0 ? (
                  <View style={styles.photoStripWrap}>
                    <Text style={styles.photoStripLabel}>{t('Photos')}</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.photoStripContent}
                    >
                      {data.images.map((src, i) => (
                        <View key={i} style={styles.photoStripTile}>
                          <BgImage source={src} resizeMode="cover" style={styles.photoStripImage} />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                <View style={{ height: 18 }} />
                <GlassButton
                  title={t('Call now')}
                  size="lg"
                  onPress={() => Linking.openURL(`tel:${data.phone}`)}
                  style={{ alignSelf: 'stretch' }}
                />
                <View style={{ height: 8 }} />
                <GlassButton
                  title={t('Close')}
                  variant="ghost"
                  size="md"
                  onPress={onClose}
                  style={{ alignSelf: 'stretch' }}
                />
              </View>
            </ScrollView>
          </GlassSurface>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerFloat: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBlur: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerInner: {
    paddingBottom: 10,
  },
  headerHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: glass.stroke,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
    height: HEADER_HEIGHT,
  },
  headerTitle: { ...typography.h1, fontSize: 26, letterSpacing: -0.5 },
  headerSub: { ...typography.caption, color: colors.textTertiary, marginTop: 3 },

  list: { paddingHorizontal: 16 },

  emptyCard: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 24,
    marginTop: 40,
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
  emptySub: { fontSize: 13, color: colors.textTertiary, marginTop: 6, textAlign: 'center' },

  filterBtn: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  searchWrap: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 3,
  },
  search: {
    flex: 1,
    paddingVertical: 11,
    paddingLeft: 12,
    fontSize: 14,
    color: colors.text,
  },

  radiusRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  radiusLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
  },
  radiusChips: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingRight: 16,
  },
  radiusHint: {
    fontSize: 11,
    color: colors.textTertiary,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  radiusError: { color: colors.danger },

  cardWrap: { marginBottom: 20 },
  card: { position: 'relative' },
  cardImageFrame: {
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
  cardImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPriceTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  cardPriceTagText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },

  imageLoadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  spinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  imageLoadingText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  cardPanel: {
    marginTop: -42,
    marginHorizontal: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  desc: { fontSize: 14.5, color: colors.text, lineHeight: 21, marginBottom: 12, fontWeight: '500' },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: { fontSize: 13, color: colors.text, fontWeight: '700', flexShrink: 1 },
  cardLocWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    flexShrink: 1,
  },
  locDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
    opacity: 0.55,
    marginRight: 6,
  },
  cardLoc: {
    fontSize: 12,
    color: colors.textTertiary,
    flexShrink: 1,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: glass.stroke,
  },
  avatarPlus: { color: '#fff', fontWeight: '700', fontSize: 18 },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: glass.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  modalCardWrap: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
  },
  modalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    overflow: 'hidden',
  },
  modalScrollContent: { paddingBottom: 0 },
  modalImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceAlt,
  },
  modalBody: { padding: 18 },
  modalHeaderCard: {
    padding: 12,
    marginTop: -46,
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalName: { fontSize: 16, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textTertiary, marginTop: 3 },
  modalPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: -0.5,
    marginLeft: 8,
  },
  modalDesc: { fontSize: 14.5, color: colors.text, lineHeight: 22, marginBottom: 4 },

  mapWrap: { marginTop: 14 },
  mapFrame: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.stroke,
    backgroundColor: colors.surfaceAlt,
  },
  mapOpenBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  mapOpenText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '700',
  },

  detailGroup: {
    marginTop: 14,
    paddingHorizontal: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '700',
  },
  detailValue: { fontSize: 14, color: colors.text, fontWeight: '700' },

  photoStripWrap: {
    marginTop: 20,
    marginHorizontal: -18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: glass.strokeSoft,
  },
  photoStripLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  photoStripContent: {
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  photoStripTile: {
    width: 150,
    height: 150,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.stroke,
    backgroundColor: colors.surfaceAlt,
    marginRight: 10,
  },
  photoStripImage: { width: '100%', height: '100%' },
});
