import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, Animated,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, radius, shadows, transitions, typography } from '../components/theme';
import { Button } from '../components/Button';
import SegmentedTabs from '../components/SegmentedTabs';
import FadeInUp from '../components/FadeInUp';

const CATEGORIES = ['Moving', 'Assembly', 'Home', 'Other'];

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

function CategoryPill({ label, active, onPress }) {
  const bg = useRef(new Animated.Value(active ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.spring(bg, {
      toValue: active ? 1 : 0,
      useNativeDriver: false,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [active, bg]);

  const backgroundColor = bg.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surface, colors.accent],
  });
  const borderColor = bg.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.accent],
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [
        Platform.OS === 'web' && { transition: transitions.fast, cursor: 'pointer' },
        hovered && !active && { transform: [{ translateY: -1 }] },
      ]}
    >
      <Animated.View
        style={[styles.catBtn, { backgroundColor, borderColor }]}
      >
        <Text style={[styles.catText, active && styles.catTextActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function MyRequestsScreen({ user, myOffers, onAddOffer, onUpdateOffer, onLogout }) {
  const [tab, setTab] = useState('new');
  const [form, setForm] = useState({
    description: '', price: '', location: '', category: 'Moving',
  });

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
    const { description, category } = form;
    setForm({ description: '', price: '', location: '', category: 'Moving' });
    setTab('mine');
    const id = await onAddOffer({ ...form, price: Number(form.price) });
    if (id && onUpdateOffer) {
      generateImage(id, description, category);
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
              <Field
                label="Location"
                placeholder="City, State"
                value={form.location}
                onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
              />
            </FadeInUp>

            <FadeInUp delay={150}>
              <View style={fieldStyles.wrap}>
                <Text style={fieldStyles.label}>Category</Text>
                <View style={styles.cats}>
                  {CATEGORIES.map((cat) => (
                    <CategoryPill
                      key={cat}
                      label={cat}
                      active={form.category === cat}
                      onPress={() => setForm((f) => ({ ...f, category: cat }))}
                    />
                  ))}
                </View>
              </View>
            </FadeInUp>

            <View style={{ height: 24 }} />
            <FadeInUp delay={200}>
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
        <View style={styles.catChip}>
          <Text style={styles.catChipText}>{offer.category}</Text>
        </View>
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

  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  catText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  catTextActive: { color: '#fff', fontWeight: '600' },

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
  catChip: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  catChipText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
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
