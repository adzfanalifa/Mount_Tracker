import { Location, HikingTrip, Mountain, EmergencyContact, User } from './models';
import { validateLogin, validateRegister, validateReset } from './validation';
import { fetchMountains, parseMountains } from './dataSync';

// Uji fungsional yang bisa dijalankan langsung dari aplikasi (halaman Status Pengujian).
// Tiap kasus mengembalikan true jika perilaku sesuai harapan.

const mt = new Mountain({ id: 'uji', name: 'Uji', elevationMdpl: 3000, difficulty: 'easy', trails: ['Jalur Uji'] });
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const tomorrow = () => { const d = today(); d.setDate(d.getDate() + 1); return d; };
const trip = (o = {}) => new HikingTrip({ id: 'x', mountain: mt, trailName: 'Jalur Uji', startDate: tomorrow(), ...o });
const throws = (fn) => { try { fn(); return false; } catch (e) { return true; } };
const rejects = async (p, msg) => { try { await p; return false; } catch (e) { return !msg || e.message.includes(msg); } };
const fakeRes = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === 'function' ? body() : body) });

export const TEST_GROUPS = ['Validasi rute/lokasi', 'Input', 'Akses pengguna', 'Kegagalan jaringan'];

export const CASES = [
  // --- rute & lokasi
  ['Validasi rute/lokasi', 'Koordinat GPS valid diterima', () => new Location({ latitude: -8.41, longitude: 116.45 }).isAvailable()],
  ['Validasi rute/lokasi', 'Latitude di luar ±90 ditolak', () => throws(() => new Location({ latitude: 95, longitude: 0 }))],
  ['Validasi rute/lokasi', 'Longitude di luar ±180 ditolak', () => throws(() => new Location({ latitude: 0, longitude: 190 }))],
  ['Validasi rute/lokasi', 'Lokasi tidak tersedia ditangani tanpa crash', () => Location.unavailable().toString() === 'Lokasi tidak tersedia'],
  ['Validasi rute/lokasi', 'Lokasi terakhir dipakai saat GPS hilang', () => {
    const t = trip(); t.start(); const a = new Location({ latitude: 1, longitude: 1 });
    t.addLocation(a); t.addLocation(Location.unavailable());
    return t.lastKnownLocation() === a && t.unavailableCount() === 1;
  }],
  ['Validasi rute/lokasi', 'Jalur wajib dipilih', () => throws(() => trip({ trailName: '' }))],
  ['Validasi rute/lokasi', 'Data gunung tanpa jalur ditolak', () => throws(() => parseMountains([{ id: 1, name: 'A', elevationMdpl: 1000, difficulty: 'easy', trails: [] }]))],
  // --- input
  ['Input', 'Jumlah orang 0 ditolak', () => throws(() => trip({ groupSize: 0 }))],
  ['Input', 'Lama pendakian > 14 hari ditolak', () => throws(() => trip({ plannedDays: 15 }))],
  ['Input', 'Tanggal berangkat masa lalu ditolak', () => { const d = today(); d.setDate(d.getDate() - 1); return throws(() => trip({ startDate: d })); }],
  ['Input', 'Nomor telepon huruf ditolak', () => !new EmergencyContact({ id: 'c', name: 'A', phone: 'abc' }).isValid()],
  ['Input', 'Nomor telepon dinormalisasi', () => new EmergencyContact({ id: 'c', name: 'A', phone: '0812-3456 7890' }).phone === '081234567890'],
  // --- akses pengguna
  ['Akses pengguna', 'Login kosong ditolak', () => validateLogin({ identity: '', password: '' }) !== null],
  ['Akses pengguna', 'Login valid diterima', () => validateLogin({ identity: 'pendaki', password: 'rahasia' }) === null],
  ['Akses pengguna', 'Email tidak valid ditolak saat daftar', () => validateRegister({ username: 'pendaki', email: 'salah@', password: 'rahasia', confirmPassword: 'rahasia' }) !== null],
  ['Akses pengguna', 'Password pendek ditolak', () => validateRegister({ username: 'pendaki', email: 'a@b.co', password: '123', confirmPassword: '123' }) !== null],
  ['Akses pengguna', 'Konfirmasi password berbeda ditolak', () => validateReset({ password: 'rahasia1', confirmPassword: 'rahasia2' }) !== null],
  ['Akses pengguna', 'Hanya satu kontak darurat utama', () => {
    const u = new User({ id: 'u', username: 'x' });
    u.addContact(new EmergencyContact({ id: 'a', name: 'A', phone: '081234567890' }));
    u.addContact(new EmergencyContact({ id: 'b', name: 'B', phone: '081234567891', isPrimary: true }));
    return u.emergencyContacts.filter((c) => c.isPrimary).length === 1;
  }],
  // --- kegagalan jaringan
  ['Kegagalan jaringan', 'Server tidak terjangkau memberi pesan jelas', () => rejects(fetchMountains('http://uji.local', { fetchImpl: async () => { throw new TypeError('Network request failed'); } }), 'terhubung')],
  ['Kegagalan jaringan', 'Server error 500 ditangani', () => rejects(fetchMountains('http://uji.local', { fetchImpl: fakeRes(500, []) }), '500')],
  ['Kegagalan jaringan', 'Balasan bukan JSON ditangani', () => rejects(fetchMountains('http://uji.local', { fetchImpl: fakeRes(200, () => { throw new SyntaxError('x'); }) }), 'JSON')],
  ['Kegagalan jaringan', 'Data rusak dari server tidak dipakai', () => rejects(fetchMountains('http://uji.local', { fetchImpl: fakeRes(200, [{ id: 1, name: '' }]) }))],
  ['Kegagalan jaringan', 'Alamat server salah ditolak', () => rejects(fetchMountains('server-saya', { fetchImpl: fakeRes(200, []) }), 'http')],
];

export async function runSelfTests(cases = CASES) {
  const results = [];
  for (const [group, name, fn] of cases) {
    const t0 = Date.now();
    let pass = false;
    let error = null;
    try { pass = (await fn()) === true; } catch (e) { error = e.message; }
    results.push({ group, name, pass, error, ms: Date.now() - t0 });
  }
  return results;
}

export function summarize(results) {
  const passed = results.filter((r) => r.pass).length;
  return { total: results.length, passed, failed: results.length - passed };
}