import { Mountain } from './models';

// Prosedur pembaruan data gunung & jalur dari backend (GET /mountains).
// Data baru hanya dipakai jika SEMUA item lolos validasi; jika gagal, data lama tetap dipakai.

export const DEFAULT_API_URL = 'http://192.168.1.5:8000';
const DIFFS = ['easy', 'medium', 'extreme'];

export function normalizeUrl(url) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/.test(u)) throw new Error('Alamat server harus diawali http:// atau https://');
  return u;
}

// Mengubah JSON dari server menjadi daftar Mountain. Melempar error jika ada data yang rusak.
export function parseMountains(json) {
  if (!Array.isArray(json)) throw new Error('Format data server tidak dikenali (bukan daftar)');
  if (json.length === 0) throw new Error('Server mengirim daftar gunung kosong');
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
    return new Mountain({ id, name, elevationMdpl: Math.round(elev), difficulty: m.difficulty, trails });
  });
}

export async function fetchMountains(baseUrl, { timeoutMs = 8000, fetchImpl = fetch } = {}) {
  const url = `${normalizeUrl(baseUrl)}/mountains`;
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
  if (!res.ok) throw new Error(`Server membalas status ${res.status}`);
  let json;
  try { json = await res.json(); } catch (e) { throw new Error('Balasan server bukan JSON yang valid'); }
  return parseMountains(json);
}