import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Pressable, Alert, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C } from './theme';
import { useApp } from './store';

// ------------------------------------------------------------------ format
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad = (n) => String(n).padStart(2, '0');
export const fmtShort = (d) => `${d.getDate()} ${BLN[d.getMonth()]}, ${d.getFullYear()}`;
export const fmtLong = (d) => `${HARI[d.getDay()]}, ${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
const fmtHM = (min) => `${Math.floor(min / 60)}:${pad(Math.round(min % 60))}`;
const fmtMin = (min) => (min >= 60 ? `${Math.floor(min / 60)} j ${Math.round(min % 60)} m` : `${Math.round(min)} m`);
const fmtPace = (p) => (p > 0 ? `${Math.floor(p)}:${pad(Math.round((p % 1) * 60) % 60)} /km` : '-');
const fmtKm = (km) => `${km.toFixed(2).replace('.', ',')} km`;
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const SERIF = Platform.select({ android: 'serif', ios: 'Georgia', default: undefined });
const STATUS = { finished: ['Selesai', C.ok], cancelled: ['Dibatalkan', '#777'], active: ['Aktif', C.accent], planned: ['Direncanakan', C.warn] };

// ------------------------------------------------------------------ top bar
export function TopBar({ showProfile = true }) {
  const nav = useNavigation();
  const { activeTrip } = useApp();
  const gpsOk = !!(activeTrip && activeTrip.lastKnownLocation());
  return (
    <View style={s.topbar}>
      {nav.canGoBack() && <TouchableOpacity onPress={() => nav.goBack()} hitSlop={10} style={{ marginRight: 8 }}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>}
      <View style={s.logo}><Ionicons name="triangle" size={12} color="#fff" /></View>
      <Text style={s.brand}>Mount Tracker</Text>
      <View style={{ flex: 1 }} />
      <View style={s.gps}><View style={[s.dot, { backgroundColor: gpsOk ? C.ok : C.red }]} /><Text style={s.gpsT}>GPS</Text></View>
      {showProfile && <TouchableOpacity onPress={() => nav.navigate('Profile')} hitSlop={10}><Ionicons name="person-circle-outline" size={24} color="#fff" /></TouchableOpacity>}
    </View>
  );
}

// ------------------------------------------------------------------ track gunung
// Menggambar jejak GPS sebagai garis (tanpa library peta), skala menyesuaikan area.
export function TrackView({ trip, style }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const pts = trip.trackPoints();
  const geo = useMemo(() => {
    if (pts.length < 2 || !box.w) return null;
    const PAD = 28;
    const k = Math.cos((pts[0].latitude * Math.PI) / 180);
    const xy = pts.map((p) => [p.longitude * k, -p.latitude]);
    const xs = xy.map((p) => p[0]);
    const ys = xy.map((p) => p[1]);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const sc = Math.min((box.w - PAD * 2) / Math.max(maxX - minX, 1e-6), (box.h - PAD * 2) / Math.max(maxY - minY, 1e-6));
    const ox = (box.w - (maxX - minX) * sc) / 2;
    const oy = (box.h - (maxY - minY) * sc) / 2;
    const P = xy.map(([x, y]) => [ox + (x - minX) * sc, oy + (y - minY) * sc]);
    const segs = [];
    for (let i = 1; i < P.length; i++) {
      const [x1, y1] = P[i - 1];
      const [x2, y2] = P[i];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 0.5) continue;
      segs.push({ i, len, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, ang: Math.atan2(y2 - y1, x2 - x1), t: i / (P.length - 1) });
    }
    return { P, segs };
  }, [trip.id, pts.length, box.w, box.h]);

  const segColor = (t) => (t < 0.5 ? C.accent : t < 0.85 ? C.warn : C.red);
  const maxAlt = trip.maxAltitudeM();

  return (
    <View style={[s.track, style]} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {[0.25, 0.5, 0.75].map((f) => <View key={`h${f}`} style={[s.grid, { top: `${f * 100}%`, left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />)}
      {[0.25, 0.5, 0.75].map((f) => <View key={`v${f}`} style={[s.grid, { left: `${f * 100}%`, top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />)}
      {!geo && <View style={s.center}><Ionicons name="map-outline" size={30} color={C.mute} /><Text style={s.mute}>{pts.length < 2 ? 'Track tidak tersedia untuk pendakian ini' : ''}</Text></View>}
      {geo && geo.segs.map((g) => (
        <View key={`g${g.i}`} style={[s.seg, { width: g.len + 6, height: 9, left: g.cx - (g.len + 6) / 2, top: g.cy - 4.5, backgroundColor: 'rgba(26,140,176,0.18)', transform: [{ rotate: `${g.ang}rad` }] }]} />
      ))}
      {geo && geo.segs.map((g) => (
        <View key={`s${g.i}`} style={[s.seg, { width: g.len + 1.5, height: 3, left: g.cx - (g.len + 1.5) / 2, top: g.cy - 1.5, backgroundColor: segColor(g.t), transform: [{ rotate: `${g.ang}rad` }] }]} />
      ))}
      {geo && (
        <>
          <View style={[s.marker, { left: geo.P[0][0] - 8, top: geo.P[0][1] - 8, backgroundColor: C.ok }]} />
          <View style={{ position: 'absolute', left: geo.P[geo.P.length - 1][0] - 4, top: geo.P[geo.P.length - 1][1] - 22 }}><Ionicons name="flag" size={20} color={C.red} /></View>
          <View style={s.legend}>
            <Text style={s.legendT}><Text style={{ color: C.ok }}>● </Text>Start   <Text style={{ color: C.red }}>⚑ </Text>Titik akhir</Text>
            {maxAlt != null && <Text style={s.legendT}>Tertinggi {maxAlt.toLocaleString('id-ID')} mdpl · naik {trip.elevationGainM().toLocaleString('id-ID')} m</Text>}
          </View>
        </>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ filter tanggal
const PRESETS = [['7', '7 hari terakhir', 7], ['30', '30 hari terakhir', 30], ['90', '90 hari terakhir', 90], ['all', 'Semua riwayat', null]];

function DateBox({ label, value, onChange }) {
  return (
    <View style={s.dateBox}>
      <Text style={s.dateLbl}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => onChange(addDays(value, -1))} hitSlop={8}><Ionicons name="chevron-back" size={16} color="#fff" /></TouchableOpacity>
        <Text style={s.dateVal}>{fmtShort(value)}</Text>
        <TouchableOpacity onPress={() => onChange(addDays(value, 1))} hitSlop={8}><Ionicons name="chevron-forward" size={16} color="#fff" /></TouchableOpacity>
      </View>
    </View>
  );
}

function DateSheet({ visible, value, onClose, onApply }) {
  const today = dayStart(new Date());
  const [from, setFrom] = useState(value.from || addDays(today, -30));
  const [to, setTo] = useState(value.to || today);
  const applyCustom = () => {
    if (from > to) { Alert.alert('Rentang tidak valid', 'Tanggal "Dari" harus sebelum atau sama dengan "Sampai".'); return; }
    onApply({ key: 'custom', label: `${fmtShort(from)} - ${fmtShort(to)}`, from, to });
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.sheetTitle}>Pilih tanggal pendakian</Text>
        {PRESETS.map(([k, label, n]) => (
          <TouchableOpacity key={k} style={s.opt} onPress={() => onApply({ key: k, label, from: n ? addDays(today, -(n - 1)) : null, to: n ? today : null })}>
            <Text style={s.optT}>{label}</Text>
            {value.key === k && <Ionicons name="checkmark" size={18} color="#fff" />}
          </TouchableOpacity>
        ))}
        <Text style={[s.optT, { marginTop: 14 }]}>Atur tanggal</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <DateBox label="Dari" value={from} onChange={setFrom} />
          <DateBox label="Sampai" value={to} onChange={setTo} />
        </View>
        <TouchableOpacity style={s.apply} onPress={applyCustom}><Text style={{ color: '#111', fontWeight: '700' }}>Terapkan</Text></TouchableOpacity>
      </View>
    </Modal>
  );
}

// ------------------------------------------------------------------ Riwayat (Histori Gunung)
export function History({ navigation }) {
  const { trips } = useApp();
  const [range, setRange] = useState({ key: 'all', label: 'Tanggal', from: null, to: null });
  const [sheet, setSheet] = useState(false);

  const list = trips
    .filter((t) => t.status === 'finished' || t.status === 'cancelled')
    .filter((t) => {
      if (!range.from) return true;
      const d = dayStart(t.startDate);
      return d >= range.from && d <= range.to;
    })
    .sort((a, b) => b.startDate - a.startDate);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <TopBar />
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <Text style={s.title}>Histori Gunung</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <TouchableOpacity style={s.pill} onPress={() => setSheet(true)}>
            <Ionicons name="calendar-outline" size={14} color="#E5EEF0" />
            <Text style={s.pillT}>{range.key === 'all' ? 'Tanggal' : range.label}</Text>
          </TouchableOpacity>
          {range.key !== 'all' && (
            <TouchableOpacity onPress={() => setRange({ key: 'all', label: 'Tanggal', from: null, to: null })} style={{ marginLeft: 8 }}>
              <Ionicons name="close-circle" size={20} color={C.mute} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 14, paddingBottom: 30 }}>
        {list.length === 0 && <Text style={[s.mute, { padding: 16 }]}>Tidak ada riwayat pendakian pada rentang ini.</Text>}
        {list.map((t) => {
          const [lbl, col] = STATUS[t.status];
          return (
            <TouchableOpacity key={t.id} style={s.item} activeOpacity={0.7} onPress={() => navigation.navigate('HistoryDetail', { tripId: t.id })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.itemName}>{t.mountain.name}</Text>
                <Text style={s.itemDate}>{fmtLong(t.startDate)}</Text>
              </View>
              <Text style={s.itemSub}>{t.trailName} : {t.status === 'finished' ? `${fmtKm(t.distanceKm())} · ${fmtMin(t.durationMinutes())}` : 'tidak jadi berangkat'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                <View style={[s.badge, { backgroundColor: col }]}><Text style={s.badgeT}>{lbl}</Text></View>
                {t.isSample && <View style={[s.badge, { backgroundColor: '#333' }]}><Text style={[s.badgeT, { color: C.mute }]}>contoh</Text></View>}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {sheet && <DateSheet visible value={range} onClose={() => setSheet(false)} onApply={(r) => { setRange(r); setSheet(false); }} />}
    </View>
  );
}

// ------------------------------------------------------------------ Detail riwayat
export function HistoryDetail({ route }) {
  const { trips, user } = useApp();
  const trip = trips.find((t) => t.id === route.params.tripId);
  if (!trip) return <View style={{ flex: 1, backgroundColor: '#000' }}><TopBar /><Text style={[s.mute, { padding: 16 }]}>Riwayat tidak ditemukan.</Text></View>;

  const stats = [
    ['Jarak', fmtKm(trip.distanceKm())],
    ['Pace Rata-rata', fmtPace(trip.paceMinPerKm())],
    ['Waktu Bergerak', fmtHM(trip.movingMinutes())],
    ['Waktu Berhenti', fmtMin(trip.stoppedMinutes())],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <TopBar />
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <Text style={s.title}>{trip.mountain.name}</Text>
        <Text style={s.mute}>{trip.trailName} · {trip.mountain.elevationMdpl.toLocaleString('id-ID')} mdpl</Text>
      </View>
      <TrackView trip={trip} style={{ flex: 1 }} />
      <View style={s.panel}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={s.avatar}><Ionicons name="person" size={26} color="#111" /></View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={s.pName}>{user.name}</Text>
            <Text style={s.pDate}>{fmtShort(trip.startDate)} · {trip.groupSize} orang</Text>
          </View>
          <View style={[s.badge, { backgroundColor: STATUS[trip.status][1] }]}><Text style={s.badgeT}>{STATUS[trip.status][0]}</Text></View>
        </View>
        <View style={s.statGrid}>
          {stats.map(([a, b]) => (
            <View key={a} style={s.statCell}><Text style={s.statLbl}>{a}</Text><Text style={s.statVal}>{b}</Text></View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ Profile
export function Profile({ navigation }) {
  const { user, trips, updateProfile, logout } = useApp();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);

  const done = trips.filter((t) => t.status === 'finished');
  const totalKm = done.reduce((a, t) => a + t.distanceKm(), 0);
  const totalMin = done.reduce((a, t) => a + t.durationMinutes(), 0);
  const peaks = new Set(done.map((t) => t.mountain.id)).size;
  const highest = done.reduce((m, t) => Math.max(m, t.mountain.elevationMdpl), 0);
  const contact = user.primaryContact();

  const save = () => {
    try { updateProfile({ displayName: name, email }); setEdit(false); } catch (e) { Alert.alert('Belum bisa disimpan', e.message); }
  };
  const out = () => Alert.alert('Keluar dari akun?', '', [
    { text: 'Batal', style: 'cancel' },
    { text: 'Keluar', style: 'destructive', onPress: () => { logout(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); } },
  ]);
  const menu = [
    ['time-outline', 'Histori Gunung', 'History'],
    ['call-outline', 'Kontak Darurat', 'Contacts'],
    ['book-outline', 'Panduan Pengguna', 'Guide'],
    ['pulse-outline', 'Status Sistem', 'SystemStatus'],
    ...(user.isAdmin ? [['flask-outline', 'Status Pengujian (admin)', 'TestStatus'], ['cloud-download-outline', 'Pembaruan Data (admin)', 'DataUpdate']] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <TopBar showProfile={false} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Profil</Text>
        <View style={[s.panel, { borderRadius: 12, marginTop: 14, flex: 0 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[s.avatar, { width: 64, height: 64, borderRadius: 32 }]}><Ionicons name="person" size={36} color="#111" /></View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.pName, { fontSize: 18 }]}>{user.name}</Text>
                {user.isAdmin && <View style={[s.badge, { backgroundColor: C.accent }]}><Text style={s.badgeT}>Admin</Text></View>}
              </View>
              <Text style={s.pDate}>@{user.username || '-'}</Text>
              <Text style={s.pDate}>{user.email || 'Email belum diisi'}</Text>
            </View>
            <TouchableOpacity onPress={() => { setName(user.displayName); setEmail(user.email); setEdit(!edit); }} hitSlop={10}>
              <Ionicons name={edit ? 'close' : 'create-outline'} size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          {edit && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.statLbl}>Nama tampilan</Text>
              <TextInput value={name} onChangeText={setName} placeholder={user.username} placeholderTextColor="#C9D6D9" style={s.input} />
              <Text style={[s.statLbl, { marginTop: 8 }]}>Email</Text>
              <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={s.input} />
              <TouchableOpacity style={s.apply} onPress={save}><Text style={{ color: '#111', fontWeight: '700' }}>Simpan Profil</Text></TouchableOpacity>
            </View>
          )}
          <View style={s.statGrid}>
            {[['Pendakian Selesai', done.length], ['Total Jarak', fmtKm(totalKm)], ['Total Waktu', fmtMin(totalMin)], ['Gunung Didaki', peaks]].map(([a, b]) => (
              <View key={a} style={s.statCell}><Text style={s.statLbl}>{a}</Text><Text style={s.statVal}>{b}</Text></View>
            ))}
          </View>
          {highest > 0 && <Text style={[s.pDate, { textAlign: 'center', marginTop: 4 }]}>Puncak tertinggi: {highest.toLocaleString('id-ID')} mdpl</Text>}
        </View>

        <View style={s.card}>
          <Text style={s.mute}>Kontak darurat utama</Text>
          <Text style={s.cardT}>{contact ? `${contact.name} · ${contact.phone}` : 'Belum ada kontak darurat'}</Text>
        </View>

        <View style={[s.card, { paddingVertical: 4 }]}>
          {menu.map(([ic, t, to], i) => (
            <TouchableOpacity key={to} style={[s.menu, i === menu.length - 1 && { borderBottomWidth: 0 }]} onPress={() => navigation.navigate(to)}>
              <Ionicons name={ic} size={20} color={C.accent} />
              <Text style={[s.cardT, { flex: 1, marginLeft: 12, marginTop: 0 }]}>{t}</Text>
              <Ionicons name="chevron-forward" size={18} color={C.mute} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[s.apply, { backgroundColor: C.red, marginTop: 18 }]} onPress={out}><Text style={{ color: '#fff', fontWeight: '700' }}>Keluar</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const SHEET = '#6B8388';
const s = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1D3A40', paddingHorizontal: 14, paddingTop: 44, paddingBottom: 10, gap: 8 },
  logo: { width: 22, height: 22, borderRadius: 5, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#fff', fontFamily: SERIF, fontWeight: '700', fontSize: 13 },
  gps: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2F4E55', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  gpsT: { color: '#E5EEF0', fontSize: 10, fontWeight: '700' },
  title: { color: '#fff', fontFamily: SERIF, fontSize: 26, fontWeight: '700' },
  mute: { color: C.mute, fontSize: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: SHEET, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 7, alignSelf: 'flex-start' },
  pillT: { color: '#E5EEF0', fontFamily: SERIF, fontSize: 12 },
  item: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3A4F54' },
  itemName: { color: '#fff', fontFamily: SERIF, fontSize: 17, fontWeight: '700' },
  itemDate: { color: C.mute, fontSize: 11, fontFamily: SERIF },
  itemSub: { color: C.mute, fontSize: 12, fontFamily: SERIF, marginTop: 4 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeT: { color: '#fff', fontSize: 10, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: SHEET, paddingHorizontal: 18, paddingBottom: 30, paddingTop: 10, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#C9D6D9', alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { color: '#fff', fontFamily: SERIF, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  opt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  optT: { color: '#fff', fontFamily: SERIF, fontWeight: '700', fontSize: 13 },
  dateBox: { width: '47%', backgroundColor: '#4E666B', borderRadius: 10, padding: 10 },
  dateLbl: { color: '#E5EEF0', fontFamily: SERIF, fontSize: 12, marginBottom: 4 },
  dateVal: { color: '#fff', fontFamily: SERIF, fontWeight: '700', fontSize: 12 },
  apply: { backgroundColor: '#EDEDED', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 16 },
  track: { backgroundColor: '#000', overflow: 'hidden', minHeight: 220 },
  grid: { position: 'absolute', backgroundColor: '#1A2A2E' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 6 },
  seg: { position: 'absolute', borderRadius: 3 },
  marker: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: '#fff' },
  legend: { position: 'absolute', left: 12, bottom: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  legendT: { color: '#E5EEF0', fontSize: 10 },
  panel: { backgroundColor: SHEET, padding: 16, paddingBottom: 28 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' },
  pName: { color: '#fff', fontFamily: SERIF, fontWeight: '700', fontSize: 15 },
  pDate: { color: '#E5EEF0', fontFamily: SERIF, fontSize: 12, marginTop: 2 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  statCell: { width: '50%', alignItems: 'center', paddingVertical: 10 },
  statLbl: { color: '#E5EEF0', fontFamily: SERIF, fontSize: 12, fontWeight: '700' },
  statVal: { color: '#fff', fontFamily: SERIF, fontSize: 18, fontWeight: '700', marginTop: 4 },
  input: { backgroundColor: '#4E666B', color: '#fff', borderRadius: 8, padding: 10, marginTop: 4 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginTop: 14 },
  cardT: { color: '#fff', fontWeight: '600', marginTop: 4 },
  menu: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3A5A62' },
});