import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from './theme';
import { useApp } from './store';
import { MOUNTAINS } from './data';
import { dateUtil } from './models';
import { diagnoseLocation, checkNetwork, requestPermission } from './location';

// ------------------------------------------------------------ komponen kecil
const Screen = ({ children }) => (
  <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    {children}
  </ScrollView>
);
const Card = ({ children, style }) => <View style={[x.card, style]}>{children}</View>;
const Btn = ({ t, onPress, color = C.accent, style, disabled }) => (
  <TouchableOpacity disabled={disabled} onPress={onPress} style={[x.btn, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }, style]}>
    <Text style={x.btnT}>{t}</Text>
  </TouchableOpacity>
);
const Field = ({ label, ...props }) => (
  <View style={{ marginTop: 12 }}>
    <Text style={x.mute}>{label}</Text>
    <TextInput placeholderTextColor={C.mute} style={x.input} autoCapitalize="none" {...props} />
  </View>
);
const Chip = ({ t, on, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[x.chip, on && { backgroundColor: C.accent }]}>
    <Text style={x.b}>{t}</Text>
  </TouchableOpacity>
);
const Stepper = ({ label, value, setValue, min = 1, max = 99 }) => (
  <View style={[x.line, { marginTop: 12 }]}>
    <Text style={x.b}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity onPress={() => setValue(Math.max(min, value - 1))}><Ionicons name="remove-circle" size={28} color={C.accent} /></TouchableOpacity>
      <Text style={[x.b, { marginHorizontal: 14, minWidth: 20, textAlign: 'center' }]}>{value}</Text>
      <TouchableOpacity onPress={() => setValue(Math.min(max, value + 1))}><Ionicons name="add-circle" size={28} color={C.accent} /></TouchableOpacity>
    </View>
  </View>
);

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDateTime = (d) => `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDur = (min) => `${Math.floor(min / 60)} j ${pad(min % 60)} m`;
function parseDate(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s).trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}
const call = (phone) => Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Tidak bisa menelepon', `Hubungi manual: ${phone}`));

// ------------------------------------------------------------- Rencana Pendakian
export function PlanHike({ navigation, route }) {
  const { addTrip, user } = useApp();
  const [mId, setMId] = useState((route.params && route.params.mountainId) || MOUNTAINS[0].id);
  const mountain = MOUNTAINS.find((m) => m.id === mId);
  const [trail, setTrail] = useState(mountain.trails[0]);
  const [date, setDate] = useState(fmtDate(dateUtil.addDays(new Date(), 1)));
  const [people, setPeople] = useState(2);
  const [days, setDays] = useState(2);
  const [ret, setRet] = useState('16:00');
  const [notes, setNotes] = useState('');
  const contact = user.primaryContact();

  const pick = (m) => { setMId(m.id); setTrail(m.trails[0]); };

  const submit = () => {
    if (!contact) {
      Alert.alert('Kontak darurat belum ada', 'Tambahkan minimal satu kontak darurat sebelum membuat rencana pendakian.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Tambah Kontak', onPress: () => navigation.navigate('Contacts') },
      ]);
      return;
    }
    const start = parseDate(date);
    if (!start) return Alert.alert('Tanggal tidak valid', 'Gunakan format TAHUN-BULAN-TANGGAL, contoh 2026-12-24.');
    const t = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(ret.trim());
    if (!t) return Alert.alert('Jam tidak valid', 'Gunakan format JJ:MM, contoh 16:00.');
    try {
      const end = dateUtil.addDays(start, days - 1);
      end.setHours(+t[1], +t[2], 0, 0);
      addTrip({ mountain, trailName: trail, groupSize: people, plannedDays: days, startDate: start, expectedReturnAt: end, notes });
      Alert.alert('Rencana tersimpan', 'Status: Direncanakan. Tekan Mulai Pendakian di Home saat berangkat.', [{ text: 'OK', onPress: () => navigation.navigate('Main') }]);
    } catch (e) {
      Alert.alert('Data belum valid', e.message);
    }
    return undefined;
  };

  return (
    <Screen>
      <Text style={x.h2}>Gunung</Text>
      <View style={x.wrap}>{MOUNTAINS.map((m) => <Chip key={m.id} t={m.name} on={m.id === mId} onPress={() => pick(m)} />)}</View>
      <Text style={[x.h2, { marginTop: 14 }]}>Jalur</Text>
      <View style={x.wrap}>{mountain.trails.map((tr) => <Chip key={tr} t={tr} on={tr === trail} onPress={() => setTrail(tr)} />)}</View>

      <Field label="Tanggal berangkat (TAHUN-BULAN-TANGGAL)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      <Stepper label="Jumlah orang" value={people} setValue={setPeople} />
      <Stepper label="Lama pendakian (hari)" value={days} setValue={setDays} max={14} />
      <Field label="Perkiraan jam turun di hari terakhir (JJ:MM)" value={ret} onChangeText={setRet} keyboardType="numbers-and-punctuation" />
      <Field label="Catatan (opsional)" value={notes} onChangeText={setNotes} multiline style={[x.input, { height: 80, textAlignVertical: 'top' }]} />

      <Card style={{ marginTop: 16 }}>
        <Text style={x.mute}>Kontak darurat utama</Text>
        {contact ? <Text style={x.b}>{contact.name} · {contact.phone}</Text> : <Text style={{ color: C.warn }}>Belum ada kontak darurat</Text>}
        <TouchableOpacity onPress={() => navigation.navigate('Contacts')}><Text style={{ color: C.accent, marginTop: 6 }}>Kelola kontak darurat</Text></TouchableOpacity>
      </Card>
      <Btn t="Simpan Rencana" onPress={submit} style={{ marginTop: 16 }} />
    </Screen>
  );
}

// -------------------------------------------------------------- Kontak Darurat
export function Contacts() {
  const { user, addContact, removeContact, setPrimaryContact } = useApp();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rel, setRel] = useState('');

  const add = () => {
    try {
      addContact({ name, phone, relationship: rel });
      setName(''); setPhone(''); setRel('');
    } catch (e) {
      Alert.alert('Data belum valid', e.message);
    }
  };
  const del = (c) => Alert.alert('Hapus kontak?', c.name, [
    { text: 'Batal', style: 'cancel' },
    { text: 'Hapus', style: 'destructive', onPress: () => removeContact(c.id) },
  ]);

  return (
    <Screen>
      {user.emergencyContacts.length === 0 && <Text style={x.mute}>Belum ada kontak. Tambahkan minimal satu sebelum mendaki.</Text>}
      {user.emergencyContacts.map((c) => (
        <Card key={c.id} style={x.contact}>
          <TouchableOpacity onPress={() => setPrimaryContact(c.id)}>
            <Ionicons name={c.isPrimary ? 'star' : 'star-outline'} size={22} color={c.isPrimary ? C.warn : C.mute} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={x.b}>{c.name}{c.isPrimary ? ' (utama)' : ''}</Text>
            <Text style={x.mute}>{c.phone}{c.relationship ? ` · ${c.relationship}` : ''}</Text>
          </View>
          <TouchableOpacity onPress={() => call(c.phone)} style={{ marginRight: 14 }}><Ionicons name="call" size={22} color={C.ok} /></TouchableOpacity>
          <TouchableOpacity onPress={() => del(c)}><Ionicons name="trash" size={22} color={C.red} /></TouchableOpacity>
        </Card>
      ))}
      <Text style={[x.h2, { marginTop: 20 }]}>Tambah kontak</Text>
      <Field label="Nama" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Nomor telepon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Hubungan (opsional)" value={rel} onChangeText={setRel} autoCapitalize="words" />
      <Btn t="Simpan Kontak" onPress={add} style={{ marginTop: 16 }} />
    </Screen>
  );
}

// ---------------------------------------------------------------- Darurat (SOS)
const TYPES = [['sos', 'Darurat umum'], ['lost', 'Tersesat'], ['injury', 'Cedera'], ['weather', 'Cuaca buruk']];
const TYPE_LABEL = Object.fromEntries(TYPES);

export function Emergency({ navigation }) {
  const { triggerSOS, resolveEmergency, user } = useApp();
  const [phase, setPhase] = useState('countdown'); // countdown | sending | sent
  const [sec, setSec] = useState(5);
  const [type, setType] = useState('sos');
  const [message, setMessage] = useState('');
  const [event, setEvent] = useState(null);
  const contact = user.primaryContact();

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
          <View style={x.sosCircle}>{phase === 'sending' ? <ActivityIndicator color="#fff" size="large" /> : <Text style={x.sosNum}>{sec}</Text>}</View>
          <Text style={[x.h2, { marginTop: 14 }]}>{phase === 'sending' ? 'Mencatat lokasi dan SOS...' : 'SOS dicatat dalam beberapa detik'}</Text>
          <Text style={x.mute}>Tekan Batal jika tertekan tidak sengaja.</Text>
        </View>
        <View style={[x.wrap, { marginTop: 20 }]}>{TYPES.map(([k, l]) => <Chip key={k} t={l} on={k === type} onPress={() => setType(k)} />)}</View>
        <Field label="Pesan (opsional)" value={message} onChangeText={setMessage} multiline style={[x.input, { height: 70, textAlignVertical: 'top' }]} />
        <Btn t="Batal" color="#555" onPress={() => navigation.goBack()} disabled={phase === 'sending'} style={{ marginTop: 16 }} />
        <Btn t="Kirim sekarang" color={C.red} onPress={send} disabled={phase === 'sending'} style={{ marginTop: 10 }} />
      </Screen>
    );
  }

  const loc = event.location;
  return (
    <Screen>
      <Card style={{ borderColor: C.red, borderWidth: 1 }}>
        <Text style={[x.h2, { color: C.red }]}>SOS tercatat · {TYPE_LABEL[event.type]}</Text>
        <Text style={x.mute}>{fmtDateTime(event.triggeredAt)}</Text>
        <Text style={[x.b, { marginTop: 8 }]}>Lokasi: {loc.toString()}</Text>
        {!loc.isAvailable() && <Text style={{ color: C.warn, marginTop: 4 }}>Posisi tidak diketahui. Sebutkan perkiraan lokasimu saat menghubungi.</Text>}
        {event.message ? <Text style={[x.mute, { marginTop: 6 }]}>Pesan: {event.message}</Text> : null}
      </Card>

      <Card>
        <Text style={{ color: C.warn }}>
          Pesan belum terkirim otomatis ke kontak (belum terhubung ke server). Hubungi langsung lewat tombol di bawah.
        </Text>
      </Card>

      {contact ? <Btn t={`Telepon ${contact.name}`} color={C.ok} onPress={() => call(contact.phone)} style={{ marginTop: 12 }} />
        : <Text style={[x.mute, { marginTop: 12 }]}>Belum ada kontak darurat.</Text>}
      <Btn t="Telepon Basarnas 115" color={C.red} onPress={() => call('115')} style={{ marginTop: 10 }} />
      <Btn t="Situasi sudah aman" color="#555" style={{ marginTop: 10 }} onPress={() => { resolveEmergency(event, 'resolved'); navigation.goBack(); }} />
    </Screen>
  );
}

// ------------------------------------------------------------ Riwayat Perjalanan
const STATUS_LABEL = { planned: 'Direncanakan', active: 'Aktif', finished: 'Selesai', cancelled: 'Dibatalkan' };

export function History() {
  const { trips } = useApp();
  const done = trips.filter((t) => t.status === 'finished' || t.status === 'cancelled');
  return (
    <Screen>
      {done.length === 0 && <Text style={x.mute}>Belum ada pendakian yang selesai.</Text>}
      {done.map((t) => (
        <Card key={t.id}>
          <View style={x.line}><Text style={x.h2}>{t.trailName}</Text><Text style={{ color: t.status === 'finished' ? C.ok : C.mute }}>{STATUS_LABEL[t.status]}</Text></View>
          <Text style={x.mute}>{fmtDate(t.startDate)} · {t.groupSize} orang · {t.plannedDays} hari</Text>
          <Text style={[x.b, { marginTop: 6 }]}>Durasi: {fmtDur(t.durationMinutes())}</Text>
          <Text style={x.mute}>{t.locations.length} titik lokasi tercatat ({t.unavailableCount()} tidak tersedia)</Text>
        </Card>
      ))}
    </Screen>
  );
}

// ---------------------------------------------------------------- Status Sistem
const CATS = ['Login', 'Lokasi', 'Peta', 'Data gunung', 'Lainnya'];

export function SystemStatus() {
  const { user, activeTrip, issues, addIssue } = useApp();
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState(CATS[1]);
  const [desc, setDesc] = useState('');

  const run = async () => {
    setBusy(true);
    const [d, net] = await Promise.all([diagnoseLocation(), checkNetwork()]);
    setRes({ ...d, net });
    setBusy(false);
  };
  useEffect(() => { run(); }, []);

  const grant = async () => { await requestPermission(); run(); };
  const save = () => {
    try { addIssue({ category: cat, description: desc }); setDesc(''); } catch (e) { Alert.alert('Belum bisa disimpan', e.message); }
  };

  const rows = res ? [
    ['Izin lokasi', res.permission === 'granted', res.permission === 'granted' ? 'Diizinkan' : 'Belum diizinkan'],
    ['GPS perangkat', res.servicesEnabled, res.servicesEnabled ? 'Aktif' : 'Mati'],
    ['Posisi saat ini', res.position.isAvailable(), res.position.toString()],
    ['Jaringan internet', res.net, res.net ? 'Terhubung' : 'Tidak ada koneksi'],
    ['Kontak darurat', user.hasEmergencyContact(), user.hasEmergencyContact() ? `${user.emergencyContacts.length} kontak` : 'Belum ada'],
  ] : [];

  return (
    <Screen>
      <Text style={x.mute}>Cek kesiapan perangkat sebelum dan selama mendaki.</Text>
      {busy && !res && <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />}
      {rows.map(([label, ok, detail]) => (
        <Card key={label} style={x.contact}>
          <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={24} color={ok ? C.ok : C.warn} />
          <View style={{ marginLeft: 12, flex: 1 }}><Text style={x.b}>{label}</Text><Text style={x.mute}>{detail}</Text></View>
        </Card>
      ))}
      {res && res.permission !== 'granted' && <Btn t="Izinkan Akses Lokasi" onPress={grant} style={{ marginTop: 10 }} />}
      <Btn t={busy ? 'Memeriksa...' : 'Jalankan Ulang Cek'} onPress={run} disabled={busy} color="#555" style={{ marginTop: 10 }} />
      {activeTrip && (
        <Card style={{ marginTop: 14 }}>
          <Text style={x.b}>Pendakian aktif: {activeTrip.trailName}</Text>
          <Text style={x.mute}>{activeTrip.locations.length} titik tercatat, {activeTrip.unavailableCount()} tidak tersedia</Text>
        </Card>
      )}

      <Text style={[x.h2, { marginTop: 24 }]}>Laporkan kendala</Text>
      <View style={[x.wrap, { marginTop: 8 }]}>{CATS.map((c) => <Chip key={c} t={c} on={c === cat} onPress={() => setCat(c)} />)}</View>
      <Field label="Deskripsi" value={desc} onChangeText={setDesc} multiline style={[x.input, { height: 80, textAlignVertical: 'top' }]} />
      <Btn t="Simpan Laporan" onPress={save} style={{ marginTop: 12 }} />
      {issues.map((i) => (
        <Card key={i.id}>
          <Text style={x.b}>{i.category} · {i.status}</Text>
          <Text style={x.mute}>{fmtDateTime(i.createdAt)}</Text>
          <Text style={{ color: '#fff', marginTop: 4 }}>{i.description}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const x = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 10, padding: 12, marginTop: 12 },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center' },
  btnT: { color: '#fff', fontWeight: '700' },
  input: { backgroundColor: C.card, color: '#fff', borderRadius: 8, padding: 12, marginTop: 4 },
  chip: { backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contact: { flexDirection: 'row', alignItems: 'center' },
  h2: { color: '#fff', fontWeight: '700', fontSize: 16 },
  b: { color: '#fff', fontWeight: '600' },
  mute: { color: C.mute, fontSize: 12 },
  sosCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  sosNum: { color: '#fff', fontSize: 52, fontWeight: '800' },
});
