import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BrowseScreen from './screens/BrowseScreen';
import MyRequestsScreen from './screens/MyRequestsScreen';

const Tab = createBottomTabNavigator();
let nextId = 100;

export default function App() {
  const [myOffers, setMyOffers] = useState([]);
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWideScreen = isWeb && width > 480;

  function addOffer(offer) {
    setMyOffers((prev) => [
      { ...offer, id: String(nextId++), name: 'You', avatar: 'ME', phone: '+1 555-9999' },
      ...prev,
    ]);
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
            height: 56,
            paddingBottom: 6,
            paddingTop: 6,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: '#000',
          tabBarInactiveTintColor: '#BBB',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
          tabBarIcon: ({ color }) => {
            const label = route.name === 'Browse' ? '○' : '◆';
            return <Text style={{ fontSize: 16, color }}>{label}</Text>;
          },
        })}
      >
        <Tab.Screen name="Browse">
          {() => <BrowseScreen myOffers={myOffers} />}
        </Tab.Screen>
        <Tab.Screen name="My Requests">
          {() => <MyRequestsScreen myOffers={myOffers} onAddOffer={addOffer} />}
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
});
