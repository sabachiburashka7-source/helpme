import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Modal, Animated, Easing,
  StyleSheet, Linking, TextInput, Pressable, Platform,
} from 'react-native';
import { colors, radius, shadows, transitions, typography } from '../components/theme';
import { Button, PressableScale } from '../components/Button';
import FadeInUp from '../components/FadeInUp';
import { useTranslation } from '../components/i18n';

const SVG_BY_CATEGORY = {
  Moving: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>
    <rect width='320' height='200' fill='#fff'/>
    <g fill='none' stroke='#4F46E5' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>
      <rect x='40' y='80' width='90' height='80'/>
      <path d='M40 105 L130 105'/>
      <path d='M85 80 L85 105'/>
      <path d='M150 120 L245 120'/>
      <path d='M225 105 L245 120 L225 135'/>
      <rect x='260' y='80' width='22' height='80' stroke-dasharray='5 5'/>
    </g>
  </svg>`,
  Assembly: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>
    <rect width='320' height='200' fill='#fff'/>
    <g fill='none' stroke='#4F46E5' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M60 160 L160 80'/>
      <path d='M55 165 L70 150 L80 160 L65 175 Z'/>
      <path d='M150 70 L175 55 L200 55 L210 75 L195 90 L170 90 Z'/>
      <polygon points='225,80 250,80 263,103 250,125 225,125 212,103'/>
      <circle cx='237.5' cy='102.5' r='5'/>
    </g>
  </svg>`,
  Home: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>
    <rect width='320' height='200' fill='#fff'/>
    <g fill='none' stroke='#4F46E5' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M40 170 L280 170'/>
      <path d='M80 90 L160 40 L240 90'/>
      <path d='M100 90 L100 170'/>
      <path d='M220 90 L220 170'/>
      <rect x='140' y='115' width='40' height='55'/>
      <circle cx='173' cy='143' r='2'/>
    </g>
  </svg>`,
  Other: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>
    <rect width='320' height='200' fill='#fff'/>
    <g fill='none' stroke='#4F46E5' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>
      <circle cx='100' cy='75' r='20'/>
      <path d='M100 95 L100 155'/>
      <path d='M100 115 L72 145'/>
      <path d='M100 115 L140 115'/>
      <path d='M100 155 L80 185'/>
      <path d='M100 155 L120 185'/>
      <path d='M170 120 L200 150 L255 75'/>
    </g>
  </svg>`,
};

