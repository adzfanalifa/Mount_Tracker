// Satu-satunya pintu ke backend. Semua response backend: {success, message, data}.
import { API_URL, API_TIMEOUT_MS } from './config';

export class ApiError extends Error {
  constructor(message, { status = 0, errors = null, network = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.network = network;
  }
}

export function normalizeBaseUrl(url) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/.test(u)) throw new Error('Alamat server harus diawali http:// atau https://');
  return u;
}

const qs = (o = {}) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${p.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}` : '';
};

export function createApi({ baseUrl = API_URL, fetchImpl, timeoutMs = API_TIMEOUT_MS } = {}) {
  let base = normalizeBaseUrl(baseUrl);
  let token = null;
  let onUnauthorized = null;
  const doFetch = (...a) => (fetchImpl || fetch)(...a);

  async function request(method, path, body, { auth = true } = {}) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await doFetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined });
    } catch (e) {
      throw new ApiError(e && e.name === 'AbortError'
        ? 'Server tidak merespons (timeout). Cek koneksi dan alamat server.'
        : `Tidak dapat terhubung ke server (${base}). Pastikan HP dan laptop di WiFi yang sama.`, { network: true });
    } finally {
      if (timer) clearTimeout(timer);
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* bukan JSON */ }
    if (!json || typeof json !== 'object' || !('success' in json)) {
      throw new ApiError(`Balasan server tidak dikenali (status ${res.status})`, { status: res.status });
    }
    if (!res.ok || json.success === false) {
      if (res.status === 401 && auth && token && onUnauthorized) onUnauthorized();
      throw new ApiError(json.message || `Server membalas status ${res.status}`, { status: res.status, errors: json.errors || null });
    }
    return json.data;
  }

  const get = (p, o) => request('GET', p, undefined, o);
  const post = (p, b = {}, o) => request('POST', p, b, o);
  const put = (p, b = {}, o) => request('PUT', p, b, o);
  const del = (p, o) => request('DELETE', p, undefined, o);

  return {
    // konfigurasi
    get baseUrl() { return base; },
    setBaseUrl(u) { base = normalizeBaseUrl(u); },
    setToken(t) { token = t || null; },
    get token() { return token; },
    setOnUnauthorized(fn) { onUnauthorized = fn; },
    request,

    status: () => get('/', { auth: false }),

    // auth
    login: (login, password) => post('/login', { login, password }, { auth: false }),
    register: (d) => post('/register', d, { auth: false }),
    forgot: (d) => post('/forgot', d, { auth: false }),
    reset: (d) => post('/reset', d, { auth: false }),
    google: (idToken) => post('/auth/google', { idToken }, { auth: false }),
    me: () => get('/me'),
    updateMe: (d) => put('/me', d),

    // gunung, jalur, pos
    mountains: (f = {}) => get(`/mountains${qs(f)}`, { auth: false }),
    mountain: (id) => get(`/mountains/${id}`, { auth: false }),
    trails: (mountainId) => get(`/mountains/${mountainId}/trails`, { auth: false }),

    // pendakian & check-in
    trips: (f = {}) => get(`/trips${qs(f)}`),
    activeTrip: () => get('/trips/active'),
    trip: (id) => get(`/trips/${id}`),
    createTrip: (d) => post('/trips', d),
    startTrip: (id) => post(`/trips/${id}/start`),
    finishTrip: (id) => post(`/trips/${id}/finish`),
    cancelTrip: (id) => post(`/trips/${id}/cancel`),
    addLocations: (id, locations) => post(`/trips/${id}/locations`, { locations }),
    tripCheckpoints: (id) => get(`/trips/${id}/checkpoints`),
    checkin: (id, d) => post(`/trips/${id}/checkins`, d),

    // health
    healthList: (f = {}) => get(`/health${qs(f)}`),
    addHealth: (d) => post('/health', d),

    // SOS & kontak
    sosList: () => get('/sos'),
    sos: (d) => post('/sos', d),
    resolveSos: (id, status = 'resolved') => post(`/sos/${id}/resolve`, { status }),
    contacts: () => get('/contacts'),
    addContact: (d) => post('/contacts', d),
    updateContact: (id, d) => put(`/contacts/${id}`, d),
    setPrimaryContact: (id) => put(`/contacts/${id}/primary`),
    deleteContact: (id) => del(`/contacts/${id}`),

    // cuaca
    weather: (f) => get(`/weather${qs(f)}`, { auth: false }),

    // laporan kendala
    issues: () => get('/issues'),
    addIssue: (d) => post('/issues', d),
  };
}

// Instance tunggal yang dipakai aplikasi.
export const api = createApi();
