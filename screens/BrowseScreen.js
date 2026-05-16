import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, Linking, TextInput,
} from 'react-native';

const SAMPLE_OFFERS = [
  {
    id: '1',
    name: 'Mike Johnson',
    avatar: 'MJ',
    description: 'Need help moving a refrigerator from living room to kitchen.',
    price: 5,
    location: 'Brooklyn, NY',
    phone: '+1 555-0101',
    category: 'Moving',
  },
  {
    id: '2',
    name: 'Sara Lee',
    avatar: 'SL',
    description: 'Need someone to assemble an IKEA desk. All parts and tools provided.',
    price: 10,
    location: 'Queens, NY',
    phone: '+1 555-0102',
    category: 'Assembly',
  },
  {
    id: '3',
    name: 'Tom Davis',
    avatar: 'TD',
    description: 'Help carrying heavy boxes from van to 2nd floor apartment.',
    price: 15,
    location: 'Manhattan, NY',
    phone: '+1 555-0103',
    category: 'Moving',
  },
  {
    id: '4',
    name: 'Anna White',
    avatar: 'AW',
    description: 'Need help hanging 3 picture frames. Drill available.',
    price: 8,
    location: 'Bronx, NY',
    phone: '+1 555-0104',
    category: 'Home',
  },
  {
    id: '5',
    name: 'Chris Park',
    avatar: 'CP',
    description: 'Rearranging bedroom furniture — bed, wardrobe, desk.',
    price: 20,
    location: 'Staten Island, NY',
    phone: '+1 555-0105',
    category: 'Moving',
  },
];

const SVG_BY_CATEGORY = {
  Moving: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>
    <rect width='320' height='200' fill='#fff'/>
    <g fill='none' stroke='#000' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>
      <rect x='40' y='80' width='90' height='80'/>
      <path d='M40 105 L130 105'/>
      <path d='M85 80 L85 105'/>
      <path d='M150 120 L245 120'/>
      <path d='M225 105 L245 120 L225 135'/>
      <rect x='260' y='80' width='22' height='80' stroke-dasharray='5 5'/>
    </g>
  </svg>`,
  Assembly: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>
    <rect width='320' height='200' fill='#fff'/>
    <g fill='none' stroke='#000' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M60 160 L160 80'/>
      <path d='M55 165 L70 150 L80 160 L65 175 Z'/>
      <path d='M150 70 L175 55 L200 55 L210 75 L195 90 L170 90 Z'/>
      <polygon points='225,80 250,80 263,103 250,125 225,125 212,103'/>
      <circle cx='237.5' cy='102.5' r='5'/>
    </g>
  </svg>`,
  Home: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>
    <rect width='320' height='200' fill='#fff'/>
    <g fill='none' stroke='#000' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M40 170 L280 170'/>
      <path d='M80 90 L160 40 L240 90'/>
      <path d='M100 90 L100 170'/>
      <path d='M220 90 L220 170'/>
      <rect x='140' y='115' width='40' height='55'/>
      <circle cx='173' cy='143' r='2'/>
    </g>
  </svg>`,
  Other: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>
    <rect width='320' height='200' fill='#fff'/>
    <g fill='none' stroke='#000' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>
      <circle cx='100' cy='75' r='20'/>
      <path d='M100 95 L100 155'/>
      <path d='M100 115 L72 145'/>
      <path d='M100 115 L140 115'/>
      <path d='M100 155 L80 185'/>
      <path d='M100 155 L120 185'/>
      <path d='M170 120 L200 150 L255 75'/>
    </g>
  </svg>`,
};

function imageUrlFor(offer) {
  const svg = SVG_BY_CATEGORY[offer.category] || SVG_BY_CATEGORY.Other;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

export default function BrowseScreen({ myOffers }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const allOffers = [...myOffers, ...SAMPLE_OFFERS];
  const filtered = allOffers.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.description.toLowerCase().includes(q) ||
      o.location.toLowerCase().includes(q) ||
      o.name.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse</Text>
        <Text style={styles.subtitle}>{filtered.length} requests nearby</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search"
          placeholderTextColor="#AAA"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 && (
          <Text style={styles.empty}>No matches</Text>
        )}
        {filtered.map((offer) => (
          <OfferCard key={offer.id} offer={offer} onPress={() => setSelected(offer)} />
        ))}
        <View style={{ height: 16 }} />
      </ScrollView>

      <DetailsModal offer={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

function OfferCard({ offer, onPress }) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={[styles.cardImage, { backgroundImage: imageUrlFor(offer) }]} />
      <View style={styles.cardBody}>
        <Text style={styles.desc} numberOfLines={2}>{offer.description}</Text>
        <View style={styles.cardBottomRow}>
          <Text style={styles.category}>{offer.category}</Text>
          <Text style={styles.price}>${offer.price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DetailsModal({ offer, onClose }) {
  if (!offer) return null;
  return (
    <Modal
      visible={!!offer}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modalCard}
          activeOpacity={1}
          onPress={() => {}}
        >
          <View style={[styles.modalImage, { backgroundImage: imageUrlFor(offer) }]} />

          <View style={styles.modalBody}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{offer.avatar}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalName}>{offer.name}</Text>
                <Text style={styles.modalSub}>{offer.category}</Text>
              </View>
              <Text style={styles.modalPrice}>${offer.price}</Text>
            </View>

            <Text style={styles.modalDesc}>{offer.description}</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{offer.location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Number</Text>
              <Text style={styles.detailValue}>{offer.phone}</Text>
            </View>

            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${offer.phone}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.callBtnText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#000', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#999', marginTop: 4 },

  searchWrap: { paddingHorizontal: 24, paddingBottom: 12 },
  search: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
  },

  list: { paddingHorizontal: 24, paddingTop: 4 },
  empty: { textAlign: 'center', color: '#BBB', marginTop: 60, fontSize: 14 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#fff',
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
  cardBody: { padding: 14 },
  desc: { fontSize: 14, color: '#222', lineHeight: 20, marginBottom: 10 },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  category: { fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.8 },
  price: { fontSize: 20, fontWeight: '700', color: '#000' },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#555', fontWeight: '600', fontSize: 12 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  modalImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#fff',
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
  modalBody: { padding: 18 },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalName: { fontSize: 16, fontWeight: '700', color: '#000' },
  modalSub: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modalPrice: { fontSize: 22, fontWeight: '700', color: '#000' },
  modalDesc: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 14 },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailValue: { fontSize: 14, color: '#000', fontWeight: '500' },

  callBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  callBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  closeBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  closeBtnText: { color: '#999', fontSize: 13, fontWeight: '500' },
});