function imageUrlFor(offer) {
  if (offer.image) return `url("${offer.image}")`;
  const svg = SVG_BY_CATEGORY[offer.category] || SVG_BY_CATEGORY.Other;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
const imageSizeFor = (offer) => (offer.image ? 'cover' : 'contain');

const HEADER_HEIGHT = 64;
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
      toValue: -HEADER_HEIGHT,
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

  function pickRadius(km) {
    setRadiusKm(km);
    if (km == null) return;
    if (userCoords) return;
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocStatus('error');
      setLocError(t('Geolocation not available'));
      setRadiusKm(null);
      return;
    }
    setLocStatus('loading');
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus('granted');
      },
      (err) => {
        setLocStatus('error');
        setLocError(err.message || t('Could not get location'));
        setRadiusKm(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
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

  const headerOpacity = headerOffset.interpolate({
    inputRange: [-HEADER_HEIGHT, -HEADER_HEIGHT / 2, 0],
    outputRange: [0, 0.4, 1],
  });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingTop: HEADER_HEIGHT + 8 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {filtered.length === 0 && (
          loading ? (
            <LoadingState />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyDot} />
              <Text style={styles.emptyTitle}>{t('No matches')}</Text>
              <Text style={styles.emptySub}>{t('Try a different search')}</Text>
            </View>
          )
        )}
        {filtered.map((offer, i) => (
          <FadeInUp key={offer.id} delay={Math.min(i * 40, 240)}>
            <OfferCard offer={offer} onPress={() => setSelected(offer)} />
          </FadeInUp>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.headerFloat,
          {
            opacity: headerOpacity,
            transform: [{ translateY: headerOffset }],
          },
        ]}
      >
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.headerTitle}>{t('Browse')}</Text>
            <Text style={styles.headerSub}>
              {filtered.length} {filtered.length === 1 ? t('request') : t('requests')}
              {radiusKm != null && userCoords ? ` · ${t('within')} ${radiusKm} km` : ` · ${t('nearby')}`}
            </Text>
          </View>
          <FilterButton
            open={filterOpen}
            onPress={() => {
              if (filterOpen) {
                setSearch('');
              }
              setFilterOpen((v) => !v);
            }}
          />
        </View>

        <SearchBar
          open={filterOpen}
          value={search}
          onChange={setSearch}
          radiusKm={radiusKm}
          onPickRadius={pickRadius}
          locStatus={locStatus}
          locError={locError}
          t={t}
        />
      </Animated.View>

      <DetailsModal offer={selected} onClose={() => setSelected(null)} />
    </View>
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
      <Animated.View style={[styles.emptyDot, { opacity: pulse }]} />
      <Text style={styles.emptyTitle}>{t('Loading requests…')}</Text>
      <Text style={styles.emptySub}>{t('Hang tight')}</Text>
    </View>
  );
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
    <PressableScale onPress={onPress} hoverLift>
      <View style={[styles.filterBtn, open && styles.filterBtnActive]}>
        <Animated.View style={[glyphStyles.layer, { opacity: searchOpacity, transform: [{ scale: searchScale }] }]}>
          <SearchGlyph color="#fff" />
        </Animated.View>
        <Animated.View style={[glyphStyles.layer, { opacity: closeOpacity, transform: [{ scale: closeScale }] }]}>
          <CloseGlyph color="#fff" />
        </Animated.View>
      </View>
    </PressableScale>
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

