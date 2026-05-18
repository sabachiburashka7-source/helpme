import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, Animated, Easing } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BrowseScreen from './screens/BrowseScreen';
import MyRequestsScreen from './screens/MyRequestsScreen';
import AuthScreen from './screens/AuthScreen';
import { colors, radius } from './components/theme';

const Tab = createBottomTabNavigator();
const STORAGE_KEY = 'helpme.user';
let tempCounter = 0;

function loadStoredUser() {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistUser(user) {
  if (Platform.OS !== 'web') return;
  try {
    if (user) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function App() {
  const [user, setUser] = useState(() => loadStoredUser());
  const [dbOffers, setDbOffers] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWideScreen = isWeb && width > 480;

  useEffect(() => {
    if (!user) return;
    setOffersLoading(true);
    fetch('/api/offers')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDbOffers(data);
          setMyOffers(data.filter((o) => o.phone === user.phone));
        }
      })
      .catch(() => {})
      .finally(() => setOffersLoading(false));
  }, [user]);

  function handleAuthenticated(u) {
    persistUser(u);
    setUser(u);
  }

  function handleLogout() {
    persistUser(null);
    setUser(null);
    setMyOffers([]);
    setDbOffers([]);
  }

  async function addOffer(offer) {
    const offerData = {
      ...offer,
      name: user.name,
      avatar: (user.name || '?').slice(0, 2).toUpperCase(),
      phone: user.phone,
    };
    delete offerData.generatingImage;

    const tempId = 'temp-' + (++tempCounter);
    const localOffer = { ...offerData, id: tempId, generatingImage: true };
    setMyOffers((prev) => [localOffer, ...prev]);
    setDbOffers((prev) => [localOffer, ...prev]);

    try {
      const r = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerData),
      });
      const saved = await r.json();
      if (saved && saved.id) {
        const savedWithFlag = { ...saved, generatingImage: true };
        setMyOffers((prev) => prev.map((o) => (o.id === tempId ? savedWithFlag : o)));
        setDbOffers((prev) => prev.map((o) => (o.id === tempId ? savedWithFlag : o)));
        return saved.id;
      }
    } catch {}

    return tempId;
  }

  function updateOffer(id, patch) {
    setMyOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    setDbOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));

    const { generatingImage, ...persistPatch } = patch;
    if (Object.keys(persistPatch).length > 0) {
      fetch('/api/offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...persistPatch }),
      }).catch(() => {});
    }
  }

  const AuthContent = <AuthScreen onAuthenticated={handleAuthenticated} />;

  const AppContent = (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 48,
            paddingBottom: 4,
            paddingTop: 4,
            paddingHorizontal: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
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
              {route.name === 'Browse' ? 'Browse' : 'My requests'}
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon route={route.name} color={color} focused={focused} />
          ),
        })}
      >
        <Tab.Screen name="Browse">
          {() => <BrowseScreen dbOffers={dbOffers} loading={offersLoading} />}
        </Tab.Screen>
        <Tab.Screen name="My Requests">
          {() => (
            <MyRequestsScreen
              user={user}
              myOffers={myOffers}
              loading={offersLoading}
              onAddOffer={addOffer}
              onUpdateOffer={updateOffer}
              onLogout={handleLogout}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );

  const Content = user ? AppContent : AuthContent;

  if (isWideScreen) {
    return (
      <View style={styles.webBg}>
        <View style={styles.phoneFrame}>{Content}</View>
      </View>
    );
  }
  return Content;
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
  webBg: {
    flex: 1,
    backgroundColor: '#EAEAEF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  phoneFrame: {
    width: 390,
    height: 780,
    backgroundColor: colors.bg,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: '#0A0A0A',
    boxShadow: '0 30px 80px rgba(15, 15, 30, 0.28), 0 8px 20px rgba(15, 15, 30, 0.12)',
  },
  iconWrap: {
    width: 36,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillBg: {
    position: 'absolute',
    width: 36,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
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
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 1,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});
