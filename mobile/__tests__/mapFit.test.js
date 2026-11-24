import { fitPointsFor } from '../src/mapFit';

// Kasus nyata dari laporan bug: Carstensz (Papua) tanpa pos, posisi GPS user di Bandung.
const basecamp = { latitude: -4.067, longitude: 137.17 };
const summit = { latitude: -4.0833, longitude: 137.1833 };
const bandung = { latitude: -6.898052, longitude: 107.644231 };

describe('zoom peta', () => {
  test('GPS user yang jauh dari jalur tidak ikut zoom (bug Carstensz)', () => {
    const pts = fitPointsFor({ route: [basecamp], summit, track: [bandung] });
    expect(pts).toEqual([basecamp, summit]);
  });
  test('GPS user di dekat jalur ikut zoom', () => {
    const near = { latitude: -4.07, longitude: 137.175 };
    expect(fitPointsFor({ route: [basecamp], summit, track: [near] })).toHaveLength(3);
  });
  test('tanpa gunung terpilih: zoom ke posisi user', () => {
    expect(fitPointsFor({ userLocation: bandung })).toEqual([bandung]);
    expect(fitPointsFor({})).toEqual([]);
  });
});
