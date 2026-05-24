import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadows, typography } from '../components/theme';
import { useTranslation } from '../components/i18n';
import { BgImage } from '../components/BgImage';
import { isImageUrl } from '../components/profileImage';

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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>‹ {t('Back')}</Text>
          </Pressable>
          <Text style={styles.topTitle}>{t('Profile')}</Text>
          <View style={styles.topSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Identity card */}
          <View style={styles.identityCard}>
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
            <Text style={styles.identityName} numberOfLines={1}>{user.name}</Text>
            {user.phone ? <Text style={styles.identityPhone}>{user.phone}</Text> : null}
          </View>

          {/* Subscription card */}
          <View style={styles.sectionLabelWrap}>
            <Text style={styles.sectionLabel}>{t('Subscription')}</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.subRow}>
              <View style={styles.subLeft}>
                <View
                  style={[
                    styles.tierBadge,
                    tier === 'pro' ? styles.tierBadgePro : styles.tierBadgeFree,
                  ]}
                >
                  <Text
                    style={[
                      styles.tierBadgeText,
                      tier === 'pro' ? styles.tierBadgeTextPro : styles.tierBadgeTextFree,
                    ]}
                  >
                    {tier === 'pro' ? t('Pro') : t('Free')}
                  </Text>
                </View>
                <Text style={styles.subPlanName}>
                  {tier === 'pro' ? t('15 posts per month') : t('1 post per month')}
                </Text>
              </View>
            </View>

            {tier === 'pro' && expiry ? (
              <Text style={styles.subMeta}>
                {t('Renews on {date}').replace('{date}', expiry)}
              </Text>
            ) : null}

            {tier === 'pro' ? (
              <Pressable onPress={handleCancelSubscription} style={styles.subActionGhost}>
                <Text style={styles.subActionGhostText}>{t('Cancel subscription')}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={onUpgrade} style={styles.subActionPrimary}>
                <Text style={styles.subActionPrimaryText}>
                  {t('Upgrade to Pro — $1/month')}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Account actions */}
          <View style={styles.sectionLabelWrap}>
            <Text style={styles.sectionLabel}>{t('Account')}</Text>
          </View>
          <View style={styles.card}>
            <Pressable onPress={handleLogout} style={styles.row}>
              <Text style={styles.rowText}>{t('Sign out')}</Text>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
            <View style={styles.rowDivider} />
            <Pressable onPress={handleDelete} style={styles.row}>
              <Text style={[styles.rowText, styles.rowTextDanger]}>{t('Delete account')}</Text>
              <Text style={[styles.rowChevron, styles.rowTextDanger]}>›</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: { paddingVertical: 6, paddingRight: 8 },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: 0.2,
  },
  topTitle: {
    ...typography.h2,
    fontSize: 18,
  },
  topSpacer: { width: 64 },

  scroll: { paddingHorizontal: 16, paddingBottom: 32 },

  identityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: colors.surfaceAlt,
    ...shadows.card,
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  identityName: {
    ...typography.h2,
    fontSize: 20,
    textAlign: 'center',
  },
  identityPhone: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  sectionLabelWrap: {
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },

  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  subLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tierBadgeFree: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  tierBadgePro: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  tierBadgeTextFree: { color: colors.textSecondary },
  tierBadgeTextPro: { color: '#fff' },
  subPlanName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
    flexShrink: 1,
  },
  subMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: 16,
    marginTop: 8,
  },

  subActionPrimary: {
    margin: 14,
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subActionPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  subActionGhost: {
    margin: 14,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  subActionGhostText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 16,
  },
  rowText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  rowTextDanger: { color: '#B53D5E' },
  rowChevron: {
    fontSize: 18,
    color: colors.textTertiary,
    fontWeight: '700',
  },
});
