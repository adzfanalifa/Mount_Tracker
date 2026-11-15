import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Linking, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, makeStyles } from './theme';
import { useApp } from './store';
import { dateUtil } from './models';
import { diagnoseLocation, checkNetwork, requestPermission } from './location';
import { Loading, ErrorBox, Empty } from './ui';

// ------------------------------------------------------------ komponen kecil
export const Screen = ({ children, refreshing, onRefresh }) => {
  const { colors } = useTheme();
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined}>
      {children}
    </ScrollView>
  );
};
export const Card = ({ children, style }) => { const x = useX(); return <View style={[x.card, style]}>{children}</View>; };
export const Btn = ({ t, onPress, color, style, disabled }) => {
  const { colors } = useTheme();
  const x = useX();
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[x.btn, { backgroundColor: color || colors.accent, opacity: disabled ? 0.5 : 1 }, style]}>
      <Text style={x.btnT}>{t}</Text>
    </TouchableOpacity>
  );
};
export const Field = ({ label, ...props }) => {
  const { colors } = useTheme();
  const x = useX();
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={x.mute}>{label}</Text>
      <TextInput placeholderTextColor={colors.mute} style={x.input} autoCapitalize="none" {...props} />
    </View>
  );
};
export const Chip = ({ t, on, onPress }) => {
  const { colors } = useTheme();
  const x = useX();
  return (
    <TouchableOpacity onPress={onPress} style={[x.chip, on && { backgroundColor: colors.accent }]}>
      <Text style={[x.b, on && { color: colors.onAccent }]}>{t}</Text>
    </TouchableOpacity>
  );
};
const Stepper = ({ label, value, setValue, min = 1, max = 99 }) => {
  const { colors } = useTheme();
  const x = useX();
  return (
    <View style={[x.line, { marginTop: 12 }]}>
      <Text style={x.b}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => setValue(Math.max(min, value - 1))}><Ionicons name="remove-circle" size={28} color={colors.accent} /></TouchableOpacity>
        <Text style={[x.b, { marginHorizontal: 14, minWidth: 20, textAlign: 'center' }]}>{value}</Text>
        <TouchableOpacity onPress={() => setValue(Math.min(max, value + 1))}><Ionicons name="add-circle" size={28} color={colors.accent} /></TouchableOpacity>
      </View>
    </View>
  );
};

