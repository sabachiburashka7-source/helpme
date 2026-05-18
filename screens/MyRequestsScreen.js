import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';

const CATEGORIES = ['Moving', 'Assembly', 'Home', 'Other'];

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
        body: JSON.stringify({ description, category }),
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
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Profile */}
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.avatar}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileSub}>{profile.phone}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{myOffers.length}</Text>
            <Text style={styles.statLabel}>posted</Text>
          </View>
          {onLogout ? (
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={onLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutText}>Sign out</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'new' && styles.tabActive]}
            onPress={() => setTab('new')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>
              New
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'mine' && styles.tabActive]}
            onPress={() => setTab('mine')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
              Mine
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'new' ? (
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What do you need help with?"
              placeholderTextColor="#BBB"
              multiline
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
            />

            <Text style={styles.label}>Price</Text>
            <TextInput
              style={styles.input}
              placeholder="$"
              placeholderTextColor="#BBB"
              keyboardType="numeric"
              value={form.price}
              onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
            />

            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="City, State"
              placeholderTextColor="#BBB"
              value={form.location}
              onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.cats}>
              {CATEGORIES.map((cat) => {
                const active = form.category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catBtn, active && styles.catBtnActive]}
                    onPress={() => setForm((f) => ({ ...f, category: cat }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.catText, active && styles.catTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.submit}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.submitText}>Post</Text>
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.myList}
            showsVerticalScrollIndicator={false}
          >
            {myOffers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No requests yet</Text>
                <Text style={styles.emptySub}>Tap "New" to post your first one</Text>
              </View>
            ) : (
              myOffers.map((offer) => <MyOfferCard key={offer.id} offer={offer} />)
            )}
            <View style={{ height: 16 }} />
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
          <Text style={styles.myCardImagePlaceholderText}>Generating image…</Text>
        </View>
      ) : null}
      <View style={styles.myCardTop}>
        <Text style={styles.myCardPrice}>${offer.price}</Text>
        <Text style={styles.myCardCat}>{offer.category}</Text>
      </View>
      <Text style={styles.myCardDesc}>{offer.description}</Text>
      <Text style={styles.myCardLoc}>{offer.location}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },

  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: '#FAFAFA',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  profileName: { fontSize: 16, fontWeight: '700', color: '#000' },
  profileSub: { fontSize: 12, color: '#999', marginTop: 2 },
  statBox: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: '#000' },
  statLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  logoutBtn: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEE',
    backgroundColor: '#fff',
  },
  logoutText: { fontSize: 11, color: '#666', fontWeight: '600' },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: '#000' },
  tabText: { fontSize: 14, color: '#999', fontWeight: '500' },
  tabTextActive: { color: '#000', fontWeight: '600' },

  form: { paddingHorizontal: 24, paddingTop: 20 },
  label: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000',
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EEE',
    backgroundColor: '#fff',
  },
  catBtnActive: { backgroundColor: '#000', borderColor: '#000' },
  catText: { fontSize: 13, color: '#666', fontWeight: '500' },
  catTextActive: { color: '#fff' },

  submit: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  myList: { paddingHorizontal: 24, paddingTop: 16 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#666' },
  emptySub: { fontSize: 13, color: '#AAA', marginTop: 6 },

  myCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  myCardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F5F5F5',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderRadius: 10,
    marginBottom: 12,
    marginHorizontal: -4,
  },
  myCardImagePlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myCardImagePlaceholderText: {
    fontSize: 12,
    color: '#999',
    letterSpacing: 0.4,
  },
  myCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  myCardPrice: { fontSize: 18, fontWeight: '700', color: '#000' },
  myCardCat: { fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.8 },
  myCardDesc: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 6 },
  myCardLoc: { fontSize: 12, color: '#999' },
});
