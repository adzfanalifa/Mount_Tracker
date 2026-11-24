import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ImageBackground, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, makeStyles } from './theme';
import { useApp } from './store';
import { DIFFICULTY } from './data';
import { api } from './api';
import { parseMountains } from './dataSync';
import { getCurrentLocation } from './location';
import { Loading, ErrorBox, Empty, ThemeToggle } from './ui';
import TrailMap from './TrailMap';

const pad = (n) => String(n).padStart(2, '0');
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtLeft = (min) => `${min < 0 ? '-' : ''}${Math.floor(Math.abs(min) / 60)}j ${Math.abs(min) % 60}m`;
const num = (n) => Number(n).toLocaleString('id-ID');

const ProfileBtn = () => {
  const nav = useNavigation();
  const { colors } = useTheme();
  return <TouchableOpacity onPress={() => nav.navigate('Profile')} hitSlop={10}><Ionicons name="person-circle-outline" size={26} color={colors.text} /></TouchableOpacity>;
};
const Page = ({ title, sub, children, refreshing, onRefresh }) => {
  const { colors } = useTheme();
  const s = useS();
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 30 }} keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined}>
      <View style={s.top}><Text style={s.brand}>Mount Tracker</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><ThemeToggle /><ProfileBtn /></View></View>
      <Text style={s.h1}>{title}</Text>{sub ? <Text style={s.mute}>{sub}</Text> : null}
      {children}
    </ScrollView>
  );
};
const Card = ({ children, style }) => { const s = useS(); return <View style={[s.card, style]}>{children}</View>; };
const Hero = ({ h = 130 }) => {
  const { colors } = useTheme();
  return <View style={{ height: h, borderRadius: 10, backgroundColor: colors.hero, marginVertical: 12, overflow: 'hidden' }}>
    <View style={{ position: 'absolute', bottom: 0, width: '100%', height: h * 0.45, backgroundColor: colors.heroGround }} /></View>;
};

// Cuaca per jam untuk gunung pendakian / gunung terpilih / posisi HP.
function useWeather(target) {
  const [st, setSt] = useState({ data: null, loading: false, error: null });
  const key = target ? `${target.latitude},${target.longitude}` : 'gps';
  const load = async () => {
    setSt((x) => ({ ...x, loading: true, error: null }));
    try {
      let t = target;
      if (!t) {
        const loc = await getCurrentLocation();
        if (!loc.isAvailable()) { setSt({ data: null, loading: false, error: null }); return; }
        t = loc;
      }
      setSt({ data: await api.weather({ lat: t.latitude, lng: t.longitude, hours: 12 }), loading: false, error: null });
    } catch (e) {
      setSt({ data: null, loading: false, error: e.message });
    }
  };
  useEffect(() => { load(); }, [key]);
  return { ...st, reload: load };
}

// Gunung yang dipakai Home/Maps: dari pendakian (aktif/rencana) atau pilihan di tab Mount.
function useFocusMountain() {
  const { currentTrip, selectedMountainId, findMountain } = useApp();
  if (currentTrip) return { mountain: currentTrip.mountain, trip: currentTrip };
  const m = selectedMountainId ? findMountain(selectedMountainId) : null;
  return { mountain: m, trip: null };
}

