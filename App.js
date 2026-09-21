import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Alert, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import BrowseScreen from './screens/BrowseScreen';
import MyRequestsScreen from './screens/MyRequestsScreen';
import AuthScreen from './screens/AuthScreen';
import { colors, glass, radius } from './components/theme';
import { BlurSurface } from './components/Glass';
import { I18nProvider, useTranslation } from './components/i18n';
import * as Storage from './components/storage';
import { apiFetch, setSessionToken, setApiHandlers } from './components/api';

const Tab = createBottomTabNavigator();
const STORAGE_KEY = 'helpme.user';
const STORE_PACKAGE = 'com.sabachiburashka.helpme';
// Shown on the sign-in screen when the app signs someone out by itself.
const SIGN_IN_AGAIN = 'For your security, please sign in again with your phone number.';
let tempCounter = 0;

function openStoreListing() {
  Linking.openURL(`market://details?id=${STORE_PACKAGE}`).catch(() =>
    Linking.openURL(`https://play.google.com/store/apps/details?id=${STORE_PACKAGE}`).catch(() => {})
  );
}

async function loadStoredUser() {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistUser(user) {
  // Fire-and-forget; we update state synchronously and let storage settle in the background.
  if (user) Storage.setItem(STORAGE_KEY, JSON.stringify(user));
  else Storage.removeItem(STORAGE_KEY);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <I18nProvider>
        <AppInner />
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function AppInner() {
  const [user, setUser] = useState(null);
  const [userHydrated, setUserHydrated] = useState(false);
  const [dbOffers, setDbOffers] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  // People this user has blocked: [{ phone, name, created_at }]. Drives the
  // 'Blocked people' list in Profile; the feed itself is filtered server-side.
  const [blocked, setBlocked] = useState([]);
  // Translation key for the sign-in screen when the app signed someone out.
  const [signInNotice, setSignInNotice] = useState(null);
  const updatePromptShown = useRef(false);
  const { t } = useTranslation();

  // What happens when the server stops accepting this sign-in, or says this
  // build is too old. Registered before anything below fetches.
  useEffect(() => {
    setApiHandlers({
      onSessionEnded: () => endSession(SIGN_IN_AGAIN),
      onUpdateRequired: () => {
        if (updatePromptShown.current) return;
        updatePromptShown.current = true;
        Alert.alert(
          t('Update Kheli'),
          t('This version of Kheli is out of date. Please update it from Google Play.'),
          [
            { text: t('Later'), style: 'cancel' },
            { text: t('Update'), onPress: openStoreListing },
          ]
        );
      },
    });
  }, [t]);

  // Hydrate the persisted user once on mount. After hydration, refresh from
  // the server so tier / subscription_expires_at reflect any changes since
  // last login (subscription renewed, cancelled, expired).
  useEffect(() => {
    let cancelled = false;
    loadStoredUser().then((u) => {
      if (cancelled) return;
      if (u && !u.token) {
        // Signed in on a build from before session tokens. The server no
        // longer takes a bare phone number on trust, so start again.
        persistUser(null);
        setSignInNotice(SIGN_IN_AGAIN);
        setUserHydrated(true);
        return;
      }
      setSessionToken(u?.token);
      setUser(u);
      setUserHydrated(true);
      if (!u) return;
      apiFetch('/api/auth', { method: 'POST', body: { action: 'me' } })
        .then(({ ok, data }) => {
          if (cancelled || !ok || !data?.phone) return;
          const merged = { ...u, ...data };
          persistUser(merged);
          setUser(merged);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The server knows who is looking from the session, so it can leave out
  // offers by people this user has blocked. Offers reported by enough
  // people are filtered out server-side for everyone.
  const fetchOffers = useCallback(async () => {
    if (!user?.phone) return;
    const { data } = await apiFetch('/api/offers');
    if (!Array.isArray(data)) return;
    setDbOffers(data);
    setMyOffers(data.filter((o) => o.phone === user.phone));
  }, [user?.phone]);

  const fetchBlocked = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const { data } = await apiFetch('/api/blocks');
      if (Array.isArray(data)) setBlocked(data);
    } catch {}
  }, [user?.phone]);

  useEffect(() => {
    if (!user) return;
    setOffersLoading(true);
    fetchOffers()
      .catch(() => {})
      .finally(() => setOffersLoading(false));
    fetchBlocked();
  }, [user, fetchOffers, fetchBlocked]);

  // `u` is the verify_code response: the account plus its session `token`.
  function handleAuthenticated(u) {
    setSessionToken(u?.token);
    setSignInNotice(null);
    persistUser(u);
    setUser(u);
  }

  // Forget the sign-in on this phone. `notice` explains it on the sign-in
  // screen when the app did it rather than the person.
  function endSession(notice = null) {
    setSessionToken(null);
    setSignInNotice(notice);
    persistUser(null);
    setUser(null);
    setMyOffers([]);
    setDbOffers([]);
    setBlocked([]);
  }

  function handleLogout() {
    // Kill the session on the server too, so the token is worthless even if
    // it was copied off this phone. The request carries the token before
    // endSession clears it.
    apiFetch('/api/auth', { method: 'POST', body: { action: 'logout' } }).catch(() => {});
    endSession();
  }

  async function deleteAccount() {
    if (!user) return { ok: false, error: 'Not signed in' };
    try {
      const { ok, data } = await apiFetch('/api/auth', {
        method: 'POST',
        body: { action: 'delete_account' },
      });
      if (!ok) return { ok: false, error: data?.error || 'Could not delete account' };
      // The server has already ended every session on the account.
      endSession();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error. Try again.' };
    }
  }

  async function updateProfileImage(dataUrl) {
    const previous = user;
    const optimistic = { ...user, profile_image: dataUrl || null };
    persistUser(optimistic);
    setUser(optimistic);
    setMyOffers((prev) => prev.map((o) => (o.phone === user.phone ? { ...o, profile_image: dataUrl || null } : o)));
    setDbOffers((prev) => prev.map((o) => (o.phone === user.phone ? { ...o, profile_image: dataUrl || null } : o)));
    try {
      const r = await apiFetch('/api/auth', {
        method: 'POST',
        body: { action: 'update_profile_image', profile_image: dataUrl || null },
      });
      if (!r.ok) throw new Error('save failed');
    } catch {
      persistUser(previous);
      setUser(previous);
    }
  }

  async function addOffer(offer) {
    const offerData = {
      ...offer,
      name: user.name,
      avatar: (user.name || '?').slice(0, 2).toUpperCase(),
      profile_image: user.profile_image || null,
      phone: user.phone,
      images: Array.isArray(offer.images) ? offer.images : [],
    };
    delete offerData.generatingImage;

    const tempId = 'temp-' + (++tempCounter);
    const localOffer = { ...offerData, id: tempId, generatingImage: true };
    setMyOffers((prev) => [localOffer, ...prev]);
    setDbOffers((prev) => [localOffer, ...prev]);

    try {
      // Who posted it (name, photo, phone) is filled in by the server from
      // the session; only the request itself is sent.
      const { name, avatar, profile_image, phone, ...content } = offerData;
      const r = await apiFetch('/api/offers', { method: 'POST', body: content });
      // Quota exhausted: roll back the optimistic insert and report it so the
      // caller can show the paywall instead of pretending the post succeeded.
      if (r.status === 402) {
        const body = r.data || {};
        setMyOffers((prev) => prev.filter((o) => o.id !== tempId));
        setDbOffers((prev) => prev.filter((o) => o.id !== tempId));
        return { error: 'quota_exceeded', limit: body?.limit, used: body?.used, tier: body?.tier };
      }
      const saved = r.data;
      if (saved && saved.id) {
        const savedWithFlag = { ...saved, generatingImage: true };
        setMyOffers((prev) => prev.map((o) => (o.id === tempId ? savedWithFlag : o)));
        setDbOffers((prev) => prev.map((o) => (o.id === tempId ? savedWithFlag : o)));
        return saved.id;
      }
    } catch {}

    return tempId;
  }

  // --- Moderation -------------------------------------------------------
  // Google Play's UGC policy expects both of these on an app whose content is
  // mostly user-posted. Reports accumulate server-side; an offer disappears
  // from everyone's feed once enough different people flag it.

  async function reportOffer(offerId, reason, details) {
    if (!user?.phone) return { ok: false, error: 'Not signed in' };
    try {
      const { ok, data } = await apiFetch('/api/report', {
        method: 'POST',
        body: { offer_id: offerId, reason, details: details || null },
      });
      if (!ok) return { ok: false, error: data?.error || 'Could not send report' };
      // Reporting something also means never seeing it again — the feed query
      // enforces that on the next fetch, this makes Browse react right away.
      setDbOffers((prev) => prev.filter((o) => o.id !== offerId));
      return { ok: true, hidden: !!data?.hidden };
    } catch {
      return { ok: false, error: 'Network error. Try again.' };
    }
  }

  async function blockUser(offerId, blockedPhone) {
    if (!user?.phone) return { ok: false, error: 'Not signed in' };
    try {
      const { ok, data } = await apiFetch('/api/blocks', {
        method: 'POST',
        body: { blocked_phone: blockedPhone || null, offer_id: offerId || null },
      });
      if (!ok) return { ok: false, error: data?.error || 'Could not block this person' };
      // Clear their posts straight away. The server already filters them out
      // of the next fetch; this is just so Browse reacts immediately.
      const gone = data?.blocked_phone;
      if (gone) setDbOffers((prev) => prev.filter((o) => o.phone !== gone));
      fetchBlocked();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error. Try again.' };
    }
  }

  async function unblockUser(blockedPhone) {
    if (!user?.phone) return { ok: false, error: 'Not signed in' };
    try {
      const { ok, data } = await apiFetch('/api/blocks', {
        method: 'DELETE',
        body: { blocked_phone: blockedPhone },
      });
      if (!ok) return { ok: false, error: data?.error || 'Could not unblock this person' };
      setBlocked((prev) => prev.filter((b) => b.phone !== blockedPhone));
      // Their offers are allowed back into the feed now, so refetch.
      fetchOffers().catch(() => {});
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error. Try again.' };
    }
  }

  async function cancelSubscription() {
    if (!user) return { ok: false, error: 'Not signed in' };
    try {
      const { ok, data } = await apiFetch('/api/auth', {
        method: 'POST',
        body: { action: 'cancel_subscription' },
      });
      if (!ok) return { ok: false, error: data?.error || 'Could not cancel subscription' };
      const merged = { ...user, ...data };
      persistUser(merged);
      setUser(merged);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error. Try again.' };
    }
  }

  function handleUpgrade() {
    // Placeholder until Google Play Billing is wired up. See
    // supabase/migrations/001_add_subscription.sql for the schema and the
    // Phase 2 plan in the project notes.
    Alert.alert(
      'Pro — coming soon',
      'In-app purchase for $1/month (15 posts) is being connected through Google Play. You can already test the Pro tier by setting tier=pro in Supabase for your account.'
    );
  }

  async function removeOffer(id) {
    setMyOffers((prev) => prev.filter((o) => o.id !== id));
    setDbOffers((prev) => prev.filter((o) => o.id !== id));
    try {
      await apiFetch('/api/offers', { method: 'DELETE', body: { id } });
    } catch {}
  }

  function updateOffer(id, patch) {
    setMyOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    setDbOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));

    // The illustration URL is saved by the server when it makes the picture,
    // so only edits to the request itself are sent.
    const { generatingImage, image, ...persistPatch } = patch;
    if (Object.keys(persistPatch).length > 0) {
      apiFetch('/api/offers', { method: 'PATCH', body: { id, ...persistPatch } }).catch(() => {});
    }
  }

  const AuthContent = <AuthScreen onAuthenticated={handleAuthenticated} notice={signInNotice} />;

  const AppContent = (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          // Frosted floating bar. The tab bar is absolutely positioned and
          // fully transparent so screen content scrolls *under* it — screens
          // pad their scroll content with `useBottomTabBarHeight()`.
          // No fixed height: bottom-tabs still adds the gesture-bar inset.
          tabBarStyle: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            paddingTop: 8,
            paddingHorizontal: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarBackground: () => (
            <View style={StyleSheet.absoluteFill}>
              <BlurSurface tone="chrome" style={styles.tabBarGlass} />
              <View pointerEvents="none" style={styles.tabBarHairline} />
            </View>
          ),
          tabBarItemStyle: {
            paddingHorizontal: 4,
            paddingVertical: 0,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarAllowFontScaling: false,
          tabBarLabel: ({ focused, color }) => (
            <Text
              numberOfLines={1}
              style={[
                styles.tabLabel,
                { color },
                focused && styles.tabLabelActive,
              ]}
            >
              {route.name === 'Browse' ? t('Browse') : t('My requests')}
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon route={route.name} color={color} focused={focused} />
          ),
        })}
      >
        <Tab.Screen name="Browse">
          {() => (
            <BrowseScreen
              dbOffers={dbOffers}
              loading={offersLoading}
              user={user}
              onReportOffer={reportOffer}
              onBlockUser={blockUser}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="My Requests">
          {() => (
            <MyRequestsScreen
              user={user}
              myOffers={myOffers}
              loading={offersLoading}
              onAddOffer={addOffer}
              onUpdateOffer={updateOffer}
              onRemoveOffer={removeOffer}
              onLogout={handleLogout}
              onDeleteAccount={deleteAccount}
              onCancelSubscription={cancelSubscription}
              onUpgrade={handleUpgrade}
              onUpdateProfileImage={updateProfileImage}
              blocked={blocked}
              onUnblockUser={unblockUser}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );

  // While we read the persisted user from storage, render nothing on a
  // background color so we don't briefly flash the auth screen.
  if (!userHydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }
  return user ? AppContent : AuthContent;
}

function AnimatedTabIcon({ route, color, focused }) {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const prevFocused = useRef(focused);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: 10,
    }).start();

    if (focused && !prevFocused.current) {
      bounce.setValue(0);
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -3,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(bounce, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 12,
        }),
      ]).start();
    }
    prevFocused.current = focused;
  }, [focused, anim, bounce]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const pillScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const pillOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.iconWrap}>
      <Animated.View
        style={[
          styles.iconPillBg,
          { opacity: pillOpacity, transform: [{ scale: pillScale }] },
        ]}
      />
      <Animated.View
        style={{
          transform: [{ scale }, { translateY: bounce }],
        }}
      >
        {route === 'Browse' ? <BrowseIcon color={color} /> : <RequestsIcon color={color} />}
      </Animated.View>
    </View>
  );
}

function BrowseIcon({ color }) {
  return (
    <View style={styles.iconBox}>
      <View style={[styles.iconBar, { backgroundColor: color, width: 16, height: 2.2 }]} />
      <View style={[styles.iconBar, { backgroundColor: color, width: 16, height: 2.2, marginTop: 3 }]} />
      <View style={[styles.iconBar, { backgroundColor: color, width: 10, height: 2.2, marginTop: 3 }]} />
    </View>
  );
}

function RequestsIcon({ color }) {
  return (
    <View style={styles.iconBox}>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 5,
          borderWidth: 2.2,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 5,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarGlass: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  tabBarHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: glass.stroke,
  },
  iconWrap: {
    width: 44,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillBg: {
    position: 'absolute',
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: glass.accentFillMd,
    borderWidth: 1,
    borderColor: glass.accentStroke,
  },
  iconBox: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBar: { borderRadius: 1.5 },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 3,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '800',
  },
});
