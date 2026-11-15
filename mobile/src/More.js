import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './theme';
import { useApp } from './store';
import { DIFFICULTY } from './data';
import { runSelfTests, summarize, TEST_GROUPS } from './selftest';
import { diagnoseLocation, checkNetwork } from './location';
import { Screen, Card, Btn, Field, fmtDateTime, useX } from './Extra';

// ------------------------------------------------------------- Panduan Pengguna
// Bagian terakhir (adminOnly) hanya tampil untuk admin.
const GUIDE = [
  ['person-add', 'Daftar & masuk', [
    'Buat akun di halaman Sign Up: username 3-30 karakter, email valid, password minimal 6 karakter.',
    'Masuk memakai email atau username dan password.',
  ]],
  ['call', 'Siapkan kontak darurat', [
    'Buka Home → Kontak, isi nama dan nomor telepon (8-15 angka).',
    'Kontak bertanda bintang adalah kontak utama yang dipakai saat SOS. Ketuk bintang untuk menggantinya.',
    'Rencana pendakian tidak bisa dibuat sebelum ada minimal satu kontak darurat.',
  ]],
  ['create', 'Buat rencana pendakian', [
    'Dari tab Mount pilih "Tambahkan Pendakian", atau dari Home tekan "Buat Rencana Pendakian".',
    'Pilih gunung dan jalur, isi tanggal berangkat (TAHUN-BULAN-TANGGAL), jumlah orang, lama hari, dan jam perkiraan turun.',
    'Setelah disimpan statusnya "Direncanakan".',
  ]],
  ['walk', 'Mulai & akhiri pendakian', [
    'Tekan "Mulai Pendakian" di Home saat berangkat. Izinkan akses lokasi agar posisi tercatat setiap 30 detik.',
    'Dashboard menampilkan durasi, sisa waktu sampai estimasi turun, dan lokasi terakhir.',
    'Jika melewati estimasi turun, muncul peringatan kuning. Tekan "Akhiri Pendakian" setelah sampai di basecamp.',
  ]],
  ['warning', 'Kondisi darurat (SOS)', [
    'Tekan tombol SOS merah di Home. SOS tercatat otomatis setelah hitung mundur 5 detik; tekan Batal jika tidak sengaja.',
    'Pilih jenis kejadian (tersesat, cedera, cuaca buruk) dan tulis pesan singkat bila sempat.',
    'Jika GPS tidak tersedia, aplikasi memakai lokasi terakhir yang tercatat. Segera telepon kontak utama atau Basarnas 115.',
  ]],
  ['location', 'Jika lokasi tidak tersedia', [
    'Buka Home → Status untuk mengecek izin lokasi, GPS, dan jaringan.',
    'Pendakian tetap berjalan walau GPS mati; titik yang gagal dicatat sebagai "tidak tersedia".',
    'Di area tanpa sinyal, GPS tetap bisa bekerja tetapi peta dan pembaruan data membutuhkan internet.',
  ]],
  ['time', 'Riwayat perjalanan', [
    'Pendakian yang selesai atau dibatalkan masuk ke Home → Riwayat.',
    'Ketuk sebuah riwayat untuk melihat waktu mulai/selesai dan semua titik lokasi.',
  ]],
  ['cloud-download', 'Pembaruan data gunung (admin)', [
    'Khusus admin. Buka Home → Data. Isi alamat server (contoh http://192.168.1.5:8000) lalu tekan "Perbarui dari Server".',
    'Data baru hanya dipakai jika semuanya valid. Jika gagal, aplikasi tetap memakai data sebelumnya.',
  ]],
  ['bug', 'Melaporkan kendala', [
    'Buka Home → Status, pilih kategori, tulis deskripsi, lalu "Simpan Laporan".',
    'Sertakan langkah yang dilakukan dan pesan error yang muncul agar mudah ditelusuri.',
  ]],
];

const AdminOnly = () => { const { colors: C } = useTheme(); const x = useX(); return (
  <Screen>
    <View style={{ alignItems: 'center', marginTop: 40 }}>
      <Ionicons name="lock-closed" size={36} color={C.mute} />
      <Text style={[x.h2, { marginTop: 10 }]}>Khusus admin</Text>
      <Text style={[x.mute, { textAlign: 'center', marginTop: 4 }]}>Halaman ini hanya bisa dibuka oleh akun admin.</Text>
    </View>
  </Screen>
); };

