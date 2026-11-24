import { haversineKm } from './models';

export const NEAR_KM = 30; // titik GPS dalam radius ini dari jalur ikut menentukan zoom

// Titik yang dipakai untuk zoom peta: area gunung (basecamp, pos, puncak) + titik GPS yang dekat jalur.
// Posisi user yang jauh (mis. masih di rumah) diabaikan agar peta tidak zoom-out ke seluruh Indonesia.
export function fitPointsFor({ route = [], summit = null, track = [], userLocation = null }) {
  const area = [...route, ...(summit ? [summit] : [])];
  if (!area.length) return userLocation ? [userLocation] : [];
  const near = track.filter((p) => area.some((a) => haversineKm(a, p) <= NEAR_KM));
  return [...area, ...near];
}
