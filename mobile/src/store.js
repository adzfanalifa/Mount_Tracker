import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, HikingTrip, EmergencyEvent, Location, contactFromApi } from './models';
import { getCurrentLocation, requestPermission } from './location';
import { MOUNTAINS } from './data';
import { parseMountains } from './dataSync';
import { api, normalizeBaseUrl } from './api';
import { storage } from './storage';
import { TRACK_INTERVAL_MS, HEALTH_INTERVAL_MS } from './config';
import { simulateVitals, caloriesFrom, speedFromTrack, bestAltitude } from './healthSim';
import { watchSteps } from './pedometer';

// Riwayat contoh sudah tidak dipakai: semua data diambil dari backend.
export const SHOW_SAMPLE_HISTORY = false;

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const K = { token: 'mt.token', apiUrl: 'mt.apiUrl', selected: 'mt.selectedMountain', pending: 'mt.pendingLocations' };
const errMsg = (e) => (e && e.message) || 'Terjadi kesalahan';

export function AppProvider({ children }) {
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [apiUrl, setApiUrlState] = useState(api.baseUrl);
  const [mountains, setMountains] = useState(MOUNTAINS);
  const [mountainsState, setMountainsState] = useState({ loading: false, error: null });
  const [dataInfo, setDataInfo] = useState({ source: 'lokal', updatedAt: null, lastError: null, log: [] });
  const [selectedMountainId, setSelectedMountainId] = useState(null);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [tripState, setTripState] = useState({ loading: false, error: null });
  const [trips, setTrips] = useState([]);
  const [tripsState, setTripsState] = useState({ loading: false, error: null });
  const [contactsState, setContactsState] = useState({ loading: false, error: null });
  const emergencies = useRef([]).current;
  const [issues, setIssues] = useState([]);
  const [health, setHealth] = useState({ latest: null, items: [], loading: false, error: null, steps: null, pedometer: false, lastSentAt: null });

  const mountainsRef = useRef(mountains);
  mountainsRef.current = mountains;
  const findMountain = (id) => mountainsRef.current.find((m) => String(m.id) === String(id)) || null;
  const toTrip = (j) => HikingTrip.fromApi(j, findMountain(j.mountainId));

  const activeTrip = currentTrip && currentTrip.status === 'active' ? currentTrip : null;
  const plannedTrip = currentTrip && currentTrip.status === 'planned' ? currentTrip : null;

  // ------------------------------------------------------------ sesi
  const clearSession = async () => {
    api.setToken(null);
    await storage.remove(K.token);
    setUser(null);
    setCurrentTrip(null);
    setTrips([]);
    setIssues([]);
    emergencies.length = 0;
    setHealth((h) => ({ ...h, latest: null, items: [], steps: null }));
  };

  useEffect(() => {
    api.setOnUnauthorized(() => { clearSession(); setSessionExpired(true); });
  }, []);

  const applyUser = (j) => {
    const u = new User({ id: String(j.id), username: j.username, email: j.email, displayName: j.displayName || '', role: j.role });
    u.hasGoogle = !!j.hasGoogle;
    if (user) u.setContacts(user.emergencyContacts);
    setUser(u);
    return u;
  };

  async function loadMountains() {
    setMountainsState({ loading: true, error: null });
    try {
      const list = parseMountains(await api.mountains());
      setMountains(list);
      mountainsRef.current = list;
      setDataInfo((d) => ({ ...d, source: 'server', updatedAt: new Date(), lastError: null }));
      setMountainsState({ loading: false, error: null });
      return list;
    } catch (e) {
      setMountainsState({ loading: false, error: errMsg(e) });
      setDataInfo((d) => ({ ...d, lastError: errMsg(e) }));
      throw e;
    }
  }

  async function loadContacts(u) {
    setContactsState({ loading: true, error: null });
    try {
      const list = (await api.contacts()).map(contactFromApi);
      setUser((prev) => { const target = u || prev; if (target) target.setContacts(list); return target; });
      setContactsState({ loading: false, error: null });
      bump();
    } catch (e) {
      setContactsState({ loading: false, error: errMsg(e) });
    }
  }

  async function loadCurrentTrip() {
    setTripState((s) => ({ ...s, loading: true, error: null }));
    try {
      let j = await api.activeTrip();
      if (j && j.status === 'active') j = await api.trip(j.id); // detail lengkap + jejak GPS
      setCurrentTrip(j ? toTrip(j) : null);
      setTripState({ loading: false, error: null });
    } catch (e) {
      setTripState({ loading: false, error: errMsg(e) });
    }
  }

  async function loadTrips() {
    setTripsState({ loading: true, error: null });
    try {
      setTrips((await api.trips({ include: 'locations' })).map(toTrip));
      setTripsState({ loading: false, error: null });
    } catch (e) {
      setTripsState({ loading: false, error: errMsg(e) });
    }
  }

  async function loadHealth(tripId) {
    setHealth((h) => ({ ...h, loading: true, error: null }));
    try {
      const d = await api.healthList({ tripId: tripId || undefined, limit: 30 });
      setHealth((h) => ({ ...h, latest: d.latest, items: d.items, loading: false, error: null }));
    } catch (e) {
      setHealth((h) => ({ ...h, loading: false, error: errMsg(e) }));
    }
  }

  async function loadIssues() {
    try { setIssues((await api.issues()).map((i) => ({ ...i, createdAt: new Date(i.createdAt) }))); } catch (e) { /* tidak kritis */ }
  }

  async function refreshAll(u) {
    await Promise.allSettled([loadContacts(u), loadCurrentTrip(), loadTrips(), loadHealth(), loadIssues()]);
  }

  // Lepas gunung terpilih jika sama dengan gunung pendakian yang baru selesai/dibatalkan.
  function clearSelectionFor(trip) {
    const mid = trip && trip.mountain ? String(trip.mountain.id) : null;
    setSelectedMountainId((cur) => {
      if (cur == null || cur !== mid) return cur;
      storage.remove(K.selected);
      return null;
    });
  }

  async function startSession(data) {
    api.setToken(data.token);
    await storage.set(K.token, data.token);
    setSessionExpired(false);
    const u = applyUser(data.user);
    refreshAll(u);
    return u;
  }

  // Saat aplikasi dibuka: alamat server, token tersimpan, gunung terpilih.
  useEffect(() => {
    (async () => {
      const savedUrl = await storage.get(K.apiUrl);
      if (savedUrl) { try { api.setBaseUrl(savedUrl); setApiUrlState(api.baseUrl); } catch (e) { /* abaikan */ } }
      const sel = await storage.get(K.selected);
      if (sel) setSelectedMountainId(sel);
      const mountainsP = loadMountains().catch(() => null);
      const token = await storage.get(K.token);
      if (token) {
        api.setToken(token);
        try {
          await mountainsP;
          const u = applyUser(await api.me());
          await refreshAll(u);
        } catch (e) {
          if (e.status === 401) await clearSession();
          else { // server tidak terjangkau: tetap masuk, data dimuat ulang nanti
            setUser(new User({ id: 'offline', username: 'pendaki' }));
            setTripState({ loading: false, error: errMsg(e) });
          }
        }
      }
      setBooting(false);
    })();
  }, []);

  // ------------------------------------------------------------ pelacakan lokasi saat pendakian aktif
  const pending = useRef([]);
  const activeId = activeTrip ? activeTrip.id : null;
  useEffect(() => {
    if (!activeId) return undefined;
    let stopped = false;
    storage.getJSON(K.pending, []).then((p) => { if (Array.isArray(p)) pending.current = [...p, ...pending.current]; });
    const flush = async () => {
      if (!pending.current.length) return;
      const batch = pending.current.slice(0, 200);
      try {
        await api.addLocations(activeId, batch);
        pending.current = pending.current.slice(batch.length);
      } catch (e) { /* offline: dicoba lagi berikutnya */ }
      storage.setJSON(K.pending, pending.current);
    };
    const record = async () => {
      const loc = await getCurrentLocation();
      if (stopped) return;
      setCurrentTrip((t) => {
        if (t && t.id === activeId && t.status === 'active') t._locations.push(loc);
        return t;
      });
      pending.current.push({ latitude: loc.latitude, longitude: loc.longitude, altitudeM: loc.altitudeM, accuracyM: loc.accuracyM, source: loc.source, recordedAt: loc.recordedAt.toISOString() });
      bump();
      flush();
    };
    const h = setInterval(record, TRACK_INTERVAL_MS);
    return () => { stopped = true; clearInterval(h); };
  }, [activeId]);

  // ------------------------------------------------------------ kesehatan otomatis saat pendakian aktif
  const stepsRef = useRef(null);
  const tripRef = useRef(null);
  tripRef.current = currentTrip;
  const sendHealth = async () => {
    const t = tripRef.current;
    let alt = bestAltitude(t);
    if (alt == null) {
      const loc = await getCurrentLocation();
      alt = loc.altitudeM != null ? loc.altitudeM : (t && t.mountain ? Math.round(t.mountain.elevationMdpl * 0.4) : 0);
    }
    const speed = t ? speedFromTrack(t.trackPoints()) : 0;
    const prev = health.latest;
    const v = simulateVitals({ altitudeM: alt, movingKmh: speed, prev });
    const steps = stepsRef.current;
    const gain = t ? t.elevationGainM() : 0;
    const body = { ...v, altitudeM: alt, isSimulated: true, recordedAt: new Date().toISOString() };
    if (steps != null) { body.steps = steps; body.calories = caloriesFrom({ steps, elevationGainM: gain }); }
    else if (gain > 0) body.calories = caloriesFrom({ steps: 0, elevationGainM: gain });
    if (t && t.status === 'active') body.tripId = Number(t.id);
    const saved = await api.addHealth(body);
    setHealth((h) => ({ ...h, latest: saved, items: [saved, ...h.items].slice(0, 30), lastSentAt: new Date(), error: null }));
    return saved;
  };
  useEffect(() => {
    if (!activeId) { stepsRef.current = null; setHealth((h) => ({ ...h, steps: null, pedometer: false })); return undefined; }
    let stop = null;
    let cancelled = false;
    watchSteps((n) => { stepsRef.current = n; setHealth((h) => ({ ...h, steps: n })); })
      .then((fn) => { if (cancelled) { if (fn) fn(); } else { stop = fn; setHealth((h) => ({ ...h, pedometer: !!fn })); } });
    loadHealth(activeId);
    const first = setTimeout(() => sendHealth().catch(() => {}), 3000);
    const h = setInterval(() => sendHealth().catch((e) => setHealth((x) => ({ ...x, error: errMsg(e) }))), HEALTH_INTERVAL_MS);
    return () => { cancelled = true; clearTimeout(first); clearInterval(h); if (stop) stop(); };
  }, [activeId]);

  // ------------------------------------------------------------ aksi untuk layar
  const value = {
    booting, user, sessionExpired, apiUrl, dataInfo,
    mountains, mountainsState, selectedMountainId,
    currentTrip, activeTrip, plannedTrip, tripState, trips, tripsState, contactsState,
    emergencies, issues, health,

    // Modul pengguna
    async login({ identity, password }) { return startSession(await api.login(String(identity).trim(), password)); },
    async register({ username, email, password, confirmPassword }) {
      return startSession(await api.register({ username: String(username).trim(), email: String(email).trim(), password, confirmPassword }));
    },
    async loginGoogle(idToken) { return startSession(await api.google(idToken)); },
    forgot: ({ username, email }) => api.forgot({ username: String(username || '').trim() || undefined, email: String(email).trim() }),
    reset: (d) => api.reset(d),
    async updateProfile({ displayName, email }) { applyUser(await api.updateMe({ displayName, email })); },
    async logout() { await clearSession(); },
    clearSessionExpired() { setSessionExpired(false); },
    refreshAll: () => refreshAll(),

    // Alamat server
    async setApiUrl(url) {
      const u = normalizeBaseUrl(url);
      api.setBaseUrl(u);
      setApiUrlState(u);
      await storage.set(K.apiUrl, u);
    },
    async testServer() { return api.status(); },

    // Gunung
    loadMountains,
    async updateMountains() {
      const stamp = new Date();
      try {
        const list = await loadMountains();
        setDataInfo((d) => ({ ...d, log: [{ at: stamp, ok: true, msg: `${list.length} gunung diperbarui` }, ...d.log].slice(0, 10) }));
        return list.length;
      } catch (e) {
        setDataInfo((d) => ({ ...d, log: [{ at: stamp, ok: false, msg: errMsg(e) }, ...d.log].slice(0, 10) }));
        throw e;
      }
    },
    resetMountains() {
      setMountains(MOUNTAINS);
      setDataInfo((d) => ({ ...d, source: 'lokal', updatedAt: null, lastError: null }));
    },
    findMountain,
    selectMountain(id) {
      const v = id == null ? null : String(id);
      setSelectedMountainId(v);
      storage.set(K.selected, v);
    },

    // Pendakian
    loadCurrentTrip, loadTrips,
    async addTrip({ mountain, trailName, groupSize, plannedDays, startDate, expectedReturnAt, notes }) {
      const tr = mountain.trailByName(trailName);
      const j = await api.createTrip({
        mountainId: Number(mountain.id), trailId: tr && tr.id ? Number(tr.id) : undefined, trailName,
        groupSize, plannedDays, startDate: startDate.toISOString(), expectedReturnAt: expectedReturnAt ? expectedReturnAt.toISOString() : undefined, notes,
      });
      await loadCurrentTrip();
      return toTrip(j);
    },
    // true jika lokasi tersedia saat mulai, false jika tidak (pendakian tetap dimulai).
    async startTrip(trip) {
      await requestPermission();
      await api.startTrip(trip.id);
      const loc = await getCurrentLocation();
      try {
        await api.addLocations(trip.id, [{ latitude: loc.latitude, longitude: loc.longitude, altitudeM: loc.altitudeM, accuracyM: loc.accuracyM, source: loc.source, recordedAt: loc.recordedAt.toISOString() }]);
      } catch (e) { /* lokasi awal gagal dikirim tidak menghentikan pendakian */ }
      await loadCurrentTrip();
      return loc.isAvailable();
    },
    // Setelah pendakian selesai/dibatalkan, pilihan gunung itu dilepas supaya Maps kembali ke "belum memilih".
    async finishTrip(trip) { await api.finishTrip(trip.id); clearSelectionFor(trip); await Promise.all([loadCurrentTrip(), loadTrips()]); },
    async cancelTrip(trip) { await api.cancelTrip(trip.id); clearSelectionFor(trip); await Promise.all([loadCurrentTrip(), loadTrips()]); },
    async checkin(checkpointId) {
      const t = currentTrip;
      if (!t || t.status !== 'active') throw new Error('Mulai pendakian dulu sebelum check-in');
      const loc = await getCurrentLocation();
      const body = { checkpointId: Number(checkpointId) };
      if (loc.isAvailable()) { body.latitude = loc.latitude; body.longitude = loc.longitude; }
      const progress = await api.checkin(t.id, body);
      t.progress = progress;
      bump();
      return progress;
    },

    // Kontak darurat
    loadContacts: () => loadContacts(),
    async addContact({ name, phone, relationship }) { await api.addContact({ name, phone, relationship }); await loadContacts(); },
    async removeContact(id) { await api.deleteContact(id); await loadContacts(); },
    async setPrimaryContact(id) { await api.setPrimaryContact(id); await loadContacts(); },

    // SOS
    async triggerSOS({ type, message }) {
      let loc = await getCurrentLocation();
      if (!loc.isAvailable() && activeTrip) loc = activeTrip.lastKnownLocation() || Location.unavailable();
      const body = { type, message, time: new Date().toISOString(), source: loc.source };
      if (loc.isAvailable()) Object.assign(body, { latitude: loc.latitude, longitude: loc.longitude, altitudeM: loc.altitudeM, accuracyM: loc.accuracyM });
      let ev;
      try {
        ev = EmergencyEvent.fromApi(await api.sos(body));
        ev.sent = true;
      } catch (e) {
        ev = new EmergencyEvent({ id: `local${Date.now()}`, type, message, location: loc, tripId: activeTrip ? activeTrip.id : null });
        ev.sent = false;
        ev.sendError = errMsg(e);
      }
      emergencies.unshift(ev);
      bump();
      return ev;
    },
    async resolveEmergency(ev, status) {
      if (ev.sent) { try { await api.resolveSos(ev.id, status); } catch (e) { /* tetap ditutup lokal */ } }
      if (ev.status === 'active') ev.resolve(status);
      bump();
    },

    // Kesehatan
    loadHealth: () => loadHealth(activeTrip ? activeTrip.id : undefined),
    measureNow: () => sendHealth(),

    // Laporan kendala
    async addIssue({ category, description }) {
      if (!description || !description.trim()) throw new Error('Deskripsi kendala wajib diisi');
      await api.addIssue({ category, description: description.trim() });
      await loadIssues();
    },

    // Cuaca
    weather: (f) => api.weather(f),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
