import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BrowseScreen from './screens/BrowseScreen';
import MyRequestsScreen from './screens/MyRequestsScreen';

const Tab = createBottomTabNavigator();
let tempCounter = 0;

export default function App() {
  const [dbOffers, setDbOffers] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWideScreen = isWeb && width > 480;

  useEffect(() => {
    fetch('/api/offers')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setDbOffers(data); })
      .catch(() => {});
  }, []);

  async function addOffer(offer) {
    const offerData = { ...offer, name: 'You', avatar: 'ME', phone: '+1 555-9999' };
    delete offerData.generatingImage;

    // Show immediately in local state while DB save is in-flight
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

    // Only persist non-UI fields to Supabase
    const { generatingImage, ...persistPatch } = patch;
    if (Object.keys(persistPatch).length > 0) {
      fetch('/api/offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...persistPatch }),
      }).catch(() => {});
    }
  }

  const AppContent = (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#EEE',
            borderTopWidth: 1,
            height: 68,
            paddingBottom: 8,
            paddingTop: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: '#000',
          tabBarInactiveTintColor: '#BBB',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
          tabBarIcon: ({ color, focused }) => {
            const isBrowse = route.name === 'Browse';
            const glyph = isBrowse ? (focused ? '◉' : '◎') : (focused ? '▣' : '☰');
            return (
              <View style={styles.iconWrap}>
                <View style={[styles.indicator, focused && styles.indicatorActive]} />
                <View style={[styles.iconPill, focused && styles.iconPillActive]}>
                  <Text style={{ fontSize: 18, color, fontWeight: '600' }}>{glyph}</Text>
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
              myOffers={myOffers}
              onAddOffer={addOffer}
              onUpdateOffer={updateOffer}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );

  if (isWideScreen) {
    return (
      <View style={styles.webBg}>
        <View style={styles.phoneFrame}>{AppContent}</View>
      </View>
    );
  }
  return AppContent;
}

const styles = StyleSheet.create({
  webBg: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  phoneFrame: {
    width: 390,
    height: 780,
    backgroundColor: '#fff',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: '#1A1A1A',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginBottom: 4,
  },
  indicatorActive: {
    backgroundColor: '#000',
  },
  iconPill: {
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  iconPillActive: {
    backgroundColor: '#F2F2F2',
  },
});
