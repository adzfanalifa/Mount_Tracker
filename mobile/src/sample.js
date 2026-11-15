import { HikingTrip, Location } from './models';

// Riwayat contoh supaya halaman Riwayat & track bisa langsung dicoba.
// Matikan dengan SHOW_SAMPLE_HISTORY = false di store.js.

const ROUTES = {
  rinjani: { from: [-8.3725, 116.5290], to: [-8.4116, 116.4573], alt: [1156, 3726] },
  gede: { from: [-6.7406, 106.9997], to: [-6.7845, 106.9830], alt: [1275, 2958] },
  pangrango: { from: [-6.7406, 106.9997], to: [-6.7720, 106.9640], alt: [1275, 3019] },
};

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function buildTrack(route, start, points, seed) {
  const r = rng(seed);
  const [la0, lo0] = route.from;
  const [la1, lo1] = route.to;
  const [nLat, nLng] = [-(lo1 - lo0), la1 - la0]; // arah tegak lurus untuk kelokan jalur
  const out = [];
  let t = start.getTime();
  let lastPos = null;
  for (let i = 0; i < points; i++) {
    const k = i / (points - 1);
    const wiggle = Math.sin(k * Math.PI * 5) * 0.06 + Math.sin(k * Math.PI * 13) * 0.02;
    const resting = i > 2 && i < points - 2 && r() < 0.12; // istirahat: posisi tidak berubah
    const pos = resting && lastPos ? lastPos : {
      latitude: la0 + (la1 - la0) * k + nLat * wiggle + (r() - 0.5) * 0.0004,
      longitude: lo0 + (lo1 - lo0) * k + nLng * wiggle + (r() - 0.5) * 0.0004,
      altitudeM: Math.round(route.alt[0] + (route.alt[1] - route.alt[0]) * Math.pow(k, 1.15) + (r() - 0.5) * 12),
    };
    out.push(new Location({ ...pos, accuracyM: 5 + Math.round(r() * 10), recordedAt: new Date(t) }));
    lastPos = pos;
    t += (4 + Math.round(r() * 4)) * 60000;
  }
  return out;
}

export function makeSampleTrips(mountains, now = new Date()) {
  const byId = Object.fromEntries(mountains.map((m) => [m.id, m]));
  const plan = [
    ['rinjani', 0, 4, 2, 70, 11, 'finished'],
    ['gede', 1, 18, 1, 40, 23, 'finished'],
    ['pangrango', 0, 55, 1, 36, 37, 'finished'],
    ['gede', 0, 75, 1, 0, 41, 'cancelled'],
  ];
  return plan.filter(([id]) => byId[id]).map(([id, trailIdx, daysAgo, days, points, seed, status], i) => {
    const m = byId[id];
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 6, 30);
    const trip = new HikingTrip({ id: `sample${i}`, mountain: m, trailName: m.trails[trailIdx] || m.trails[0], groupSize: 2 + (i % 3), plannedDays: days, startDate: start, now: start, notes: 'Data contoh' });
    trip.isSample = true;
    if (status === 'cancelled') { trip.cancel(start); return trip; }
    trip.start(start);
    buildTrack(ROUTES[id], start, points, seed).forEach((l) => trip.addLocation(l));
    trip.finish(new Date(trip.locations[trip.locations.length - 1].recordedAt.getTime() + 10 * 60000));
    return trip;
  });
}