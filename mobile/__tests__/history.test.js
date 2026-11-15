import { HikingTrip, Mountain, Location, haversineKm, User } from '../src/models';
import { makeSampleTrips } from '../src/sample';
import { MOUNTAINS } from '../src/data';

const mt = new Mountain({ id: 'm', name: 'Uji', elevationMdpl: 3000, trails: ['A'] });
const T0 = new Date(2026, 10, 11, 7, 0);
const at = (min) => new Date(T0.getTime() + min * 60000);
const L = (lat, lng, min, alt = null) => new Location({ latitude: lat, longitude: lng, altitudeM: alt, recordedAt: at(min) });

describe('statistik pendakian', () => {
  const trip = () => {
    const t = new HikingTrip({ id: 't', mountain: mt, trailName: 'A', startDate: T0, now: T0 });
    t.start(T0);
    t.addLocation(L(0, 0, 0, 1000));
    t.addLocation(L(0, 0.01, 10, 1100));   // ~1.11 km dalam 10 menit (bergerak)
    t.addLocation(L(0, 0.01, 30, 1090));   // diam 20 menit
    t.addLocation(Location.unavailable());
    t.addLocation(L(0, 0.02, 40, 1200));   // ~1.11 km dalam 10 menit
    t.finish(at(40));
    return t;
  };
  test('haversine 0.01° di ekuator ≈ 1.11 km', () => expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.01 })).toBeCloseTo(1.112, 2));
  test('jarak total mengabaikan titik tidak tersedia', () => expect(trip().distanceKm()).toBeCloseTo(2.224, 2));
  test('waktu bergerak & berhenti', () => { const t = trip(); expect(t.movingMinutes()).toBe(20); expect(t.stoppedMinutes()).toBe(20); });
  test('pace', () => expect(trip().paceMinPerKm()).toBeCloseTo(20 / 2.224, 1));
  test('kenaikan & ketinggian maks', () => { expect(trip().elevationGainM()).toBe(210); expect(trip().maxAltitudeM()).toBe(1200); });
  test('tanpa titik = 0', () => { const t = new HikingTrip({ id: 'x', mountain: mt, trailName: 'A', startDate: T0, now: T0 }); expect(t.distanceKm()).toBe(0); expect(t.paceMinPerKm()).toBe(0); });
});

describe('riwayat contoh & user', () => {
  test('data contoh valid', () => {
    const list = makeSampleTrips(MOUNTAINS, new Date(2026, 10, 15));
    expect(list.length).toBe(4);
    const done = list.filter((t) => t.status === 'finished');
    done.forEach((t) => { expect(t.trackPoints().length).toBeGreaterThan(10); expect(t.distanceKm()).toBeGreaterThan(1); expect(t.movingMinutes()).toBeGreaterThan(0); });
    expect(list.some((t) => t.status === 'cancelled')).toBe(true);
  });
  test('nama tampilan fallback ke username', () => {
    const u = new User({ id: 'u', username: 'rhadian' });
    expect(u.name).toBe('rhadian');
    u.displayName = 'Rhadian Maulana';
    expect(u.name).toBe('Rhadian Maulana');
  });
});