export function Home({ navigation }) {
  const { colors } = useTheme();
  const s = useS();
  const { activeTrip, plannedTrip, startTrip, finishTrip, cancelTrip, user, tripState, loadCurrentTrip, health, loadHealth } = useApp();
  const trip = activeTrip || plannedTrip;
  const { mountain } = useFocusMountain();
  const wTarget = mountain && mountain.hasCoords && mountain.hasCoords() ? { latitude: mountain.latitude, longitude: mountain.longitude } : null;
  const weather = useWeather(wTarget);
  const [busy, setBusy] = useState(false);
  const overdue = activeTrip ? activeTrip.isOverdue() : false;
  const last = activeTrip ? activeTrip.lastKnownLocation() : null;
  const label = { planned: 'Direncanakan', active: 'Aktif' };

  const run = async (fn, title) => {
    setBusy(true);
    try { await fn(); } catch (e) { Alert.alert(title, e.message); } finally { setBusy(false); }
  };
  const onStart = () => run(async () => {
    const ok = await startTrip(trip);
    if (!ok) Alert.alert('Lokasi tidak tersedia', 'Pendakian tetap dimulai, tetapi posisimu belum bisa dicatat. Cek izin dan GPS di menu Status Sistem.');
  }, 'Tidak bisa memulai');
  const onCancel = () => Alert.alert('Batalkan rencana?', trip.trailName, [
    { text: 'Tidak', style: 'cancel' },
    { text: 'Batalkan', style: 'destructive', onPress: () => run(() => cancelTrip(trip), 'Gagal membatalkan') },
  ]);
  const onFinish = () => Alert.alert('Akhiri pendakian?', trip.trailName, [
    { text: 'Batal', style: 'cancel' },
    { text: 'Akhiri', onPress: () => run(() => finishTrip(trip), 'Gagal mengakhiri') },
  ]);

  const stats = trip ? [
    ['Status', label[trip.status]],
    ['Durasi', activeTrip ? `${Math.floor(trip.durationMinutes() / 60)}j ${trip.durationMinutes() % 60}m` : '-'],
    ['Lokasi', last ? 'Tercatat' : (activeTrip ? 'Tidak tersedia' : '-')],
  ] : [['Status', '-'], ['Durasi', '-'], ['Lokasi', '-']];
  const shortcuts = [['call', 'Kontak', 'Contacts'], ['time', 'Riwayat', 'History'], ['pulse', 'Status', 'SystemStatus']];
  const shortcuts2 = [['book', 'Panduan', 'Guide'], ['add-circle', 'Rencana', 'PlanHike'],
    ...(user && user.isAdmin ? [['flask', 'Pengujian', 'TestStatus'], ['cloud-download', 'Data', 'DataUpdate']] : [])];
  const leftMin = trip && trip.expectedReturnAt ? Math.round((trip.expectedReturnAt - new Date()) / 60000) : 0;
  const contact = (trip && trip.contactId && user && user.emergencyContacts.find((c) => c.id === trip.contactId)) || (user && user.primaryContact());
  const hl = health.latest;
  const w = weather.data;
  const cond = [
    ['Detak Jantung', hl && hl.bpm != null ? `${hl.bpm} bpm` : '-'],
    ['Cuaca', w && w.current ? `${Math.round(w.current.temperatureC)}°C` : '-'],
    ['Suhu', hl && hl.temperatureC != null ? (hl.temperatureC < 35 || hl.temperatureC >= 38 ? 'Waspada' : 'Aman') : '-'],
    ['Kelembapan', w && w.current && w.current.humidity != null ? `${w.current.humidity}%` : '-'],
  ];
  const nextPos = activeTrip && activeTrip.progress && activeTrip.progress.next;

  return (
    <Page title={trip ? trip.mountain.name : 'Belum ada pendakian'} sub={trip ? trip.trailName : 'Buat rencana pendakian untuk mulai'}
      refreshing={tripState.loading} onRefresh={() => { loadCurrentTrip(); loadHealth(); weather.reload(); }}>
      <Hero />
      {tripState.loading && !trip && <Loading text="Memuat pendakian..." />}
      <ErrorBox message={tripState.error} onRetry={loadCurrentTrip} />
      {overdue && (
        <TouchableOpacity style={[s.alert, { backgroundColor: colors.warn }]} onPress={() => navigation.navigate('Emergency')}>
          <Text style={{ fontWeight: '700', color: colors.onStatus }}>Melewati batas waktu turun. Ketuk jika butuh bantuan.</Text>
        </TouchableOpacity>
      )}
      <View style={s.row}>{stats.map(([a, b]) => <Card key={a} style={s.stat}><Text style={s.mute}>{a}</Text><Text style={s.b}>{b}</Text></Card>)}</View>
      <View style={[s.row, { marginTop: 12 }]}>
        <TouchableOpacity style={[s.shortcut, { backgroundColor: colors.red }]} onPress={() => navigation.navigate('Emergency')}>
          <Ionicons name="warning" size={20} color={colors.onAccent} /><Text style={[s.b, { color: colors.onAccent }]}>SOS</Text>
        </TouchableOpacity>
        {shortcuts.map(([ic, t, to]) => (
          <TouchableOpacity key={t} style={s.shortcut} onPress={() => navigation.navigate(to)}>
            <Ionicons name={ic} size={20} color={colors.text} /><Text style={s.b}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={[s.row, { marginTop: 8 }]}>
        {shortcuts2.map(([ic, t, to]) => (
          <TouchableOpacity key={t} style={s.shortcut} onPress={() => navigation.navigate(to)}>
            <Ionicons name={ic} size={18} color={colors.text} /><Text style={[s.b, { fontSize: 12 }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {trip && (
        <Card><Text style={s.b}>Dashboard Pendakian</Text>
          <View style={s.dash}><Text style={s.mute}>Tanggal berangkat</Text><Text style={s.b}>{trip.startDate.toLocaleDateString('id-ID')}</Text></View>
          <View style={s.dash}><Text style={s.mute}>Estimasi turun</Text><Text style={s.b}>{trip.expectedReturnAt.toLocaleDateString('id-ID')} {hm(trip.expectedReturnAt)}</Text></View>
          {activeTrip && <View style={s.dash}><Text style={s.mute}>Sisa waktu</Text><Text style={[s.b, { color: leftMin < 0 ? colors.red : leftMin < 120 ? colors.warn : colors.ok }]}>{leftMin < 0 ? `Lewat ${fmtLeft(-leftMin)}` : fmtLeft(leftMin)}</Text></View>}
          {nextPos && <View style={s.dash}><Text style={s.mute}>Pos berikutnya</Text><Text style={s.b}>{nextPos.name}{nextPos.estimatedAt ? ` · Est. ${hm(new Date(nextPos.estimatedAt))}` : ''}</Text></View>}
          <View style={s.dash}><Text style={s.mute}>Rombongan</Text><Text style={s.b}>{trip.groupSize} orang · {trip.plannedDays} hari</Text></View>
          {activeTrip && <View style={s.dash}><Text style={s.mute}>Lokasi terakhir</Text><Text style={s.b}>{last ? `${last.toString()} (${hm(last.recordedAt)})` : 'Tidak tersedia'}</Text></View>}
          {activeTrip && <View style={s.dash}><Text style={s.mute}>Titik tercatat</Text><Text style={s.b}>{activeTrip.locations.length} ({activeTrip.unavailableCount()} gagal)</Text></View>}
          <View style={s.dash}><Text style={s.mute}>Kontak darurat</Text><Text style={s.b}>{contact ? contact.name : 'Belum ada'}</Text></View>
        </Card>
      )}
      <Card><Text style={s.b}>Kondisi Pendakian</Text>
        <View style={s.grid}>{cond.map(([a, b]) =>
          <View key={a} style={s.cell}><Text style={s.mute}>{a}</Text><Text style={{ color: colors.accent }}>{b}</Text></View>)}</View>
        <Text style={[s.mute, { marginTop: 6 }]}>{w && w.current ? `${w.current.description} · ` : ''}Detak jantung & suhu tubuh: simulasi. Cuaca: Open-Meteo.</Text></Card>
      <Card><Text style={s.b}>Cuaca Per Jam{mountain ? ` · ${mountain.name}` : ''}</Text>
        {weather.loading && !w && <Loading text="Memuat cuaca..." />}
        <ErrorBox message={weather.error} onRetry={weather.reload} />
        {!weather.loading && !weather.error && !w && <Text style={[s.mute, { marginTop: 6 }]}>Pilih gunung di tab Mount atau izinkan lokasi untuk melihat cuaca.</Text>}
        {w && <ScrollView horizontal showsHorizontalScrollIndicator={false}>{w.hourly.slice(0, 6).map((h, i) =>
          <View key={h.time} style={[s.hour, i === 0 && { backgroundColor: colors.accent }]}>
            <Text style={[s.mute, i === 0 && { color: colors.onAccent }]}>{i === 0 ? 'Now' : `${i} jam`}</Text>
            <Ionicons name={h.icon || 'partly-sunny'} size={18} color={i === 0 ? colors.onAccent : colors.text} />
            <Text style={{ color: i === 0 ? colors.onAccent : colors.text }}>{Math.round(h.temperatureC)}°</Text></View>)}</ScrollView>}
      </Card>
      {!trip && <TouchableOpacity style={[s.cta, { backgroundColor: colors.accent }]} onPress={() => navigation.navigate('PlanHike')}><Text style={s.ctaT}>Buat Rencana Pendakian</Text></TouchableOpacity>}
      {trip && trip.status === 'planned' && <TouchableOpacity disabled={busy} style={[s.cta, { backgroundColor: colors.ok, marginBottom: 0, opacity: busy ? 0.6 : 1 }]} onPress={onStart}><Text style={s.ctaT}>{busy ? 'Memproses...' : 'Mulai Pendakian'}</Text></TouchableOpacity>}
      {trip && trip.status === 'planned' && <TouchableOpacity disabled={busy} style={[s.cta, { backgroundColor: colors.neutral, marginTop: 10 }]} onPress={onCancel}><Text style={s.ctaT}>Batalkan Rencana</Text></TouchableOpacity>}
      {trip && trip.status === 'active' && <TouchableOpacity disabled={busy} style={[s.cta, { backgroundColor: colors.neutral, opacity: busy ? 0.6 : 1 }]} onPress={onFinish}><Text style={s.ctaT}>{busy ? 'Memproses...' : 'Akhiri Pendakian'}</Text></TouchableOpacity>}
    </Page>
  );
}

// ------------------------------------------------------------------ Maps
const fmtKmPos = (c) => `${num(c.elevationMdpl)} mdpl${c.distanceKm != null ? ` · ${String(c.distanceKm).replace('.', ',')} km` : ''}`;

function usePosData(mountain, trip) {
  // Pendakian punya progres pos dari backend; gunung terpilih saja -> ambil pos jalur default.
  const [st, setSt] = useState({ trail: null, checkpoints: [], loading: false, error: null });
  const mid = mountain ? mountain.id : null;
  const tripKey = trip ? `${trip.id}:${trip.status}` : '';
  const load = async () => {
    if (!mountain) { setSt({ trail: null, checkpoints: [], loading: false, error: null }); return; }
    setSt((x) => ({ ...x, loading: true, error: null }));
    try {
      const trails = await api.trails(mountain.id);
      const trail = (trip && trails.find((t) => String(t.id) === String(trip.trailId) || t.name === trip.trailName))
        || trails.find((t) => t.checkpointCount > 0) || trails[0] || null;
      setSt({ trail, checkpoints: trail ? trail.checkpoints.map((c) => ({ ...c, status: 'next', arrivedAt: null, estimatedAt: null })) : [], loading: false, error: null });
    } catch (e) {
      setSt((x) => ({ ...x, loading: false, error: e.message }));
    }
  };
  useEffect(() => { load(); }, [mid, tripKey]);
  const checkpoints = trip && trip.progress && trip.progress.checkpoints && trip.progress.checkpoints.length ? trip.progress.checkpoints : st.checkpoints;
  return { ...st, checkpoints, reload: load };
}

export function Maps({ navigation }) {
  const { colors } = useTheme();
  const s = useS();
  const { activeTrip, checkin, loadCurrentTrip, tripState } = useApp();
  const { mountain, trip } = useFocusMountain();
  const pos = usePosData(mountain, trip);
  const [userLoc, setUserLoc] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { // posisi user (hanya jika izin sudah diberikan)
    let alive = true;
    getCurrentLocation().then((l) => { if (alive && l.isAvailable()) setUserLoc({ latitude: l.latitude, longitude: l.longitude }); });
    return () => { alive = false; };
  }, []);

  // A. Belum memilih gunung: peta saja + arahan.
  if (!mountain) {
    return (
      <Page title="PETA JALUR" sub="Belum ada gunung terpilih">
        <TrailMap userLocation={userLoc} showUser={!!userLoc} style={{ height: 320 }} />
        <TouchableOpacity style={[s.alert, { backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 10 }]} onPress={() => navigation.navigate('Mount')}>
          <Ionicons name="triangle-outline" size={20} color={colors.accent} />
          <Text style={[s.b, { flex: 1 }]}>Pilih gunung di tab Mount untuk melihat jalur</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.mute} />
        </TouchableOpacity>
      </Page>
    );
  }

  const trail = pos.trail;
  const cps = pos.checkpoints;
  const basecamp = trail && trail.basecampLat != null ? { latitude: Number(trail.basecampLat), longitude: Number(trail.basecampLng), name: trail.basecampName } : null;
  const summit = mountain.hasCoords() ? { latitude: mountain.latitude, longitude: mountain.longitude, name: `Puncak ${mountain.name}` } : null;
  const isActive = !!(activeTrip && trip && activeTrip.id === trip.id);
  const lastIdx = cps.reduce((acc, c, i) => (c.arrivedAt ? i : acc), -1);
  const sub = `${trail ? trail.name : mountain.name} · ${trip ? (trip.status === 'active' ? 'Aktif' : 'Direncanakan') : 'Dipilih'}`;
  const alts = isActive ? activeTrip.trackPoints().map((l) => l.altitudeM).filter((a) => a != null) : [];

  const onPos = (c, i) => {
    if (!isActive) {
      if (trip) Alert.alert('Belum mulai', 'Tekan "Mulai Pendakian" di Home untuk bisa check-in di pos.');
      return;
    }
    if (c.arrivedAt) { Alert.alert(c.name, `Sudah check-in pukul ${hm(new Date(c.arrivedAt))}`); return; }
    if (i < lastIdx) { Alert.alert(c.name, 'Pos ini berada sebelum pos terakhir yang sudah dicatat.'); return; }
    Alert.alert(`Check-in di ${c.name}?`, `Waktu sampai dicatat sekarang (${hm(new Date())}).`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Check-in', onPress: async () => {
        setBusyId(c.id);
        try {
          const p = await checkin(c.id);
          const n = p.next;
          Alert.alert('Check-in tercatat', n ? `Pos berikutnya: ${n.name}${n.estimatedAt ? `, estimasi sampai ${hm(new Date(n.estimatedAt))}` : ''}.` : 'Ini pos terakhir. Hati-hati saat turun!');
        } catch (e) { Alert.alert('Check-in gagal', e.message); } finally { setBusyId(null); }
      } },
    ]);
  };

  const timeText = (c) => {
    if (c.arrivedAt) return hm(new Date(c.arrivedAt));
    if (c.estimatedAt) return `Est. ${hm(new Date(c.estimatedAt))}`;
    return '-';
  };

  return (
    <Page title="PETA JALUR" sub={sub} refreshing={pos.loading || tripState.loading} onRefresh={() => { pos.reload(); if (trip) loadCurrentTrip(); }}>
      <TrailMap checkpoints={cps} basecamp={basecamp} summit={summit} track={isActive ? activeTrip.locations : []} userLocation={userLoc} showUser={!!userLoc} />
      {isActive && (
        <View style={[s.row, { marginTop: 12 }]}>
          {[['Titik', activeTrip.locations.length], ['Check-in', `${cps.filter((c) => c.arrivedAt).length}/${cps.length}`], ['Tertinggi', alts.length ? `${Math.max(...alts)} m` : '-']].map(([a, b]) =>
            <Card key={a} style={s.stat}><Text style={s.mute}>{a}</Text><Text style={s.b}>{b}</Text></Card>)}
        </View>
      )}
      {isActive && cps.length > 0 && <Text style={[s.mute, { marginTop: 10 }]}>Ketuk pos saat kamu sampai untuk check-in.</Text>}
      {!trip && <Text style={[s.mute, { marginTop: 10 }]}>Buat rencana lewat tombol "Tambahkan Pendakian" di tab Mount untuk mulai mencatat waktu di setiap pos.</Text>}
      {pos.loading && !cps.length && <Loading text="Memuat pos..." />}
      {/* Dua keadaan berbeda: gagal memuat (error jaringan/server) vs data pos memang belum ada di server. */}
      <ErrorBox message={pos.error ? `Gagal memuat data pos: ${pos.error}` : null} onRetry={pos.reload} />
      {!pos.loading && !pos.error && cps.length === 0 && (
        <Empty icon="flag-outline"
          text={`Data pos untuk jalur ${trail ? trail.name : 'ini'} belum tersedia di server.${basecamp || summit ? ' Peta menampilkan basecamp dan puncak saja.' : ''}`} />
      )}
      {cps.some((c) => c.isSample) && <Text style={[s.mute, { marginTop: 8 }]}>Koordinat pos adalah perkiraan (data contoh).</Text>}
      {cps.map((c, i) => {
        const st = c.status;
        return (
          <TouchableOpacity key={c.id} activeOpacity={0.7} onPress={() => onPos(c, i)} disabled={busyId != null}>
            <Card style={s.pos}>
              <Ionicons name={st === 'done' ? 'checkmark-circle' : st === 'current' ? 'location' : 'chevron-forward-circle'} size={22} color={st === 'done' ? colors.ok : st === 'current' ? colors.red : colors.mute} />
              <View style={{ flex: 1, marginLeft: 10 }}><Text style={s.b}>{c.name}</Text><Text style={s.mute}>{fmtKmPos(c)}</Text></View>
              <Text style={s.b}>{busyId === c.id ? '...' : timeText(c)}</Text></Card>
          </TouchableOpacity>
        );
      })}
    </Page>
  );
}

// ------------------------------------------------------------------ Health
const Bars = ({ data, color }) => {
  const s = useS();
  const max = Math.max(...data, 1);
  const min = Math.min(...data, max);
  return <View style={s.bars}>{data.map((v, i) => <View key={i} style={{ flex: 1, height: 15 + ((v - min) / Math.max(max - min, 1)) * 75, backgroundColor: color, marginHorizontal: 2, borderRadius: 3 }} />)}</View>;
};
export function Health() {
  const { colors } = useTheme();
  const s = useS();
  const { health, activeTrip, loadHealth, measureNow } = useApp();
  const [busy, setBusy] = useState(false);
  const h = health.latest;
  const series = useMemo(() => [...health.items].reverse().slice(-10), [health.items]);
  const bpmData = series.map((x) => x.bpm).filter((v) => v != null);
  const altData = series.map((x) => x.altitudeM).filter((v) => v != null);
  const measure = async () => {
    setBusy(true);
    try { await measureNow(); } catch (e) { Alert.alert('Gagal mengukur', e.message); } finally { setBusy(false); }
  };
  const steps = health.steps != null ? health.steps : h && h.steps;
  const sub = activeTrip ? `Pantauan otomatis · ${activeTrip.mountain.name}` : 'Pantauan Selama Pendakian';

  return (
    <Page title="Monitor Kesehatan" sub={sub} refreshing={health.loading} onRefresh={loadHealth}>
      {health.loading && !h && <Loading text="Memuat data kesehatan..." />}
      <ErrorBox message={health.error} onRetry={loadHealth} />
      {!health.loading && !h && !health.error && <Empty text={activeTrip ? 'Data pertama akan tercatat sebentar lagi.' : 'Belum ada data. Data tercatat otomatis saat pendakian aktif, atau tekan "Ukur Sekarang".'} icon="heart-outline" />}
      {h && (
        <>
          <Card><Text style={s.mute}>Detak Jantung</Text><Text style={s.b}>{h.bpm != null ? `${h.bpm} bpm` : '-'}</Text>{bpmData.length > 1 && <Bars color={colors.red} data={bpmData} />}</Card>
          <Card><Text style={s.mute}>Ketinggian</Text><Text style={s.b}>{h.altitudeM != null ? `${num(h.altitudeM)} mdpl` : '-'}</Text>{altData.length > 1 && <Bars color={colors.accent} data={altData} />}</Card>
          <View style={s.grid}>{[['Oksigen (SpO2)', h.spo2 != null ? `${h.spo2}%` : '-'], ['Suhu Tubuh', h.temperatureC != null ? `${String(h.temperatureC).replace('.', ',')}°C` : '-'],
            ['Langkah', steps != null ? num(steps) : '-'], ['Kalori', h.calories != null ? `${num(h.calories)} kkal` : '-']].map(([a, b]) =>
            <Card key={a} style={s.cell}><Text style={s.mute}>{a}</Text><Text style={s.b}>{b}</Text></Card>)}</View>
          {h.warnings.map((w) => (
            <View key={w.code} style={[s.alert, { backgroundColor: w.level === 'danger' ? colors.red : colors.warn }]}>
              <Text style={{ color: w.level === 'danger' ? colors.onAccent : colors.onStatus }}>{w.message}</Text></View>))}
          {h.warnings.length === 0 && <View style={[s.alert, { backgroundColor: colors.ok }]}><Text style={{ color: colors.onStatus }}>Kondisi tubuh stabil</Text></View>}
          <Text style={[s.mute, { marginTop: 10 }]}>
            Terakhir: {hm(new Date(h.recordedAt))}{h.isSimulated ? ' · detak jantung, SpO2 & suhu = simulasi' : ''}{health.pedometer ? ' · langkah dari pedometer HP' : ''}
          </Text>
        </>
      )}
      <TouchableOpacity disabled={busy} style={[s.cta, { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }]} onPress={measure}>
        <Text style={s.ctaT}>{busy ? 'Mengukur...' : 'Ukur Sekarang'}</Text></TouchableOpacity>
    </Page>
  );
}

// ------------------------------------------------------------------ Starterpack (dihitung di frontend)
export function Starterpack() {
  const { colors } = useTheme();
  const s = useS();
  const { currentTrip } = useApp();
  const [p, setP] = useState(currentTrip ? currentTrip.groupSize : 4);
  const [d, setD] = useState(currentTrip ? Math.min(7, currentTrip.plannedDays) : 3);
  useEffect(() => { if (currentTrip) { setP(currentTrip.groupSize); setD(Math.min(7, currentTrip.plannedDays)); } }, [currentTrip && currentTrip.id]);
  const Row = ({ a, b }) => <View style={s.line}><Text style={s.b}>{a}</Text><Text style={s.b}>{b}</Text></View>;
  return (
    <Page title="Kalkulator Starterpack" sub={currentTrip ? `Pendakian ${currentTrip.status === 'active' ? 'Aktif' : 'Direncanakan'} · ${currentTrip.mountain.name}` : 'Pendakian Aktif'}>
      <Card>
        <View style={s.line}><Text style={s.b}>Jumlah Orang</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setP(Math.max(1, p - 1))}><Ionicons name="remove-circle" size={26} color={colors.accent} /></TouchableOpacity>
            <Text style={[s.b, { marginHorizontal: 12 }]}>{p}</Text>
            <TouchableOpacity onPress={() => setP(p + 1)}><Ionicons name="add-circle" size={26} color={colors.accent} /></TouchableOpacity></View></View>
        <Text style={[s.b, { marginTop: 10 }]}>Lama Pendakian: {d} Hari</Text>
        <View style={s.row}>{[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <TouchableOpacity key={n} onPress={() => setD(n)} style={[s.day, n === d && { backgroundColor: colors.accent }]}><Text style={[s.b, n === d && { color: colors.onAccent }]}>{n}</Text></TouchableOpacity>))}</View>
      </Card>
      <Card><Text style={s.h2}>Perlengkapan Tidur</Text>
        <Row a="Tenda" b={`${Math.ceil(p / 2)} Buah`} /><Row a="Sleeping Bag" b={`${p} Buah`} /><Row a="Matras" b={`${p} Buah`} /></Card>
      <Card><Text style={s.h2}>Makanan</Text>
        <Row a="Logistik Makanan" b={`${p * d * 2} Porsi`} /><Row a="Air Minum" b={`${p * d * 3} Liter`} /><Row a="Kompor Gas" b={`${(p * d * 0.2).toFixed(1)} Tabung`} /></Card>
    </Page>
  );
}

// ------------------------------------------------------------------ Mount (direktori gunung)
const DIFF_FILTERS = [['', 'Semua'], ['easy', 'Easy'], ['medium', 'Medium'], ['extreme', 'Extreme']];

export function Mount({ navigation }) {
  const { colors } = useTheme();
  const s = useS();
  const { mountains, mountainsState, loadMountains, selectMountain, selectedMountainId, currentTrip } = useApp();
  const [q, setQ] = useState('');
  const [diff, setDiff] = useState('');
  const [res, setRes] = useState({ list: null, loading: false, error: null });
  const [retry, setRetry] = useState(0);

  // Pencarian & filter dikirim ke backend (GET /mountains?q=&difficulty=), dengan jeda ketik 350 ms.
  useEffect(() => {
    if (!q.trim() && !diff) { setRes({ list: null, loading: false, error: null }); return undefined; }
    let alive = true;
    setRes((r) => ({ ...r, loading: true, error: null }));
    const h = setTimeout(async () => {
      try {
        const list = parseMountains(await api.mountains({ q: q.trim(), difficulty: diff }), { allowEmpty: true });
        if (alive) setRes({ list, loading: false, error: null });
      } catch (e) {
        if (alive) setRes({ list: null, loading: false, error: e.message });
      }
    }, 350);
    return () => { alive = false; clearTimeout(h); };
  }, [q, diff, retry]);

  const list = res.list || mountains;
  const loading = res.loading || (mountainsState.loading && !res.list);
  const error = res.error || (!res.list && mountainsState.error);

  const add = (m) => {
    selectMountain(m.id); // langsung jadi gunung terpilih untuk Maps
    if (currentTrip) {
      Alert.alert('Gunung dipilih', `Maps sekarang menampilkan ${currentTrip.mountain.name} karena masih ada pendakian ${currentTrip.status === 'active' ? 'aktif' : 'yang direncanakan'}. Selesaikan atau batalkan dulu untuk merencanakan ${m.name}.`);
      return;
    }
    navigation.navigate('PlanHike', { mountainId: m.id });
  };

  return (
    <Page title="Direktori Gunung" sub="Pendakian Gunung" refreshing={mountainsState.loading} onRefresh={() => loadMountains().catch(() => {})}>
      <TextInput value={q} onChangeText={setQ} placeholder="Search Here" placeholderTextColor={colors.mute} style={s.search} />
      <View style={[s.row, { justifyContent: 'flex-start' }]}>{DIFF_FILTERS.map(([k, l]) => (
        <TouchableOpacity key={k || 'all'} onPress={() => setDiff(k)} style={[s.chip, diff === k && { backgroundColor: colors.accent }]}>
          <Text style={[s.chipT, diff === k && { color: colors.onAccent }]}>{l}</Text></TouchableOpacity>))}</View>
      {loading && <Loading text="Memuat gunung..." />}
      <ErrorBox message={error} onRetry={() => (res.error ? setRetry((n) => n + 1) : loadMountains().catch(() => {}))} />
      {!loading && list.length === 0 && <Empty text="Gunung tidak ditemukan." icon="search-outline" />}
      {list.map((m) => {
        const dInfo = DIFFICULTY[m.difficulty] || { label: m.difficulty, color: colors.mute };
        const selected = String(selectedMountainId) === String(m.id);
        return (
          <ImageBackground key={m.id} source={m.imageUrl ? { uri: m.imageUrl } : undefined} style={[s.mCard, selected && { borderWidth: 2, borderColor: colors.accent }]} imageStyle={{ borderRadius: 10 }}>
            {m.imageUrl ? <View style={[s.shade, { backgroundColor: colors.imageShade }]} /> : null}
            <View style={{ flex: 1 }}><Text style={s.mSub}>{num(m.elevationMdpl)} mdpl · {m.trails.length} jalur{m.province ? ` · ${m.province}` : ''}</Text></View>
            <View style={s.mRow}><Text style={s.mName}>{m.name}</Text>
              <View style={[s.badge, { backgroundColor: dInfo.color }]}><Text style={{ fontSize: 10, color: colors.onStatus }}>{dInfo.label}</Text></View></View>
            <TouchableOpacity style={s.addBtn} onPress={() => add(m)}>
              <Text style={{ fontSize: 11, color: colors.btnLightText }}>{selected ? 'Terpilih · Tambahkan Pendakian' : 'Tambahkan Pendakian'}</Text></TouchableOpacity>
          </ImageBackground>);
      })}
    </Page>
  );
}

const useS = makeStyles((c) => ({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  brand: { color: c.mute, fontSize: 12 }, h1: { color: c.text, fontSize: 24, fontWeight: '700' }, h2: { color: c.text, fontWeight: '700', marginBottom: 6 },
  mute: { color: c.mute, fontSize: 12 }, b: { color: c.text, fontWeight: '600' },
  card: { backgroundColor: c.card, borderRadius: 10, padding: 12, marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  stat: { flex: 1, alignItems: 'center', marginTop: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  cell: { width: '48%', backgroundColor: c.cardAlt, borderRadius: 8, padding: 10, marginTop: 0 },
  hour: { alignItems: 'center', padding: 8, marginRight: 6, borderRadius: 8, gap: 4 },
  cta: { backgroundColor: c.red, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  ctaT: { color: c.onAccent, fontWeight: '600' },
  dash: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: c.border, gap: 10 },
  pos: { flexDirection: 'row', alignItems: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 90, marginTop: 8 },
  alert: { borderRadius: 8, padding: 10, marginTop: 10 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: c.border },
  day: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6, backgroundColor: c.cardAlt },
  search: { backgroundColor: c.card, color: c.text, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  chip: { backgroundColor: c.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, marginTop: 4 },
  chipT: { color: c.text, fontSize: 12 },
  mCard: { height: 112, borderRadius: 10, backgroundColor: c.mCard, marginTop: 12, padding: 10, overflow: 'hidden' },
  shade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 10 },
  mSub: { color: c.mCardText, fontSize: 11 },
  mRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mName: { color: c.onAccent, fontSize: 18, fontWeight: '700' }, badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  shortcut: { flex: 1, backgroundColor: c.card, borderRadius: 10, paddingVertical: 10, alignItems: 'center', gap: 4 },
  addBtn: { alignSelf: 'flex-end', backgroundColor: c.btnLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
}));