function SearchBar({ open, value, onChange, radiusKm, onPickRadius, locStatus, locError, t }) {
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
        height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 130] }),
        overflow: 'hidden',
      }}
    >
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={[
            styles.search,
            Platform.OS === 'web' && { outlineStyle: 'none', transition: transitions.base },
          ]}
          placeholder={t('Search requests…')}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChange}
          autoFocus={open}
        />
      </View>
      <View style={styles.radiusRow}>
        <Text style={styles.radiusLabel}>{t('Radius')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.radiusChips}
        >
          {RADIUS_OPTIONS.map((opt) => {
            const active = radiusKm === opt.value;
            return (
              <Pressable
                key={String(opt.value)}
                onPress={() => onPickRadius(opt.value)}
                style={[styles.radiusChip, active && styles.radiusChipActive]}
              >
                <Text style={[styles.radiusChipText, active && styles.radiusChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
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
  return (
    <PressableScale onPress={onPress} hoverLift style={styles.cardWrap}>
      <View style={styles.card}>
        <View
          style={[
            styles.cardImage,
            { backgroundImage: imageUrlFor(offer), backgroundSize: imageSizeFor(offer) },
          ]}
        >
          {offer.generatingImage && !offer.image ? (
            <View style={styles.imageLoadingBadge}>
              <View style={styles.spinDot} />
              <Text style={styles.imageLoadingText}>{t('Generating image…')}</Text>
            </View>
          ) : null}
          <View style={styles.cardPriceTag}>
            <Text style={styles.cardPriceTagText}>${offer.price}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.desc} numberOfLines={2}>{offer.description}</Text>
          <View style={styles.cardBottomRow}>
            <Text style={styles.cardName}>{offer.name}</Text>
            <Text style={styles.cardLoc} numberOfLines={1}>{offer.location}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function OfferMap({ offer, t }) {
  if (Platform.OS !== 'web') return null;
  const hasCoords = typeof offer.latitude === 'number' && typeof offer.longitude === 'number';
  const query = hasCoords
    ? `${offer.latitude},${offer.longitude}`
    : (offer.location || '').trim();
  if (!query) return null;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
  const linkHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${offer.latitude},${offer.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return (
    <View style={styles.mapWrap}>
      <View style={styles.mapFrame}>
        {React.createElement('iframe', {
          src,
          loading: 'lazy',
          referrerPolicy: 'no-referrer-when-downgrade',
          allowFullScreen: true,
          style: { border: 0, width: '100%', height: '100%', display: 'block' },
          title: 'Offer location',
        })}
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

  if (!renderOffer && !open) return null;
  const data = offer || renderOffer;
  if (!data) return null;

  return (
    <Modal visible={open || !!renderOffer} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalBackdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.modalCard, { transform: [{ scale }] }]}>
          <View
            style={[
              styles.modalImage,
              { backgroundImage: imageUrlFor(data), backgroundSize: imageSizeFor(data) },
            ]}
          />

          <View style={styles.modalBody}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{data.avatar}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalName}>{data.name}</Text>
                <Text style={styles.modalSub}>{data.location}</Text>
              </View>
              <Text style={styles.modalPrice}>${data.price}</Text>
            </View>

            <Text style={styles.modalDesc}>{data.description}</Text>

            <OfferMap offer={data} t={t} />

            <View style={styles.detailGroup}>
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Text style={styles.detailLabel}>{t('Number')}</Text>
                <Text style={styles.detailValue}>{data.phone}</Text>
              </View>
            </View>

            <View style={{ height: 16 }} />
            <Button
              title={t('Call now')}
              size="lg"
              onPress={() => Linking.openURL(`tel:${data.phone}`)}
            />
            <View style={{ height: 4 }} />
            <Button title={t('Close')} variant="ghost" size="md" onPress={onClose} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  headerFloat: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    zIndex: 10,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: { ...typography.h1, fontSize: 24 },
  headerSub: { ...typography.caption, color: colors.textTertiary, marginTop: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 16 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyDot: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textTertiary, marginTop: 4 },

  filterBtn: {
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
    shadowColor: '#0F0F1E',
    shadowOpacity: 0.18,
  },
  filterBtnActive: { backgroundColor: colors.accent },
  filterBtnText: { color: '#fff', fontSize: 22, fontWeight: '300', lineHeight: 24 },
  filterBtnTextActive: { color: '#fff' },

  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 16, color: colors.textTertiary, marginRight: 8 },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },

  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  radiusLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginRight: 10,
  },
  radiusChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
  },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 6,
  },
  radiusChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  radiusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  radiusChipTextActive: {
    color: '#fff',
  },
  radiusHint: {
    fontSize: 11,
    color: colors.textTertiary,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  radiusError: {
    color: '#C0392B',
  },

  cardWrap: { marginBottom: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceAlt,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardPriceTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(10, 10, 10, 0.86)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  cardPriceTagText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  imageLoadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  imageLoadingText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

  cardBody: { padding: 14 },
  desc: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 12 },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: { fontSize: 13, color: colors.text, fontWeight: '600' },
  cardLoc: {
    fontSize: 12,
    color: colors.textTertiary,
    marginLeft: 10,
    flexShrink: 1,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
  },
  avatarText: { color: colors.accent, fontWeight: '700', fontSize: 12 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 18, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 22,
    overflow: 'hidden',
    ...shadows.cardHover,
    shadowOpacity: 0.3,
  },
  modalImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceAlt,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
  modalBody: { padding: 20 },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalName: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textTertiary, marginTop: 3 },
  modalPrice: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  modalDesc: { fontSize: 14, color: colors.text, lineHeight: 21, marginBottom: 8 },

  mapWrap: {
    marginTop: 12,
  },
  mapFrame: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  mapOpenBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  mapOpenText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },

  detailGroup: {
    marginTop: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  detailValue: { fontSize: 14, color: colors.text, fontWeight: '500' },
});