export function Guide() {
  const { colors: C } = useTheme();
  const x = useX();
  const { user } = useApp();
  const items = GUIDE.filter(([, title]) => user.isAdmin || !title.includes('(admin)'));
  const [open, setOpen] = useState(0);
  return (
    <Screen>
      <Text style={x.mute}>Ketuk setiap bagian untuk melihat langkah-langkahnya.</Text>
      {items.map(([icon, title, steps], i) => (
        <TouchableOpacity key={title} activeOpacity={0.8} onPress={() => setOpen(open === i ? -1 : i)}>
          <Card>
            <View style={x.contact}>
              <Ionicons name={icon} size={20} color={C.accent} />
              <Text style={[x.h2, { flex: 1, marginLeft: 10 }]}>{i + 1}. {title}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={C.mute} />
            </View>
            {open === i && steps.map((st, j) => (
              <View key={j} style={{ flexDirection: 'row', marginTop: 8 }}>
                <Text style={[x.b, { width: 18 }]}>{j + 1}.</Text>
                <Text style={{ color: C.text, flex: 1, lineHeight: 19 }}>{st}</Text>
              </View>
            ))}
          </Card>
        </TouchableOpacity>
      ))}
      <Card style={{ borderColor: C.warn, borderWidth: 1 }}>
        <Text style={[x.b, { color: C.warn }]}>Nomor penting</Text>
        <Text style={{ color: C.text, marginTop: 4 }}>Basarnas 115 · Ambulans 118/119 · Polisi 110</Text>
      </Card>
    </Screen>
  );
}

// ------------------------------------------------------------- Status Pengujian
export function TestStatus() {
  const { user } = useApp();
  if (!user.isAdmin) return <AdminOnly />;
  return <TestStatusInner />;
}
function TestStatusInner() {
  const { colors: C } = useTheme();
  const x = useX();
  const [results, setResults] = useState(null);
  const [env, setEnv] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ranAt, setRanAt] = useState(null);

  const run = async () => {
    setBusy(true);
    const [r, d, net] = await Promise.all([runSelfTests(), diagnoseLocation(), checkNetwork()]);
    setResults(r);
    setEnv({ ...d, net });
    setRanAt(new Date());
    setBusy(false);
  };
  useEffect(() => { run(); }, []);

  const sum = results ? summarize(results) : null;
  const envRows = env ? [
    ['Lokasi perangkat', env.position.isAvailable(), env.position.isAvailable() ? env.position.toString() : 'Tidak tersedia, aplikasi memakai lokasi terakhir / mode tanpa lokasi'],
    ['Jaringan', env.net, env.net ? 'Terhubung' : 'Offline, data lokal tetap bisa dipakai'],
  ] : [];

  return (
    <Screen>
      <Text style={x.mute}>Menjalankan uji fungsional langsung di perangkat: validasi rute/lokasi, input, akses pengguna, dan kegagalan jaringan.</Text>
      {sum && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {[['Total', sum.total, C.text], ['Lulus', sum.passed, C.ok], ['Gagal', sum.failed, sum.failed ? C.red : C.mute]].map(([a, b, col]) => (
            <Card key={a} style={{ flex: 1, alignItems: 'center', marginTop: 0 }}><Text style={x.mute}>{a}</Text><Text style={[x.h2, { color: col }]}>{b}</Text></Card>
          ))}
        </View>
      )}
      {ranAt && <Text style={[x.mute, { marginTop: 8 }]}>Terakhir dijalankan {fmtDateTime(ranAt)}</Text>}
      {busy && !results && <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />}

      {envRows.length > 0 && <Text style={[x.h2, { marginTop: 18 }]}>Kondisi perangkat saat uji</Text>}
      {envRows.map(([label, ok, detail]) => (
        <Card key={label} style={x.contact}>
          <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={22} color={ok ? C.ok : C.warn} />
          <View style={{ marginLeft: 12, flex: 1 }}><Text style={x.b}>{label}</Text><Text style={x.mute}>{detail}</Text></View>
        </Card>
      ))}

      {results && TEST_GROUPS.map((g) => {
        const rows = results.filter((r) => r.group === g);
        const pass = rows.filter((r) => r.pass).length;
        return (
          <Card key={g}>
            <View style={x.line}><Text style={x.h2}>{g}</Text><Text style={{ color: pass === rows.length ? C.ok : C.red, fontWeight: '700' }}>{pass}/{rows.length}</Text></View>
            {rows.map((r) => (
              <View key={r.name} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <Ionicons name={r.pass ? 'checkmark-circle' : 'close-circle'} size={18} color={r.pass ? C.ok : C.red} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ color: C.text }}>{r.name}</Text>
                  {r.error && <Text style={{ color: C.red, fontSize: 12 }}>{r.error}</Text>}
                </View>
              </View>
            ))}
          </Card>
        );
      })}
      <Btn t={busy ? 'Menjalankan...' : 'Jalankan Ulang Pengujian'} onPress={run} disabled={busy} style={{ marginTop: 16 }} />
    </Screen>
  );
}

// ------------------------------------------------------------- Pembaruan Data
const PROSEDUR = [
  'Pastikan HP terhubung internet (cek di Status).',
  'Isi alamat server backend, lalu simpan.',
  'Tekan "Perbarui dari Server". Aplikasi mengambil GET /mountains.',
  'Setiap gunung dicek: nama, ketinggian, tingkat kesulitan, dan minimal satu jalur.',
  'Jika semua valid, data baru dipakai. Jika ada yang gagal, data lama tetap dipakai dan kesalahan dicatat.',
  'Pendakian yang sudah direncanakan atau sedang berjalan tidak berubah.',
];