export const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtDateTime = (d) => `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
function parseDate(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s).trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}
const call = (phone) => Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Tidak bisa menelepon', `Hubungi manual: ${phone}`));

// ------------------------------------------------------------- Rencana Pendakian
export function PlanHike({ navigation, route }) {
  const { colors } = useTheme();
  const x = useX();
  const { addTrip, user, mountains, mountainsState, loadMountains, selectedMountainId, selectMountain, contactsState, currentTrip } = useApp();
  const initialId = (route.params && route.params.mountainId) || selectedMountainId || (mountains[0] && mountains[0].id);
  const [mId, setMId] = useState(initialId ? String(initialId) : null);
  const mountain = mountains.find((m) => String(m.id) === mId) || mountains[0];
  const [trail, setTrail] = useState(mountain ? (mountain.defaultTrail() || { name: mountain.trails[0] }).name : null);
  const trailName = mountain && mountain.trails.includes(trail) ? trail : mountain && mountain.trails[0];
  const [date, setDate] = useState(fmtDate(dateUtil.addDays(new Date(), 1)));
  const [people, setPeople] = useState(2);
  const [days, setDays] = useState(2);
  const [ret, setRet] = useState('16:00');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const contact = user && user.primaryContact();

  if (!mountain) {
    return (
      <Screen>
        {mountainsState.loading ? <Loading text="Memuat gunung..." /> : <ErrorBox message={mountainsState.error || 'Data gunung belum tersedia'} onRetry={() => loadMountains().catch(() => {})} />}
      </Screen>
    );
  }

  const pick = (m) => { setMId(String(m.id)); setTrail((m.defaultTrail() || { name: m.trails[0] }).name); selectMountain(m.id); };

  const submit = async () => {
    if (currentTrip) {
      Alert.alert('Masih ada pendakian', `Pendakian ${currentTrip.mountain.name} masih ${currentTrip.status === 'active' ? 'aktif' : 'direncanakan'}. Selesaikan atau batalkan dulu dari Home.`);
      return;
    }
    if (!contact) {
      Alert.alert('Kontak darurat belum ada', 'Tambahkan minimal satu kontak darurat sebelum membuat rencana pendakian.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Tambah Kontak', onPress: () => navigation.navigate('Contacts') },
      ]);
      return;
    }
    const start = parseDate(date);
    if (!start) { Alert.alert('Tanggal tidak valid', 'Gunakan format TAHUN-BULAN-TANGGAL, contoh 2026-12-24.'); return; }
    if (start < dateUtil.startOfDay(new Date())) { Alert.alert('Tanggal tidak valid', 'Tanggal berangkat tidak boleh di masa lalu.'); return; }
    const t = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(ret.trim());
    if (!t) { Alert.alert('Jam tidak valid', 'Gunakan format JJ:MM, contoh 16:00.'); return; }
    const end = dateUtil.addDays(start, days - 1);
    end.setHours(+t[1], +t[2], 0, 0);
    setBusy(true);
    try {
      await addTrip({ mountain, trailName, groupSize: people, plannedDays: days, startDate: start, expectedReturnAt: end, notes });
      selectMountain(mountain.id);
      Alert.alert('Rencana tersimpan', 'Status: Direncanakan. Tekan Mulai Pendakian di Home saat berangkat.', [{ text: 'OK', onPress: () => navigation.navigate('Main') }]);
    } catch (e) {
      Alert.alert('Data belum valid', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={x.h2}>Gunung</Text>
      <View style={x.wrap}>{mountains.map((m) => <Chip key={m.id} t={m.name} on={m.id === mountain.id} onPress={() => pick(m)} />)}</View>
      <Text style={[x.h2, { marginTop: 14 }]}>Jalur</Text>
      <View style={x.wrap}>{mountain.trails.map((tr) => <Chip key={tr} t={tr} on={tr === trailName} onPress={() => setTrail(tr)} />)}</View>

      <Field label="Tanggal berangkat (TAHUN-BULAN-TANGGAL)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      <Stepper label="Jumlah orang" value={people} setValue={setPeople} max={50} />
      <Stepper label="Lama pendakian (hari)" value={days} setValue={setDays} max={14} />
      <Field label="Perkiraan jam turun di hari terakhir (JJ:MM)" value={ret} onChangeText={setRet} keyboardType="numbers-and-punctuation" />
      <Field label="Catatan (opsional)" value={notes} onChangeText={setNotes} multiline style={[x.input, { height: 80, textAlignVertical: 'top' }]} />

      <Card style={{ marginTop: 16 }}>
        <Text style={x.mute}>Kontak darurat utama</Text>
        {contactsState.loading && !contact ? <ActivityIndicator color={colors.accent} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          : contact ? <Text style={x.b}>{contact.name} · {contact.phone}</Text> : <Text style={{ color: colors.warn }}>Belum ada kontak darurat</Text>}
        <TouchableOpacity onPress={() => navigation.navigate('Contacts')}><Text style={{ color: colors.accent, marginTop: 6 }}>Kelola kontak darurat</Text></TouchableOpacity>
      </Card>
      <Btn t={busy ? 'Menyimpan...' : 'Simpan Rencana'} onPress={submit} disabled={busy} style={{ marginTop: 16 }} />
    </Screen>
  );
}

// -------------------------------------------------------------- Kontak Darurat
export function Contacts() {
  const { colors } = useTheme();
  const x = useX();
  const { user, addContact, removeContact, setPrimaryContact, contactsState, loadContacts } = useApp();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rel, setRel] = useState('');
  const [busy, setBusy] = useState(false);
  const contacts = user ? user.emergencyContacts : [];

  const act = async (fn, title) => {
    setBusy(true);
    try { await fn(); return true; } catch (e) { Alert.alert(title, e.message); return false; } finally { setBusy(false); }
  };
  const add = async () => {
    const ok = await act(() => addContact({ name, phone, relationship: rel }), 'Data belum valid');
    if (ok) { setName(''); setPhone(''); setRel(''); }
  };
  const del = (c) => Alert.alert('Hapus kontak?', c.name, [
    { text: 'Batal', style: 'cancel' },
    { text: 'Hapus', style: 'destructive', onPress: () => act(() => removeContact(c.id), 'Gagal menghapus') },
  ]);

  return (
    <Screen refreshing={contactsState.loading} onRefresh={loadContacts}>
      {contactsState.loading && contacts.length === 0 && <Loading text="Memuat kontak..." />}
      <ErrorBox message={contactsState.error} onRetry={loadContacts} />
      {!contactsState.loading && contacts.length === 0 && <Text style={x.mute}>Belum ada kontak. Tambahkan minimal satu sebelum mendaki.</Text>}
      {contacts.map((c) => (
        <Card key={c.id} style={x.contact}>
          <TouchableOpacity disabled={busy} onPress={() => act(() => setPrimaryContact(c.id), 'Gagal mengganti kontak utama')}>
            <Ionicons name={c.isPrimary ? 'star' : 'star-outline'} size={22} color={c.isPrimary ? colors.warn : colors.mute} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={x.b}>{c.name}{c.isPrimary ? ' (utama)' : ''}</Text>
            <Text style={x.mute}>{c.phone}{c.relationship ? ` · ${c.relationship}` : ''}</Text>
          </View>
          <TouchableOpacity onPress={() => call(c.phone)} style={{ marginRight: 14 }}><Ionicons name="call" size={22} color={colors.ok} /></TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={() => del(c)}><Ionicons name="trash" size={22} color={colors.red} /></TouchableOpacity>
        </Card>
      ))}
      <Text style={[x.h2, { marginTop: 20 }]}>Tambah kontak</Text>
      <Field label="Nama" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Nomor telepon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Hubungan (opsional)" value={rel} onChangeText={setRel} autoCapitalize="words" />
      <Btn t={busy ? 'Menyimpan...' : 'Simpan Kontak'} onPress={add} disabled={busy} style={{ marginTop: 16 }} />
    </Screen>
  );
}

// ---------------------------------------------------------------- Darurat (SOS)
const TYPES = [['sos', 'Darurat umum'], ['lost', 'Tersesat'], ['injury', 'Cedera'], ['weather', 'Cuaca buruk']];
const TYPE_LABEL = Object.fromEntries(TYPES);

export function Emergency({ navigation }) {
  const { colors } = useTheme();
  const x = useX();
  const { triggerSOS, resolveEmergency, user } = useApp();
  const [phase, setPhase] = useState('countdown'); // countdown | sending | sent
  const [sec, setSec] = useState(5);
  const [type, setType] = useState('sos');
  const [message, setMessage] = useState('');
  const [event, setEvent] = useState(null);
  const contact = user && user.primaryContact();

  const send = async () => {
    setPhase('sending');
    const ev = await triggerSOS({ type, message });
    setEvent(ev);
    setPhase('sent');
  };

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    if (sec <= 0) { send(); return undefined; }
    const h = setTimeout(() => setSec((s) => s - 1), 1000);
    return () => clearTimeout(h);
  }, [phase, sec]);

  if (phase !== 'sent') {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <View style={x.sosCircle}>{phase === 'sending' ? <ActivityIndicator color={colors.onAccent} size="large" /> : <Text style={x.sosNum}>{sec}</Text>}</View>
          <Text style={[x.h2, { marginTop: 14 }]}>{phase === 'sending' ? 'Mencatat lokasi dan SOS...' : 'SOS dicatat dalam beberapa detik'}</Text>
          <Text style={x.mute}>Tekan Batal jika tertekan tidak sengaja.</Text>
        </View>
        <View style={[x.wrap, { marginTop: 20 }]}>{TYPES.map(([k, l]) => <Chip key={k} t={l} on={k === type} onPress={() => setType(k)} />)}</View>
        <Field label="Pesan (opsional)" value={message} onChangeText={setMessage} multiline style={[x.input, { height: 70, textAlignVertical: 'top' }]} />
        <Btn t="Batal" color={colors.neutral} onPress={() => navigation.goBack()} disabled={phase === 'sending'} style={{ marginTop: 16 }} />
        <Btn t="Kirim sekarang" color={colors.red} onPress={send} disabled={phase === 'sending'} style={{ marginTop: 10 }} />
      </Screen>
    );
  }

  const loc = event.location;
  return (
    <Screen>
      <Card style={{ borderColor: colors.red, borderWidth: 1 }}>
        <Text style={[x.h2, { color: colors.red }]}>SOS tercatat · {TYPE_LABEL[event.type]}</Text>
        <Text style={x.mute}>{fmtDateTime(event.triggeredAt)}</Text>
        <Text style={[x.b, { marginTop: 8 }]}>Lokasi: {loc.toString()}</Text>
        {!loc.isAvailable() && <Text style={{ color: colors.warn, marginTop: 4 }}>Posisi tidak diketahui. Sebutkan perkiraan lokasimu saat menghubungi.</Text>}
        {event.message ? <Text style={[x.mute, { marginTop: 6 }]}>Pesan: {event.message}</Text> : null}
      </Card>

      <Card>
        {event.sent
          ? <Text style={{ color: colors.ok }}>SOS tersimpan di server (lokasi dan waktu). Pesan otomatis ke kontak belum tersedia, hubungi langsung lewat tombol di bawah.</Text>
          : <Text style={{ color: colors.warn }}>SOS belum terkirim ke server ({event.sendError}). Hubungi langsung lewat tombol di bawah.</Text>}
      </Card>

      {contact ? <Btn t={`Telepon ${contact.name}`} color={colors.ok} onPress={() => call(contact.phone)} style={{ marginTop: 12 }} />
        : <Text style={[x.mute, { marginTop: 12 }]}>Belum ada kontak darurat.</Text>}
      <Btn t="Telepon Basarnas 115" color={colors.red} onPress={() => call('115')} style={{ marginTop: 10 }} />
      <Btn t="Situasi sudah aman" color={colors.neutral} style={{ marginTop: 10 }} onPress={async () => { await resolveEmergency(event, 'resolved'); navigation.goBack(); }} />
    </Screen>
  );
}

// ---------------------------------------------------------------- Status Sistem
const CATS = ['Login', 'Lokasi', 'Peta', 'Data gunung', 'Lainnya'];

export function SystemStatus() {
  const { colors } = useTheme();
  const x = useX();
  const { user, activeTrip, issues, addIssue, testServer, apiUrl } = useApp();
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cat, setCat] = useState(CATS[1]);
  const [desc, setDesc] = useState('');

  const run = async () => {
    setBusy(true);
    const server = testServer().then((d) => ({ ok: d.database === 'ok', detail: d.database === 'ok' ? apiUrl : 'Server hidup, database bermasalah' }))
      .catch((e) => ({ ok: false, detail: e.message }));
    const [d, net, srv] = await Promise.all([diagnoseLocation(), checkNetwork(), server]);
    setRes({ ...d, net, srv });
    setBusy(false);
  };
  useEffect(() => { run(); }, []);

  const grant = async () => { await requestPermission(); run(); };
  const save = async () => {
    setSaving(true);
    try { await addIssue({ category: cat, description: desc }); setDesc(''); } catch (e) { Alert.alert('Belum bisa disimpan', e.message); } finally { setSaving(false); }
  };
  const hasContact = !!(user && user.hasEmergencyContact());

  const rows = res ? [
    ['Server backend', res.srv.ok, res.srv.detail],
    ['Izin lokasi', res.permission === 'granted', res.permission === 'granted' ? 'Diizinkan' : 'Belum diizinkan'],
    ['GPS perangkat', res.servicesEnabled, res.servicesEnabled ? 'Aktif' : 'Mati'],
    ['Posisi saat ini', res.position.isAvailable(), res.position.toString()],
    ['Jaringan internet', res.net, res.net ? 'Terhubung' : 'Tidak ada koneksi'],
    ['Kontak darurat', hasContact, hasContact ? `${user.emergencyContacts.length} kontak` : 'Belum ada'],
  ] : [];

  return (
    <Screen>
      <Text style={x.mute}>Cek kesiapan perangkat sebelum dan selama mendaki.</Text>
      {busy && !res && <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />}
      {rows.map(([label, ok, detail]) => (
        <Card key={label} style={x.contact}>
          <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={24} color={ok ? colors.ok : colors.warn} />
          <View style={{ marginLeft: 12, flex: 1 }}><Text style={x.b}>{label}</Text><Text style={x.mute}>{detail}</Text></View>
        </Card>
      ))}
      {res && res.permission !== 'granted' && <Btn t="Izinkan Akses Lokasi" onPress={grant} style={{ marginTop: 10 }} />}
      <Btn t={busy ? 'Memeriksa...' : 'Jalankan Ulang Cek'} onPress={run} disabled={busy} color={colors.neutral} style={{ marginTop: 10 }} />
      {activeTrip && (
        <Card style={{ marginTop: 14 }}>
          <Text style={x.b}>Pendakian aktif: {activeTrip.trailName}</Text>
          <Text style={x.mute}>{activeTrip.locations.length} titik tercatat, {activeTrip.unavailableCount()} tidak tersedia</Text>
        </Card>
      )}

      <Text style={[x.h2, { marginTop: 24 }]}>Laporkan kendala</Text>
      <View style={[x.wrap, { marginTop: 8 }]}>{CATS.map((c) => <Chip key={c} t={c} on={c === cat} onPress={() => setCat(c)} />)}</View>
      <Field label="Deskripsi" value={desc} onChangeText={setDesc} multiline style={[x.input, { height: 80, textAlignVertical: 'top' }]} />
      <Btn t={saving ? 'Menyimpan...' : 'Simpan Laporan'} onPress={save} disabled={saving} style={{ marginTop: 12 }} />
      {issues.length === 0 && <Empty text="Belum ada laporan." icon="chatbox-ellipses-outline" />}
      {issues.map((i) => (
        <Card key={i.id}>
          <Text style={x.b}>{i.category} · {i.status}</Text>
          <Text style={x.mute}>{fmtDateTime(i.createdAt)}</Text>
          <Text style={{ color: colors.text, marginTop: 4 }}>{i.description}</Text>
        </Card>
      ))}
    </Screen>
  );
}

export const useX = makeStyles((c) => ({
  card: { backgroundColor: c.card, borderRadius: 10, padding: 12, marginTop: 12 },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center' },
  btnT: { color: c.onAccent, fontWeight: '700' },
  input: { backgroundColor: c.card, color: c.text, borderRadius: 8, padding: 12, marginTop: 4 },
  chip: { backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contact: { flexDirection: 'row', alignItems: 'center' },
  h2: { color: c.text, fontWeight: '700', fontSize: 16 },
  b: { color: c.text, fontWeight: '600' },
  mute: { color: c.mute, fontSize: 12 },
  sosCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: c.red, alignItems: 'center', justifyContent: 'center' },
  sosNum: { color: c.onAccent, fontSize: 52, fontWeight: '800' },
}));
