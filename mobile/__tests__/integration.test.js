import { createApi, ApiError, normalizeBaseUrl } from '../src/api';
import { simulateVitals, caloriesFrom, speedFromTrack, bestAltitude } from '../src/healthSim';
import { HikingTrip, Location, EmergencyEvent, locationFromApi } from '../src/models';
import { parseMountains } from '../src/dataSync';
import { PALETTES } from '../src/theme';

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('service API', () => {
  test('membuka amplop {success, message, data} dan mengirim token', async () => {
    const calls = [];
    const api = createApi({ baseUrl: 'http://x.local/', fetchImpl: async (url, opt) => { calls.push([url, opt]); return res(200, { success: true, message: 'OK', data: [1, 2] }); } });
    api.setToken('abc');
    expect(await api.trips({ status: 'finished' })).toEqual([1, 2]);
    expect(calls[0][0]).toBe('http://x.local/trips?status=finished');
    expect(calls[0][1].headers.Authorization).toBe('Bearer abc');
  });

  test('pesan error dari backend diteruskan (422)', async () => {
    const api = createApi({ baseUrl: 'http://x.local', fetchImpl: async () => res(422, { success: false, message: 'Email tidak valid', data: null, errors: { email: 'Email tidak valid' } }) });
    await expect(api.register({})).rejects.toMatchObject({ message: 'Email tidak valid', status: 422, errors: { email: 'Email tidak valid' } });
  });

  test('401 dengan token memanggil onUnauthorized', async () => {
    const api = createApi({ baseUrl: 'http://x.local', fetchImpl: async () => res(401, { success: false, message: 'Token tidak valid', data: null }) });
    const fn = jest.fn();
    api.setToken('t');
    api.setOnUnauthorized(fn);
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('gagal jaringan memberi pesan jelas', async () => {
    const api = createApi({ baseUrl: 'http://x.local', fetchImpl: async () => { throw new TypeError('Network request failed'); } });
    await expect(api.status()).rejects.toMatchObject({ network: true });
  });

  test('alamat server divalidasi', () => {
    expect(normalizeBaseUrl('http://192.168.1.5:8000/')).toBe('http://192.168.1.5:8000');
    expect(() => normalizeBaseUrl('localhost:8000')).toThrow();
  });
});

describe('data kesehatan otomatis', () => {
  const fixed = () => 0.5; // tanpa noise
  test('SpO2 turun di ketinggian, detak naik saat bergerak', () => {
    const low = simulateVitals({ altitudeM: 500, movingKmh: 0, rng: fixed });
    const high = simulateVitals({ altitudeM: 3700, movingKmh: 3, rng: fixed });
    expect(low.spo2).toBeGreaterThanOrEqual(97);
    expect(high.spo2).toBeLessThan(low.spo2);
    expect(high.spo2).toBeLessThan(92);
    expect(high.bpm).toBeGreaterThan(low.bpm);
  });
  test('nilai selalu dalam batas wajar', () => {
    for (let i = 0; i < 50; i++) {
      const v = simulateVitals({ altitudeM: Math.random() * 6000, movingKmh: Math.random() * 10 });
      expect(v.spo2).toBeGreaterThanOrEqual(75); expect(v.spo2).toBeLessThanOrEqual(100);
      expect(v.bpm).toBeGreaterThanOrEqual(55); expect(v.bpm).toBeLessThanOrEqual(185);
      expect(v.temperatureC).toBeGreaterThanOrEqual(35.5); expect(v.temperatureC).toBeLessThanOrEqual(38.5);
    }
  });
  test('kalori dari langkah dan tanjakan', () => {
    expect(caloriesFrom({ steps: 10000, elevationGainM: 0 })).toBe(450);
    expect(caloriesFrom({ steps: 0, elevationGainM: 1000 })).toBe(600);
  });
  test('kecepatan dari dua titik GPS', () => {
    const t0 = new Date(2026, 0, 1, 8, 0);
    const a = new Location({ latitude: 0, longitude: 0, recordedAt: t0 });
    const b = new Location({ latitude: 0.009, longitude: 0, recordedAt: new Date(t0.getTime() + 15 * 60000) });
    expect(speedFromTrack([a, b])).toBeCloseTo(4, 0);
  });
});

describe('konversi data backend', () => {
  const tripJson = {
    id: 7, mountainId: 1, mountainName: 'Rinjani', mountain: { id: 1, name: 'Rinjani', elevationMdpl: 3726, difficulty: 'easy', latitude: -8.41, longitude: 116.45 },
    trailId: 1, trailName: 'Rinjani via Sembalun', groupSize: 2, plannedDays: 2,
    startDate: '2026-01-01T00:00:00+07:00', expectedReturnAt: '2026-01-02T18:00:00+07:00', status: 'finished',
    startedAt: '2026-01-01T06:00:00+07:00', endedAt: '2026-01-02T15:00:00+07:00',
    locations: [
      { latitude: -8.37, longitude: 116.52, altitudeM: 1200, source: 'gps', recordedAt: '2026-01-01T06:00:00+07:00' },
      { latitude: null, longitude: null, source: 'unavailable', recordedAt: '2026-01-01T06:30:00+07:00' },
      { latitude: -8.38, longitude: 116.51, altitudeM: 1800, source: 'gps', recordedAt: '2026-01-01T08:00:00+07:00' },
    ],
    checkpoints: { checkpoints: [{ id: 1, name: 'Pos 1', elevationMdpl: 1156, arrivedAt: '2026-01-01T07:00:00+07:00' }, { id: 2, name: 'Pos 2', elevationMdpl: 1800, arrivedAt: null }] },
  };
  test('HikingTrip.fromApi menerima tanggal lampau dan menghitung statistik', () => {
    const t = HikingTrip.fromApi(tripJson);
    expect(t.id).toBe('7');
    expect(t.status).toBe('finished');
    expect(t.mountain.hasCoords()).toBe(true);
    expect(t.locations).toHaveLength(3);
    expect(t.unavailableCount()).toBe(1);
    expect(t.distanceKm()).toBeGreaterThan(1);
    expect(t.elevationGainM()).toBe(600);
    expect(t.durationMinutes()).toBe(33 * 60);
    expect(bestAltitude(t)).toBe(1800);
  });
  test('lokasi & SOS dari backend', () => {
    expect(locationFromApi({ source: 'unavailable' }).isAvailable()).toBe(false);
    const e = EmergencyEvent.fromApi({ id: 3, type: 'lost', message: '', status: 'resolved', tripId: null, location: { latitude: 1, longitude: 2, source: 'gps' }, triggeredAt: '2026-01-01T00:00:00Z', resolvedAt: '2026-01-01T01:00:00Z' });
    expect(e.status).toBe('resolved');
    expect(e.location.toString()).toBe('1.00000, 2.00000');
  });
  test('parseMountains menerima format baru backend', () => {
    const list = parseMountains({ success: true, message: 'OK', data: [{ id: 1, name: 'Rinjani', elevationMdpl: 3726, difficulty: 'easy', latitude: -8.4, longitude: 116.4, trails: ['A'], trailDetails: [{ id: 5, name: 'A', checkpointCount: 6 }] }] });
    expect(list[0].defaultTrail().id).toBe('5');
    expect(list[0].latitude).toBe(-8.4);
    expect(() => parseMountains({ success: false, message: 'Rusak' })).toThrow('Rusak');
  });
});

describe('tema', () => {
  test('palet terang dan gelap punya token yang sama', () => {
    expect(Object.keys(PALETTES.light).sort()).toEqual(Object.keys(PALETTES.dark).sort());
  });
});
