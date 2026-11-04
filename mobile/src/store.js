import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, EmergencyContact, HikingTrip, EmergencyEvent, Location } from './models';
import { getCurrentLocation, requestPermission } from './location';

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
  const trips = useRef([]).current;
  const emergencies = useRef([]).current;
  const issues = useRef([]).current;

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
    user, trips, emergencies, issues, activeTrip, plannedTrip,

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
