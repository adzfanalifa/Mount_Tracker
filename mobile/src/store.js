import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, EmergencyContact, HikingTrip, EmergencyEvent, Location } from './models';
import { getCurrentLocation, requestPermission } from './location';
import { MOUNTAINS } from './data';
import { fetchMountains, normalizeUrl, DEFAULT_API_URL } from './dataSync';
import { makeSampleTrips } from './sample';
import { isEmail } from './validation';

// Tampilkan riwayat contoh (bisa dimatikan setelah ada data asli dari backend).
export const SHOW_SAMPLE_HISTORY = true;

// State aplikasi sementara di memori (hilang saat aplikasi ditutup). Nanti diganti API backend.
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

let seq = 0;
const nextId = (p) => `${p}${Date.now()}${seq++}`;
const TRACK_INTERVAL_MS = 30000;

export function AppProvider({ children }) {
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const user = useRef(new User({ id: 'u1', username: 'pendaki' })).current;
  const trips = useRef(SHOW_SAMPLE_HISTORY ? makeSampleTrips(MOUNTAINS) : []).current;
  const emergencies = useRef([]).current;
  const issues = useRef([]).current;
  const [mountains, setMountains] = useState(MOUNTAINS);
  const [apiUrl, setApiUrlState] = useState(DEFAULT_API_URL);
  const [dataInfo, setDataInfo] = useState({ source: 'lokal', updatedAt: null, lastError: null, log: [] });

  const activeTrip = trips.find((t) => t.status === 'active') || null;
  const plannedTrip = trips.find((t) => t.status === 'planned') || null;

  // Pelacakan lokasi hanya berjalan saat ada pendakian aktif.
  const activeId = activeTrip ? activeTrip.id : null;
  useEffect(() => {
    if (!activeId) return undefined;
    let stopped = false;
    const record = async () => {
      const loc = await getCurrentLocation();
      if (stopped) return;
      const t = trips.find((x) => x.id === activeId);
      if (t && t.status === 'active') { t.addLocation(loc); bump(); }
    };
    const h = setInterval(record, TRACK_INTERVAL_MS);
    return () => { stopped = true; clearInterval(h); };
  }, [activeId]);

  const api = {
    user, trips, emergencies, issues, activeTrip, plannedTrip, mountains, apiUrl, dataInfo,

    // Modul pengguna (lokal; nanti diganti POST /login & /register).
    login({ identity }) {
      const id = String(identity || '').trim();
      if (isEmail(id)) { user.email = id; if (!user.username || user.username === 'pendaki') user.username = id.split('@')[0]; } else user.username = id;
      // Sementara: akun "admin" dianggap admin. Nanti diganti field role dari backend (/login -> user.role).
      user.role = user.username.toLowerCase() === 'admin' ? 'admin' : 'user';
      bump();
    },
    register({ username, email }) { user.username = String(username).trim(); user.email = String(email).trim(); user.displayName = ''; user.role = 'user'; bump(); },
    updateProfile({ displayName, email }) {
      const e = String(email || '').trim();
      if (e && !isEmail(e)) throw new Error('Format email tidak valid');
      user.displayName = String(displayName || '').trim();
      user.email = e;
      bump();
    },
    logout() { user.role = 'user'; bump(); },

    setApiUrl(url) { setApiUrlState(normalizeUrl(url)); },
    // Prosedur pembaruan data: ambil dari server -> validasi -> ganti. Gagal = data lama tetap dipakai.
    async updateMountains() {
      const stamp = new Date();
      try {
        const list = await fetchMountains(apiUrl);
        setMountains(list);
        setDataInfo((d) => ({ source: 'server', updatedAt: stamp, lastError: null,
          log: [{ at: stamp, ok: true, msg: `${list.length} gunung diperbarui` }, ...d.log].slice(0, 10) }));
        return list.length;
      } catch (e) {
        setDataInfo((d) => ({ ...d, lastError: e.message,
          log: [{ at: stamp, ok: false, msg: e.message }, ...d.log].slice(0, 10) }));
        throw e;
      }
    },
    resetMountains() {
      setMountains(MOUNTAINS);
      setDataInfo((d) => ({ ...d, source: 'lokal', updatedAt: null, lastError: null }));
    },

    addContact(data) { user.addContact(new EmergencyContact({ id: nextId('c'), ...data })); bump(); },
    removeContact(id) { user.removeContact(id); bump(); },
    setPrimaryContact(id) { user.setPrimary(id); bump(); },

    addTrip(params) {
      const trip = new HikingTrip({ id: nextId('t'), contact: user.primaryContact(), ...params });
      trips.unshift(trip);
      bump();
      return trip;
    },
    // Mengembalikan true jika lokasi tersedia saat mulai, false jika tidak (pendakian tetap dimulai).
    async startTrip(trip) {
      if (activeTrip && activeTrip !== trip) throw new Error('Masih ada pendakian aktif. Akhiri dulu sebelum memulai yang baru.');
      await requestPermission();
      trip.start();
      const loc = await getCurrentLocation();
      trip.addLocation(loc);
      bump();
      return loc.isAvailable();
    },
    finishTrip(trip) { trip.finish(); bump(); },
    cancelTrip(trip) { trip.cancel(); bump(); },

    async triggerSOS({ type, message }) {
      let loc = await getCurrentLocation();
      if (!loc.isAvailable() && activeTrip) loc = activeTrip.lastKnownLocation() || Location.unavailable();
      const ev = new EmergencyEvent({ id: nextId('e'), type, message, location: loc, tripId: activeTrip ? activeTrip.id : null });
      emergencies.unshift(ev);
      bump();
      return ev;
    },
    resolveEmergency(ev, status) { ev.resolve(status); bump(); },

    addIssue({ category, description }) {
      if (!description || !description.trim()) throw new Error('Deskripsi kendala wajib diisi');
      issues.unshift({ id: nextId('i'), category, description: description.trim(), status: 'open', createdAt: new Date() });
      bump();
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}