export function DataUpdate() {
  const { user } = useApp();
  if (!user.isAdmin) return <AdminOnly />;
  return <DataUpdateInner />;
}
function DataUpdateInner() {
  const { colors: C } = useTheme();
  const x = useX();
  const { mountains, apiUrl, setApiUrl, dataInfo, updateMountains, resetMountains, activeTrip } = useApp();
  const [url, setUrl] = useState(apiUrl);
  const [busy, setBusy] = useState(false);

  const saveUrl = () => {
    setApiUrl(url).then(() => Alert.alert('Tersimpan', 'Alamat server diperbarui.')).catch((e) => Alert.alert('Alamat tidak valid', e.message));
  };
  const update = async () => {
    if (url.trim() !== apiUrl) {
      Alert.alert('Simpan alamat dulu', 'Alamat server di kolom berbeda dengan yang tersimpan.');
      return;
    }
    setBusy(true);
    try {
      const n = await updateMountains();
      Alert.alert('Berhasil', `${n} data gunung diperbarui.`);
    } catch (e) {
      Alert.alert('Pembaruan gagal', `${e.message}\n\nAplikasi tetap memakai data sebelumnya.`);
    } finally {
      setBusy(false);
    }
  };
  const reset = () => Alert.alert('Kembalikan data bawaan?', 'Daftar gunung akan kembali ke data bawaan aplikasi.', [
    { text: 'Batal', style: 'cancel' }, { text: 'Kembalikan', onPress: resetMountains },
  ]);

  return (
    <Screen>
      <Card style={{ marginTop: 0 }}>
        <View style={x.line}><Text style={x.mute}>Sumber data</Text><Text style={x.b}>{dataInfo.source === 'server' ? 'Server' : 'Bawaan aplikasi'}</Text></View>
        <View style={[x.line, { marginTop: 6 }]}><Text style={x.mute}>Terakhir diperbarui</Text><Text style={x.b}>{dataInfo.updatedAt ? fmtDateTime(dataInfo.updatedAt) : '-'}</Text></View>
        <View style={[x.line, { marginTop: 6 }]}><Text style={x.mute}>Jumlah gunung</Text><Text style={x.b}>{mountains.length}</Text></View>
        {dataInfo.lastError && <Text style={{ color: C.warn, marginTop: 8 }}>Gagal terakhir: {dataInfo.lastError}</Text>}
      </Card>

      <Field label="Alamat server backend" value={url} onChangeText={setUrl} keyboardType="url" placeholder="http://192.168.1.5:8000" />
      <Btn t="Simpan Alamat" color={C.neutral} onPress={saveUrl} style={{ marginTop: 10 }} />
      <Btn t={busy ? 'Memperbarui...' : 'Perbarui dari Server'} onPress={update} disabled={busy} style={{ marginTop: 10 }} />
      {dataInfo.source === 'server' && <Btn t="Kembalikan Data Bawaan" color={C.neutral} onPress={reset} disabled={busy} style={{ marginTop: 10 }} />}
      {activeTrip && <Text style={[x.mute, { marginTop: 8 }]}>Ada pendakian aktif. Pembaruan data tidak mengubah pendakian tersebut.</Text>}

      <Text style={[x.h2, { marginTop: 20 }]}>Prosedur pembaruan data</Text>
      {PROSEDUR.map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', marginTop: 8 }}>
          <Text style={[x.b, { width: 20 }]}>{i + 1}.</Text><Text style={{ color: C.text, flex: 1, lineHeight: 19 }}>{p}</Text>
        </View>
      ))}

      <Text style={[x.h2, { marginTop: 20 }]}>Data gunung saat ini</Text>
      {mountains.map((m) => (
        <Card key={m.id}>
          <View style={x.line}>
            <Text style={x.b}>{m.name} · {m.elevationMdpl.toLocaleString('id-ID')} mdpl</Text>
            <Text style={{ color: (DIFFICULTY[m.difficulty] || {}).color || C.mute, fontSize: 12 }}>{(DIFFICULTY[m.difficulty] || {}).label || m.difficulty}</Text>
          </View>
          <Text style={x.mute}>{m.trails.join(' · ')}</Text>
        </Card>
      ))}

      {dataInfo.log.length > 0 && <Text style={[x.h2, { marginTop: 20 }]}>Log pembaruan</Text>}
      {dataInfo.log.map((l, i) => (
        <Text key={i} style={{ color: l.ok ? C.ok : C.warn, fontSize: 12, marginTop: 4 }}>{fmtDateTime(l.at)} · {l.msg}</Text>
      ))}
    </Screen>
  );
}