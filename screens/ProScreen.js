// Kheli Pro: what it adds to Lite, and the button to get it. Opens from every
// place a Pro feature is locked, and from Profile and My requests.
import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { colors, glass, radius } from '../components/theme';
import { useTranslation } from '../components/i18n';
import { GlassSurface, GlassButton } from '../components/Glass';
import { ProBadge } from '../components/Pro';

// The server enforces each of these; this list only describes them.
const BENEFITS = [
  'See the price of every request',
  'Search by distance, and see how far away each request is',
  'Your requests stay at the top of Browse for 7 days, with a Pro badge',
  '15 requests a month instead of 3',
];

export default function ProScreen({ visible, user, onClose, onSubscribe }) {
  const { t } = useTranslation();
  const isPro = user?.tier === 'pro';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <GlassSurface tone="light" radius={32} shadow="lifted" clip style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.brand}>kheli</Text>
              <ProBadge />
            </View>
            <Text style={styles.price}>{t('$1 / month')}</Text>

            <View style={styles.list}>
              {BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.row}>
                  <View style={styles.tick}>
                    <Text style={styles.tickText}>✓</Text>
                  </View>
                  <Text style={styles.rowText}>{t(benefit)}</Text>
                </View>
              ))}
            </View>

            {isPro ? (
              <GlassSurface tone="accent" radius={radius.pill} shadow="none" style={styles.havePro}>
                <Text style={styles.haveProText}>{t('You have Pro')}</Text>
              </GlassSurface>
            ) : (
              <GlassButton
                title={t('Upgrade to Pro — $1/month')}
                size="lg"
                onPress={onSubscribe}
                style={{ alignSelf: 'stretch' }}
              />
            )}
            <View style={{ height: 8 }} />
            <GlassButton
              title={isPro ? t('Close') : t('Not now')}
              variant="ghost"
              size="md"
              onPress={onClose}
              style={{ alignSelf: 'stretch' }}
            />
            {!isPro ? (
              <Text style={styles.foot}>{t('Lite stays free: browse, call, and post 3 requests a month.')}</Text>
            ) : null}
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: glass.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  content: { padding: 24 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brand: {
    fontSize: 30,
    fontWeight: '500',
    color: colors.accent,
    letterSpacing: 1.2,
    lineHeight: 36,
  },
  price: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: 10,
  },
  list: {
    marginTop: 18,
    marginBottom: 24,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: glass.accentFillMd,
    borderWidth: 1,
    borderColor: glass.accentStroke,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  tickText: { fontSize: 12, fontWeight: '800', color: colors.accent, lineHeight: 14 },
  rowText: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.text,
    fontWeight: '600',
  },
  havePro: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 16,
  },
  haveProText: { fontSize: 15, fontWeight: '800', color: colors.accent },
  foot: {
    marginTop: 12,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
