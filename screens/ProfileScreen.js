import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Modal, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, glass, radius, typography } from '../components/theme';
import { useTranslation } from '../components/i18n';
import { BgImage } from '../components/BgImage';
import { isImageUrl } from '../components/profileImage';
import { apiUrl } from '../components/apiBase';
import {
  AmbientBackground, GlassSurface, GlassPanel, GlassButton, SectionLabel,
  PressableGlass,
} from '../components/Glass';

const ACCENT = '#7A1230';

function formatExpiry(iso, lang) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const locale = lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US';
  try {
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export default function ProfileScreen({
  visible,
  user,
  onClose,
  onLogout,
  onDeleteAccount,
  onCancelSubscription,
  onUpgrade,
}) {
  const { t, lang } = useTranslation();
  if (!user) return null;

  const tier = user.tier === 'pro' ? 'pro' : 'free';
  const expiry = formatExpiry(user.subscription_expires_at, lang);

  function handleCancelSubscription() {
    Alert.alert(
      t('Cancel subscription?'),
      t('You will lose access to the 15-post-per-month Pro plan immediately and drop back to 1 post per month.'),
      [
        { text: t('Keep Pro'), style: 'cancel' },
        {
          text: t('Cancel subscription'),
          style: 'destructive',
          onPress: async () => {
            const result = await onCancelSubscription?.();
            if (!result?.ok) {
              Alert.alert(
                t('Something went wrong'),
                result?.error || t('Network error. Try again.')
              );
            }
          },
        },
      ]
    );
  }

  function openPrivacy() {
    Linking.openURL(apiUrl('/privacy')).catch(() => {
      Alert.alert(t('Something went wrong'), t('Network error. Try again.'));
    });
  }

  function handleLogout() {
    Alert.alert(t('Sign out?'), t('You will need to verify your phone again to sign back in.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Sign out'),
        onPress: () => {
          onClose?.();
          onLogout?.();
        },
      },
    ]);
  }

  function handleDelete() {
    Alert.alert(
      t('Delete account?'),
      t('This permanently removes your profile, all requests you have posted, and any photos. This cannot be undone.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Continue'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('Are you sure?'),
              t('There is no recovery. Tap Delete to permanently remove your account.'),
              [
                { text: t('Cancel'), style: 'cancel' },
                {
                  text: t('Delete'),
                  style: 'destructive',
                  onPress: async () => {
                    const result = await onDeleteAccount?.();
                    if (!result?.ok) {
                      Alert.alert(
                        t('Something went wrong'),
                        result?.error || t('Network error. Try again.')
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <AmbientBackground>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.topBar}>
            <PressableGlass onPress={onClose} scaleTo={0.93}>
              <GlassSurface tone="strong" radius={radius.pill} shadow="subtle" style={styles.backBtn}>
                <Text style={styles.backChevron}>‹</Text>
                <Text style={styles.backText}>{t('Back')}</Text>
              </GlassSurface>
            </PressableGlass>
            <Text style={styles.topTitle}>{t('Profile')}</Text>
            <View style={styles.topSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Identity card */}
            <GlassPanel
              tone="light"
              radius={32}
              blur={false}
              style={styles.identityCard}
              contentStyle={styles.identityCardInner}
            >
              <GlassSurface tone="strong" radius={radius.pill} shadow="base" style={styles.avatarRing}>
                <View style={styles.avatarWrap}>
                  {isImageUrl(user.profile_image) ? (
                    <BgImage source={user.profile_image} resizeMode="cover" style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarInitial}>
                        {(user.name || '?').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </GlassSurface>
              <Text style={styles.identityName} numberOfLines={1}>{user.name}</Text>
              {user.phone ? <Text style={styles.identityPhone}>{user.phone}</Text> : null}
            </GlassPanel>

            {/* Subscription card — only rendered for Pro users. The Pro upgrade
                flow is hidden in v1 since Google Play Billing isn't wired yet;
                Pro accounts only exist via manual toggling in this phase, and
                they still need a way to cancel. */}
            {tier === 'pro' ? (
              <>
                <View style={styles.sectionLabelWrap}>
                  <SectionLabel>{t('Subscription')}</SectionLabel>
                </View>
                <GlassSurface tone="light" radius={26} shadow="base" style={styles.card}>
                  <View style={styles.subRow}>
                    <View style={styles.tierBadgePro}>
                      <Text style={styles.tierBadgeTextPro}>{t('Pro')}</Text>
                    </View>
                    <Text style={styles.subPlanName}>{t('15 posts per month')}</Text>
                  </View>

                  {expiry ? (
                    <Text style={styles.subMeta}>
                      {t('Renews on {date}').replace('{date}', expiry)}
                    </Text>
                  ) : null}

                  <GlassButton
                    title={t('Cancel subscription')}
                    variant="glass"
                    size="sm"
                    onPress={handleCancelSubscription}
                    style={styles.subAction}
                    textStyle={{ color: colors.textSecondary }}
                  />
                </GlassSurface>
              </>
            ) : null}

            {/* Account actions */}
            <View style={styles.sectionLabelWrap}>
              <SectionLabel>{t('Account')}</SectionLabel>
            </View>
            <GlassSurface tone="light" radius={26} shadow="base" style={styles.card}>
              <Pressable onPress={handleLogout} style={styles.row}>
                <Text style={styles.rowText}>{t('Sign out')}</Text>
                <Text style={styles.rowChevron}>›</Text>
              </Pressable>
              <View style={styles.rowDivider} />
              <Pressable onPress={handleDelete} style={styles.row}>
                <Text style={[styles.rowText, styles.rowTextDanger]}>{t('Delete account')}</Text>
                <Text style={[styles.rowChevron, styles.rowTextDanger]}>›</Text>
              </Pressable>
            </GlassSurface>

            {/* Legal — Google Play requires the privacy policy to be reachable
                from inside the app, not only from the Play Store listing. */}
            <View style={styles.sectionLabelWrap}>
              <SectionLabel>{t('Legal')}</SectionLabel>
            </View>
            <GlassSurface tone="light" radius={26} shadow="base" style={styles.card}>
              <Pressable onPress={openPrivacy} style={styles.row}>
                <Text style={styles.rowText}>{t('Privacy Policy')}</Text>
                <Text style={styles.rowChevron}>›</Text>
              </Pressable>
            </GlassSurface>
          </ScrollView>
        </SafeAreaView>
      </AmbientBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 9,
  },
  backChevron: {
    fontSize: 19,
    fontWeight: '700',
    color: ACCENT,
    marginRight: 5,
    lineHeight: 21,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: 0.2,
  },
  topTitle: {
    ...typography.h2,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  topSpacer: { width: 92 },

  scroll: { paddingHorizontal: 16, paddingBottom: 36, paddingTop: 6 },

  identityCard: {},
  identityCardInner: {
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  avatarRing: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
  },
  identityName: {
    ...typography.h2,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  identityPhone: {
    marginTop: 5,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  sectionLabelWrap: {
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 8,
  },

  card: { overflow: 'hidden' },

  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  tierBadgePro: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: ACCENT,
  },
  tierBadgeTextPro: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#fff',
  },
  subPlanName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
    flexShrink: 1,
  },
  subMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: 18,
    marginTop: 10,
  },
  subAction: { margin: 16, alignSelf: 'stretch' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 17,
  },
  rowDivider: {
    height: 1,
    backgroundColor: glass.strokeSoft,
    marginLeft: 18,
  },
  rowText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
  },
  rowTextDanger: { color: '#B53D5E' },
  rowChevron: {
    fontSize: 19,
    color: colors.textTertiary,
    fontWeight: '700',
  },
});
