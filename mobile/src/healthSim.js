// Data kesehatan otomatis selama pendakian.
// - ASLI   : langkah (pedometer HP) dan ketinggian (GPS / pos terakhir).
// - SIMULASI: detak jantung, SpO2, suhu tubuh (HP biasa tidak punya sensornya).
//   Nilai simulasi dibuat realistis: SpO2 turun seiring ketinggian, detak naik saat bergerak cepat.
// - DIHITUNG: kalori dari langkah dan tanjakan.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function simulateVitals({ altitudeM = 0, movingKmh = 0, prev = null, rng = Math.random } = {}) {
  const alt = Math.max(0, Number(altitudeM) || 0);
  const speed = clamp(Number(movingKmh) || 0, 0, 6);
  const noise = (amp) => (rng() - 0.5) * 2 * amp;

  let spo2 = 98 - (Math.max(0, alt - 1500) / 1000) * 3.6 + noise(1.2);
  let bpm = 72 + speed * 17 + (alt / 1000) * 4 + noise(5);
  let temp = 36.6 + speed * 0.12 + noise(0.2);

  if (prev) { // haluskan supaya tidak melompat-lompat
    if (prev.spo2 != null) spo2 = prev.spo2 * 0.5 + spo2 * 0.5;
    if (prev.bpm != null) bpm = prev.bpm * 0.5 + bpm * 0.5;
    if (prev.temperatureC != null) temp = prev.temperatureC * 0.5 + temp * 0.5;
  }
  return {
    spo2: Math.round(clamp(spo2, 75, 100)),
    bpm: Math.round(clamp(bpm, 55, 185)),
    temperatureC: Math.round(clamp(temp, 35.5, 38.5) * 10) / 10,
  };
}

// Perkiraan kalori (orang ±65 kg): ~0,045 kkal per langkah + ~0,6 kkal per meter tanjakan.
export function caloriesFrom({ steps = 0, elevationGainM = 0, weightKg = 65 } = {}) {
  const k = weightKg / 65;
  return Math.round((Math.max(0, steps) * 0.045 + Math.max(0, elevationGainM) * 0.6) * k);
}

// Kecepatan (km/jam) dari dua titik lokasi terakhir yang tersedia.
export function speedFromTrack(points) {
  const p = points.filter((l) => l && l.isAvailable && l.isAvailable());
  if (p.length < 2) return 0;
  const a = p[p.length - 2];
  const b = p[p.length - 1];
  const h = (b.recordedAt - a.recordedAt) / 3600000;
  if (h <= 0) return 0;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(x))) / h;
}

// Ketinggian terbaik yang diketahui: GPS -> pos terakhir check-in -> basecamp/0.
export function bestAltitude(trip) {
  if (!trip) return null;
  const last = trip.lastKnownLocation && trip.lastKnownLocation();
  if (last && last.altitudeM != null) return last.altitudeM;
  const cps = trip.progress && trip.progress.checkpoints;
  if (cps) {
    const done = cps.filter((c) => c.arrivedAt);
    if (done.length) return done[done.length - 1].elevationMdpl;
  }
  return null;
}
