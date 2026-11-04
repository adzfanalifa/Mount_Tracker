import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from './theme';
import { useApp } from './store';
import { MOUNTAINS, DIFFICULTY } from './data';

const Page = ({ title, sub, children }) => (
  <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56 }}>
    <View style={s.top}><Text style={s.brand}>Mount Tracker</Text><Ionicons name="person-circle-outline" size={24} color="#fff" /></View>
    <Text style={s.h1}>{title}</Text>{sub ? <Text style={s.mute}>{sub}</Text> : null}
    {children}
  </ScrollView>
);
const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
const Hero = ({ h = 130 }) => <View style={{ height: h, borderRadius: 10, backgroundColor: '#1F6F8B', marginVertical: 12, overflow: 'hidden' }}>
  <View style={{ position: 'absolute', bottom: 0, width: '100%', height: h * 0.45, backgroundColor: '#2D7A55' }} /></View>;

export function Home({ navigation }) {
  const { activeTrip, plannedTrip, startTrip, finishTrip } = useApp();
  const trip = activeTrip || plannedTrip;
  const overdue = activeTrip ? activeTrip.isOverdue() : false;
  const last = activeTrip ? activeTrip.lastKnownLocation() : null;
  const label = { planned: 'Direncanakan', active: 'Aktif' };

  const onStart = async () => {
    try {
      const ok = await startTrip(trip);
      if (!ok) Alert.alert('Lokasi tidak tersedia', 'Pendakian tetap dimulai, tetapi posisimu belum bisa dicatat. Cek izin dan GPS di menu Status Sistem.');
    } catch (e) { Alert.alert('Tidak bisa memulai', e.message); }
  };
  const onFinish = () => Alert.alert('Akhiri pendakian?', trip.trailName, [
    { text: 'Batal', style: 'cancel' },
    { text: 'Akhiri', onPress: () => finishTrip(trip) },
  ]);

  const stats = trip ? [
    ['Status', label[trip.status]],
    ['Durasi', activeTrip ? `${Math.floor(trip.durationMinutes() / 60)}j ${trip.durationMinutes() % 60}m` : '-'],
    ['Lokasi', last ? 'Tercatat' : (activeTrip ? 'Tidak tersedia' : '-')],
  ] : [['Status', '-'], ['Durasi', '-'], ['Lokasi', '-']];
  const shortcuts = [['call', 'Kontak', 'Contacts'], ['time', 'Riwayat', 'History'], ['pulse', 'Status', 'SystemStatus']];

  return (
    <Page title={trip ? trip.mountain.name : 'Belum ada pendakian'} sub={trip ? trip.trailName : 'Buat rencana pendakian untuk mulai'}>
      <Hero />
      {overdue && (
        <TouchableOpacity style={[s.alert, { backgroundColor: C.warn }]} onPress={() => navigation.navigate('Emergency')}>
          <Text style={{ fontWeight: '700' }}>Melewati batas waktu turun. Ketuk jika butuh bantuan.</Text>
        </TouchableOpacity>
      )}
      <View style={s.row}>{stats.map(([a, b]) => <Card key={a} style={s.stat}><Text style={s.mute}>{a}</Text><Text style={s.b}>{b}</Text></Card>)}</View>
      <View style={[s.row, { marginTop: 12 }]}>
        <TouchableOpacity style={[s.shortcut, { backgroundColor: C.red }]} onPress={() => navigation.navigate('Emergency')}>
          <Ionicons name="warning" size={20} color="#fff" /><Text style={s.b}>SOS</Text>
        </TouchableOpacity>
        {shortcuts.map(([ic, t, to]) => (
          <TouchableOpacity key={t} style={s.shortcut} onPress={() => navigation.navigate(to)}>
            <Ionicons name={ic} size={20} color="#fff" /><Text style={s.b}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Card><Text style={s.b}>Kondisi Pendakian</Text>
        <View style={s.grid}>{[['Detak Jantung', '149 bpm'], ['Cuaca', '18°C'], ['Suhu', 'Aman'], ['Kelembapan', '72%']].map(([a, b]) =>
          <View key={a} style={s.cell}><Text style={s.mute}>{a}</Text><Text style={{ color: C.accent }}>{b}</Text></View>)}</View>
        <Text style={[s.mute, { marginTop: 6 }]}>Data kesehatan dan cuaca masih contoh.</Text></Card>
      <Card><Text style={s.b}>Cuaca Per Jam</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{['Now', '1 jam', '2 jam', '3 jam', '4 jam', '5 jam'].map((t, i) =>
          <View key={t} style={[s.hour, i === 0 && { backgroundColor: C.accent }]}><Text style={s.mute}>{t}</Text><Ionicons name="partly-sunny" size={18} color="#fff" /><Text style={{ color: '#fff' }}>{18 - i}°</Text></View>)}</ScrollView></Card>
      {!trip && <TouchableOpacity style={[s.cta, { backgroundColor: C.accent }]} onPress={() => navigation.navigate('PlanHike')}><Text style={s.b}>Buat Rencana Pendakian</Text></TouchableOpacity>}
      {trip && trip.status === 'planned' && <TouchableOpacity style={[s.cta, { backgroundColor: C.ok }]} onPress={onStart}><Text style={s.b}>Mulai Pendakian</Text></TouchableOpacity>}
      {trip && trip.status === 'active' && <TouchableOpacity style={[s.cta, { backgroundColor: '#555' }]} onPress={onFinish}><Text style={s.b}>Akhiri Pendakian</Text></TouchableOpacity>}
    </Page>
  );
}

export function Maps() {
  const pos = [['Pos 1 - Sembalun', '1.156 mdpl · 1.2 km', '08:30', 'ok'], ['Pos 2', '1.800 mdpl · 3.4 km', '09:52', 'ok'],
    ['Pos 3', '2.100 mdpl · 5.1 km', '11:40', 'ok'], ['Pos 4', '2.400 mdpl · 6.8 km', '13:21', 'now'], ['Plawangan', '2.639 mdpl', 'Est. 15:30', 'next'], ['Puncak', '3.726 mdpl', 'Est. 03:00', 'next']];
  return (
    <Page title="PETA JALUR" sub="Rinjani via Sembalun">
      <View style={s.map}><Ionicons name="navigate" size={28} color={C.warn} /><Text style={s.mute}>Area peta (react-native-maps)</Text></View>
      {pos.map(([a, b, t, st]) => (
        <Card key={a} style={s.pos}>
          <Ionicons name={st === 'ok' ? 'checkmark-circle' : st === 'now' ? 'location' : 'chevron-forward-circle'} size={22} color={st === 'ok' ? C.ok : st === 'now' ? C.red : C.mute} />
          <View style={{ flex: 1, marginLeft: 10 }}><Text style={s.b}>{a}</Text><Text style={s.mute}>{b}</Text></View>
          <Text style={s.b}>{t}</Text></Card>))}
    </Page>
  );
}

const Bars = ({ data, color }) => <View style={s.bars}>{data.map((v, i) => <View key={i} style={{ flex: 1, height: v, backgroundColor: color, marginHorizontal: 2, borderRadius: 3 }} />)}</View>;
export function Health() {
  return (
    <Page title="Monitor Kesehatan" sub="Pantauan Selama Pendakian">
      <Card><Text style={s.mute}>Detak Jantung</Text><Text style={s.b}>149 bpm</Text><Bars color={C.red} data={[30, 45, 40, 60, 55, 70, 65, 80, 75, 90]} /></Card>
      <Card><Text style={s.mute}>Ketinggian</Text><Text style={s.b}>2.700 mdpl</Text><Bars color={C.accent} data={[20, 25, 35, 40, 50, 55, 65, 70, 80, 90]} /></Card>
      <View style={s.grid}>{[['Oksigen (SpO2)', '94%'], ['Suhu Tubuh', '36.5°C'], ['Langkah', '14.320'], ['Kalori', '1.840 kkal']].map(([a, b]) =>
        <Card key={a} style={s.cell}><Text style={s.mute}>{a}</Text><Text style={s.b}>{b}</Text></Card>)}</View>
      <View style={[s.alert, { backgroundColor: C.warn }]}><Text>Kadar oksigen menurun, istirahat sejenak</Text></View>
      <View style={[s.alert, { backgroundColor: C.ok }]}><Text>Kondisi tubuh stabil</Text></View>
    </Page>
  );
}

export function Starterpack() {
  const [p, setP] = useState(4); const [d, setD] = useState(3);
  const Row = ({ a, b }) => <View style={s.line}><Text style={s.b}>{a}</Text><Text style={s.b}>{b}</Text></View>;
  return (
    <Page title="Kalkulator Starterpack" sub="Pendakian Aktif">
      <Card>
        <View style={s.line}><Text style={s.b}>Jumlah Orang</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setP(Math.max(1, p - 1))}><Ionicons name="remove-circle" size={26} color={C.accent} /></TouchableOpacity>
            <Text style={[s.b, { marginHorizontal: 12 }]}>{p}</Text>
            <TouchableOpacity onPress={() => setP(p + 1)}><Ionicons name="add-circle" size={26} color={C.accent} /></TouchableOpacity></View></View>
        <Text style={[s.b, { marginTop: 10 }]}>Lama Pendakian: {d} Hari</Text>
        <View style={s.row}>{[1, 2, 3, 4, 5, 6, 7].map(n => (
          <TouchableOpacity key={n} onPress={() => setD(n)} style={[s.day, n === d && { backgroundColor: C.accent }]}><Text style={s.b}>{n}</Text></TouchableOpacity>))}</View>
      </Card>
      <Card><Text style={s.h2}>Perlengkapan Tidur</Text>
        <Row a="Tenda" b={`${Math.ceil(p / 2)} Buah`} /><Row a="Sleeping Bag" b={`${p} Buah`} /><Row a="Matras" b={`${p} Buah`} /></Card>
      <Card><Text style={s.h2}>Makanan</Text>
        <Row a="Logistik Makanan" b={`${p * d * 2} Porsi`} /><Row a="Air Minum" b={`${p * d * 3} Liter`} /><Row a="Kompor Gas" b={`${(p * d * 0.2).toFixed(1)} Tabung`} /></Card>
    </Page>
  );
}

export function Mount({ navigation }) {
  const [q, setQ] = useState('');
  return (
    <Page title="Direktori Gunung" sub="Pendakian Gunung">
      <TextInput value={q} onChangeText={setQ} placeholder="Search Here" placeholderTextColor={C.mute} style={s.search} />
      {MOUNTAINS.filter(m => m.name.toLowerCase().includes(q.toLowerCase())).map((m) => (
        <View key={m.id} style={s.mCard}><View style={{ flex: 1 }} />
          <View style={s.mRow}><Text style={s.mName}>{m.name}</Text>
            <View style={[s.badge, { backgroundColor: DIFFICULTY[m.difficulty].color }]}><Text style={{ fontSize: 10, color: '#111' }}>{DIFFICULTY[m.difficulty].label}</Text></View></View>
          <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('PlanHike', { mountainId: m.id })}>
            <Text style={{ fontSize: 11, color: '#111' }}>Tambahkan Pendakian</Text></TouchableOpacity>
        </View>))}
    </Page>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  brand: { color: C.mute, fontSize: 12 }, h1: { color: '#fff', fontSize: 24, fontWeight: '700' }, h2: { color: '#fff', fontWeight: '700', marginBottom: 6 },
  mute: { color: C.mute, fontSize: 12 }, b: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: C.card, borderRadius: 10, padding: 12, marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  stat: { flex: 1, alignItems: 'center', marginTop: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  cell: { width: '48%', backgroundColor: '#2F5660', borderRadius: 8, padding: 10, marginTop: 0 },
  hour: { alignItems: 'center', padding: 8, marginRight: 6, borderRadius: 8, gap: 4 },
  cta: { backgroundColor: C.red, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  map: { height: 170, borderRadius: 10, backgroundColor: '#2D5A3F', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  pos: { flexDirection: 'row', alignItems: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 90, marginTop: 8 },
  alert: { borderRadius: 8, padding: 10, marginTop: 10 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#4A6A72' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6, backgroundColor: '#2F5660' },
  search: { backgroundColor: C.card, color: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  mCard: { height: 112, borderRadius: 10, backgroundColor: '#1F6F8B', marginTop: 12, padding: 10 },
  mRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mName: { color: '#fff', fontSize: 18, fontWeight: '700' }, badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  shortcut: { flex: 1, backgroundColor: C.card, borderRadius: 10, paddingVertical: 10, alignItems: 'center', gap: 4 },
  addBtn: { alignSelf: 'flex-end', backgroundColor: '#EDEDED', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
});
