import { Mountain } from './models';
import { API_URL } from './config';

// Prosedur pembaruan data gunung & jalur dari backend (GET /mountains).
// Data baru hanya dipakai jika SEMUA item lolos validasi; jika gagal, data lama tetap dipakai.

export const DEFAULT_API_URL = API_URL;
const DIFFS = ['easy', 'medium', 'extreme'];
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function normalizeUrl(url) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/.test(u)) throw new Error('Alamat server harus diawali http:// atau https://');
  return u;
}

// Mengubah JSON dari server menjadi daftar Mountain. Melempar error jika ada data yang rusak.
export function parseMountains(json, { allowEmpty = false } = {}) {
  // Format baru backend: {success, message, data: [...]}
  if (json && !Array.isArray(json) && typeof json === 'object' && 'success' in json) {
    if (json.success === false) throw new Error(json.message || 'Server menolak permintaan');
    json = json.data;
  }
  if (!Array.isArray(json)) throw new Error('Format data server tidak dikenali (bukan daftar)');
  if (json.length === 0 && !allowEmpty) throw new Error('Server mengirim daftar gunung kosong');
  const seen = new Set();
  return json.map((m, i) => {
    const where = `Data ke-${i + 1}`;
    if (!m || typeof m !== 'object') throw new Error(`${where} tidak valid`);
    const id = m.id == null ? '' : String(m.id);
    const name = String(m.name ?? '').trim();
    const elev = Number(m.elevationMdpl);
    const trails = Array.isArray(m.trails) ? m.trails.map((x) => String(x).trim()).filter(Boolean) : [];
    if (!id) throw new Error(`${where}: id kosong`);
    if (seen.has(id)) throw new Error(`${where}: id ${id} ganda`);
    if (!name) throw new Error(`${where}: nama gunung kosong`);
    if (!Number.isFinite(elev) || elev <= 0 || elev > 9000) throw new Error(`${name}: ketinggian tidak valid`);
    if (!DIFFS.includes(m.difficulty)) throw new Error(`${name}: tingkat kesulitan tidak dikenali`);
    if (trails.length === 0) throw new Error(`${name}: belum punya jalur`);
    seen.add(id);
    const trailDetails = (Array.isArray(m.trailDetails) ? m.trailDetails : trails.map((t) => ({ name: t }))).map((t) => ({
      ...t, id: t.id == null ? null : String(t.id), checkpointCount: Number(t.checkpointCount) || 0,
      basecampLat: num(t.basecampLat), basecampLng: num(t.basecampLng),
    }));
    return new Mountain({ id, name, elevationMdpl: Math.round(elev), difficulty: m.difficulty, trails, trailDetails,
      latitude: num(m.latitude), longitude: num(m.longitude), province: m.province || null, description: m.description || null, imageUrl: m.imageUrl || null });
  });
}

export async function fetchMountains(baseUrl, { timeoutMs = 8000, fetchImpl = fetch, query = '' } = {}) {
  const url = `${normalizeUrl(baseUrl)}/mountains${query}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    throw new Error(e && e.name === 'AbortError' ? 'Server tidak merespons (timeout)' : 'Tidak dapat terhubung ke server');
  } finally {
    clearTimeout(timer);
  }
  let json;
  try { json = await res.json(); } catch (e) {
    if (!res.ok) throw new Error(`Server membalas status ${res.status}`);
    throw new Error('Balasan server bukan JSON yang valid');
  }
  if (!res.ok) throw new Error((json && json.message) || `Server membalas status ${res.status}`);
  return parseMountains(json, { allowEmpty: !!query });
}