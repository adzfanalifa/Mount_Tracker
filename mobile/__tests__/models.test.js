import { User, EmergencyContact, Mountain, HikingTrip, Location, EmergencyEvent } from '../src/models';

const mt = new Mountain({ id: 'm', name: 'Rinjani', elevationMdpl: 3726, difficulty: 'easy', trails: ['Rinjani via Sembalun'] });
const NOW = new Date(2026, 11, 1, 8, 0);
const mk = (o = {}) => new HikingTrip({ id: 't', mountain: mt, trailName: 'Rinjani via Sembalun', groupSize: 2, plannedDays: 2, startDate: new Date(2026, 11, 2), now: NOW, ...o });
const loc = (lat = -8.4, lng = 116.4) => new Location({ latitude: lat, longitude: lng });

describe('Location', () => {
  test('koordinat valid', () => expect(loc().isAvailable()).toBe(true));
  test('latitude di luar rentang ditolak', () => expect(() => loc(200, 10)).toThrow('Latitude'));
  test('longitude di luar rentang ditolak', () => expect(() => loc(10, 200)).toThrow('Longitude'));
  test('unavailable() tidak punya koordinat', () => {
    const l = Location.unavailable();
    expect(l.isAvailable()).toBe(false);
    expect(l.latitude).toBeNull();
    expect(l.toString()).toBe('Lokasi tidak tersedia');
  });
});

describe('EmergencyContact & User', () => {
  const c = (o = {}) => new EmergencyContact({ id: 'a', name: 'Ibu', phone: '0812-3456-7890', ...o });
  test('nomor dinormalisasi dan valid', () => { expect(c().phone).toBe('081234567890'); expect(c().isValid()).toBe(true); });
  test('nomor huruf ditolak', () => expect(c({ phone: 'abcd' }).isValid()).toBe(false));
  test('nama kosong ditolak', () => expect(c({ name: ' ' }).validate()).toMatch('Nama'));
  test('kontak pertama otomatis utama', () => {
    const u = new User({ id: 'u', username: 'x' });
    u.addContact(c());
    expect(u.primaryContact().id).toBe('a');
  });
  test('hanya satu kontak utama', () => {
    const u = new User({ id: 'u', username: 'x' });
    u.addContact(c());
    u.addContact(c({ id: 'b', isPrimary: true }));
    expect(u.emergencyContacts.filter((k) => k.isPrimary)).toHaveLength(1);
    expect(u.primaryContact().id).toBe('b');
  });
  test('hapus kontak utama memindahkan status', () => {
    const u = new User({ id: 'u', username: 'x' });
    u.addContact(c()); u.addContact(c({ id: 'b' }));
    u.removeContact('a');
    expect(u.primaryContact().id).toBe('b');
  });
  test('kontak tidak valid melempar error', () => {
    const u = new User({ id: 'u', username: 'x' });
    expect(() => u.addContact(c({ phone: '1' }))).toThrow();
    expect(u.hasEmergencyContact()).toBe(false);
  });
});

describe('HikingTrip validasi', () => {
  test('rencana valid, status planned', () => expect(mk().status).toBe('planned'));
  test('jumlah orang 0 ditolak', () => expect(() => mk({ groupSize: 0 })).toThrow('minimal 1'));
  test('lama 15 hari ditolak', () => expect(() => mk({ plannedDays: 15 })).toThrow('1-14'));
  test('tanggal kemarin ditolak', () => expect(() => mk({ startDate: new Date(2026, 10, 30) })).toThrow('masa lalu'));
  test('tanggal hari ini diterima', () => expect(() => mk({ startDate: new Date(2026, 11, 1) })).not.toThrow());
  test('tanpa gunung ditolak', () => expect(() => mk({ mountain: null })).toThrow('Gunung'));
  test('estimasi turun sebelum berangkat ditolak', () => expect(() => mk({ expectedReturnAt: new Date(2026, 11, 1) })).toThrow('setelah'));
});

describe('HikingTrip alur status', () => {
  test('planned -> active -> finished', () => {
    const t = mk(); t.start(NOW); expect(t.status).toBe('active'); t.finish(new Date(2026, 11, 2, 18, 0));
    expect(t.status).toBe('finished');
  });
  test('tidak bisa finish sebelum start', () => expect(() => mk().finish()).toThrow());
  test('tidak bisa start dua kali', () => { const t = mk(); t.start(); expect(() => t.start()).toThrow(); });
  test('cancel dari planned', () => { const t = mk(); t.cancel(); expect(t.status).toBe('cancelled'); });
  test('tidak bisa cancel setelah selesai', () => { const t = mk(); t.start(); t.finish(); expect(() => t.cancel()).toThrow(); });
  test('lokasi hanya saat aktif', () => expect(() => mk().addLocation(loc())).toThrow('aktif'));
  test('durasi dihitung dari start', () => {
    const t = mk(); t.start(new Date(2026, 11, 2, 8, 0));
    expect(t.durationMinutes(new Date(2026, 11, 2, 10, 30))).toBe(150);
  });
});

describe('HikingTrip lokasi dan terlambat', () => {
  test('lastKnownLocation melewati lokasi tidak tersedia', () => {
    const t = mk(); t.start();
    const a = loc(1, 1);
    t.addLocation(a); t.addLocation(Location.unavailable());
    expect(t.lastKnownLocation()).toBe(a);
    expect(t.unavailableCount()).toBe(1);
  });
  test('lastKnownLocation null jika belum ada', () => { const t = mk(); t.start(); t.addLocation(Location.unavailable()); expect(t.lastKnownLocation()).toBeNull(); });
  test('terlambat hanya saat aktif dan lewat batas', () => {
    const t = mk({ expectedReturnAt: new Date(2026, 11, 3, 16, 0) });
    expect(t.isOverdue(new Date(2026, 11, 3, 17, 0))).toBe(false); // belum aktif
    t.start();
    expect(t.isOverdue(new Date(2026, 11, 3, 15, 0))).toBe(false);
    expect(t.isOverdue(new Date(2026, 11, 3, 17, 0))).toBe(true);
  });
});

describe('EmergencyEvent', () => {
  test('tanpa lokasi memakai unavailable', () => expect(new EmergencyEvent({ id: 'e' }).location.isAvailable()).toBe(false));
  test('resolve sekali saja', () => {
    const e = new EmergencyEvent({ id: 'e' }); e.resolve();
    expect(e.status).toBe('resolved');
    expect(() => e.resolve()).toThrow();
  });
});
