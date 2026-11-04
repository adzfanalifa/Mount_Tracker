import * as ExpoLocation from 'expo-location';
import { Location } from './models';

export async function requestPermission() {
  try {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

// Tidak pernah melempar error: jika izin/GPS/posisi gagal, kembalikan Location.unavailable().
export async function getCurrentLocation() {
  try {
    const perm = await ExpoLocation.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return Location.unavailable();
    if (!(await ExpoLocation.hasServicesEnabledAsync())) return Location.unavailable();
    const p = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
    return new Location({
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      altitudeM: p.coords.altitude == null ? null : Math.round(p.coords.altitude),
      accuracyM: p.coords.accuracy,
      source: 'gps',
    });
  } catch (e) {
    return Location.unavailable();
  }
}

export async function diagnoseLocation() {
  let permission = 'unknown';
  let servicesEnabled = false;
  try { permission = (await ExpoLocation.getForegroundPermissionsAsync()).status; } catch (e) { /* tetap unknown */ }
  try { servicesEnabled = await ExpoLocation.hasServicesEnabledAsync(); } catch (e) { /* tetap false */ }
  const position = await getCurrentLocation();
  return { permission, servicesEnabled, position };
}

export async function checkNetwork(timeoutMs = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://clients3.google.com/generate_204', { signal: ctrl.signal });
    return res.status === 204 || res.ok;
  } catch (e) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
