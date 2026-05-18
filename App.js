import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
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
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWideScreen = isWeb && width > 480;

  useEffect(() => {
    if (!user) return;
    fetch('/api/offers')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDbOffers(data);
          setMyOffers(data.filter((o) => o.phone === user.phone));
        }
      })
      .catch(() => {});
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
            height: 72,
            paddingBottom: 10,
            paddingTop: 10,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginTop: 2 },
          tabBarIcon: ({ color, focused }) => {
            const isBrowse = route.name === 'Browse';
            return (
              <View style={styles.iconWrap}>
                <View
                  style={[
                    styles.iconPill,
                    focused && styles.iconPillActive,
                    Platform.OS === 'web' && { transition: 'all 200ms cubic-bezier(0.2, 0.8, 0.2, 1)' },
                  ]}
                >
                  {isBrowse ? <BrowseIcon color={color} /> : <RequestsIcon color={color} />}
                </View>
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="Browse">
          {() => <BrowseScreen dbOffers={dbOffers} />}
        </Tab.Screen>
        <Tab.Screen name="My Requests">
          {() => (
            <MyRequestsScreen
              user={user}
              myOffers={myOffers}
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

function BrowseIcon({ color }) {
  return (
    <View style={styles.iconBox}>
      <View style={[styles.iconBar, { backgroundColor: color, width: 14, height: 2 }]} />
      <View style={[styles.iconBar, { backgroundColor: color, width: 14, height: 2, marginTop: 3 }]} />
      <View style={[styles.iconBar, { backgroundColor: color, width: 9, height: 2, marginTop: 3 }]} />
    </View>
  );
}

function RequestsIcon({ color }) {
  return (
    <View style={styles.iconBox}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: color,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPill: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.accentSoft,
  },
  iconBox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBar: { borderRadius: 1 },
});
