// Kelas PBO sesuai docs/class-diagram.md: User, EmergencyContact, Mountain, HikingTrip, Location, EmergencyEvent

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const dateUtil = { startOfDay, addDays };

// Jarak dua titik (km) dengan rumus haversine.
export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const MOVING_KMH = 0.5; // di bawah kecepatan ini dianggap berhenti

export const TRIP_STATUS = { PLANNED: 'planned', ACTIVE: 'active', FINISHED: 'finished', CANCELLED: 'cancelled' };

// ---------------------------------------------------------------- Location
export class Location {
  constructor({ latitude = null, longitude = null, altitudeM = null, accuracyM = null, source = 'gps', recordedAt = new Date() } = {}) {
    if (source !== 'unavailable') {
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Latitude tidak valid');
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Longitude tidak valid');
    } else {
      latitude = null;
      longitude = null;
    }
    this.latitude = latitude;
    this.longitude = longitude;
    this.altitudeM = altitudeM;
    this.accuracyM = accuracyM;
    this.source = source; // gps | network | manual | unavailable
    this.recordedAt = recordedAt;
  }
  isAvailable() { return this.source !== 'unavailable'; }
  toString() { return this.isAvailable() ? `${this.latitude.toFixed(5)}, ${this.longitude.toFixed(5)}` : 'Lokasi tidak tersedia'; }
  // Null object: dipakai saat GPS/izin tidak ada, supaya pemanggil tidak perlu cek null.
  static unavailable() { return new Location({ source: 'unavailable' }); }
}

// ---------------------------------------------------------- EmergencyContact
export class EmergencyContact {
  constructor({ id, name = '', phone = '', relationship = '', isPrimary = false }) {
    this.id = id;
    this.name = String(name).trim();
    this.phone = String(phone).replace(/[\s-]/g, '');
    this.relationship = String(relationship).trim();
    this.isPrimary = isPrimary;
  }
  validate() {
    if (!this.name) return 'Nama wajib diisi';
    if (!/^\+?[0-9]{8,15}$/.test(this.phone)) return 'Nomor telepon harus 8-15 angka';
    return null;
  }
  isValid() { return this.validate() === null; }
}

// --------------------------------------------------------------------- User
export class User {
  constructor({ id, username, email = '', displayName = '', role = 'user' }) {
    this.id = id;
    this.role = role; // user | admin
    this.username = username;
    this.email = email;
    this.displayName = displayName;
    this._contacts = [];
  }
  get isAdmin() { return this.role === 'admin'; }
  get name() { return this.displayName || this.username || 'Pendaki'; }
  get emergencyContacts() { return [...this._contacts]; }
  addContact(contact) {
    const err = contact.validate();
    if (err) throw new Error(err);
    if (this._contacts.length === 0) contact.isPrimary = true; // kontak pertama otomatis utama
    if (contact.isPrimary) this._contacts.forEach((c) => { c.isPrimary = false; });
    this._contacts.push(contact);
  }
  removeContact(id) {
    const wasPrimary = this._contacts.find((c) => c.id === id)?.isPrimary;
    this._contacts = this._contacts.filter((c) => c.id !== id);
    if (wasPrimary && this._contacts.length) this._contacts[0].isPrimary = true;
  }
  setPrimary(id) {
    if (!this._contacts.some((c) => c.id === id)) throw new Error('Kontak tidak ditemukan');
    this._contacts.forEach((c) => { c.isPrimary = c.id === id; });
  }
  primaryContact() { return this._contacts.find((c) => c.isPrimary) || null; }
  setContacts(list) { this._contacts = [...list]; } // daftar dari backend (sudah tervalidasi server)
  hasEmergencyContact() { return this._contacts.length > 0; }
}

// ----------------------------------------------------------------- Mountain
export class Mountain {
  constructor({ id, name, elevationMdpl, difficulty = 'easy', trails = [], trailDetails = [], latitude = null, longitude = null, province = null, description = null, imageUrl = null }) {
    this.id = id;
    this.name = name;
    this.elevationMdpl = elevationMdpl;
    this.difficulty = difficulty; // easy | medium | extreme
    this.trails = trails;
    this.trailDetails = trailDetails; // [{id, name, basecampLat, basecampLng, checkpointCount, ...}] dari backend
    this.latitude = latitude;
    this.longitude = longitude;
    this.province = province;
    this.description = description;
    this.imageUrl = imageUrl;
  }
  isHardLevel() { return this.difficulty === 'extreme'; }
  hasCoords() { return Number.isFinite(this.latitude) && Number.isFinite(this.longitude); }
  trailByName(name) { return this.trailDetails.find((t) => t.name === name) || null; }
  // Jalur default untuk peta: yang punya data pos, kalau tidak ada ya jalur pertama.
  defaultTrail() { return this.trailDetails.find((t) => t.checkpointCount > 0) || this.trailDetails[0] || null; }
}

// Ubah data JSON backend menjadi objek model (dipakai store).
const toDate = (s) => (s ? new Date(s) : null);
export function locationFromApi(l) {
  if (!l || l.source === 'unavailable' || l.latitude == null) return new Location({ source: 'unavailable', recordedAt: toDate(l && l.recordedAt) || new Date() });
  return new Location({ latitude: Number(l.latitude), longitude: Number(l.longitude), altitudeM: l.altitudeM, accuracyM: l.accuracyM, source: l.source || 'gps', recordedAt: toDate(l.recordedAt) || new Date() });
}
export function contactFromApi(c) {
  return new EmergencyContact({ id: String(c.id), name: c.name, phone: c.phone, relationship: c.relationship || '', isPrimary: !!c.isPrimary });
}

// -------------------------------------------------------------- HikingTrip
export class HikingTrip {
  constructor({ id, mountain, trailName, groupSize = 1, plannedDays = 1, startDate, expectedReturnAt, contact = null, notes = '', now = new Date() }) {
    if (!(mountain instanceof Mountain)) throw new Error('Gunung wajib dipilih');
    if (!trailName) throw new Error('Jalur wajib dipilih');
    if (!Number.isInteger(groupSize) || groupSize < 1) throw new Error('Jumlah orang minimal 1');
    if (!Number.isInteger(plannedDays) || plannedDays < 1 || plannedDays > 14) throw new Error('Lama pendakian harus 1-14 hari');
    if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) throw new Error('Tanggal berangkat tidak valid');
    if (startOfDay(startDate) < startOfDay(now)) throw new Error('Tanggal berangkat tidak boleh di masa lalu');

    const ret = expectedReturnAt ?? (() => { const d = addDays(startOfDay(startDate), plannedDays - 1); d.setHours(18, 0, 0, 0); return d; })();
    if (!(ret instanceof Date) || Number.isNaN(ret.getTime())) throw new Error('Estimasi turun tidak valid');
    if (ret <= startOfDay(startDate)) throw new Error('Estimasi turun harus setelah tanggal berangkat');

    this.id = id;
    this.mountain = mountain;
    this.trailName = trailName;
    this.groupSize = groupSize;
    this.plannedDays = plannedDays;
    this.startDate = startDate;
    this.expectedReturnAt = ret;
    this.contact = contact;
    this.notes = notes;
    this.startedAt = null;
    this.endedAt = null;
    this._status = TRIP_STATUS.PLANNED;
    this._locations = [];
  }
  get status() { return this._status; }
  get locations() { return [...this._locations]; }

  start(now = new Date()) {
    if (this._status !== TRIP_STATUS.PLANNED) throw new Error('Hanya pendakian berstatus direncanakan yang bisa dimulai');
    this._status = TRIP_STATUS.ACTIVE;
    this.startedAt = now;
  }
  finish(now = new Date()) {
    if (this._status !== TRIP_STATUS.ACTIVE) throw new Error('Hanya pendakian aktif yang bisa diakhiri');
    this._status = TRIP_STATUS.FINISHED;
    this.endedAt = now;
  }
  cancel(now = new Date()) {
    if (this._status !== TRIP_STATUS.PLANNED && this._status !== TRIP_STATUS.ACTIVE) throw new Error('Pendakian ini sudah selesai atau dibatalkan');
    this._status = TRIP_STATUS.CANCELLED;
    this.endedAt = now;
  }
  addLocation(location) {
    if (this._status !== TRIP_STATUS.ACTIVE) throw new Error('Lokasi hanya dicatat saat pendakian aktif');
    if (!(location instanceof Location)) throw new Error('Data lokasi tidak valid');
    this._locations.push(location);
  }
  lastKnownLocation() {
    for (let i = this._locations.length - 1; i >= 0; i--) if (this._locations[i].isAvailable()) return this._locations[i];
    return this._lastKnown || null;
  }
  unavailableCount() { return this._locations.filter((l) => !l.isAvailable()).length; }
  isOverdue(now = new Date()) { return this._status === TRIP_STATUS.ACTIVE && now > this.expectedReturnAt; }
  durationMinutes(now = new Date()) {
    if (!this.startedAt) return 0;
    return Math.max(0, Math.floor(((this.endedAt || now) - this.startedAt) / 60000));
  }
  trackPoints() { return this._locations.filter((l) => l.isAvailable()); }
  distanceKm() {
    const p = this.trackPoints();
    let d = 0;
    for (let i = 1; i < p.length; i++) d += haversineKm(p[i - 1], p[i]);
    return d;
  }
  // Menit bergerak: jumlah selang antar titik yang kecepatannya di atas ambang.
  movingMinutes() {
    const p = this.trackPoints();
    let m = 0;
    for (let i = 1; i < p.length; i++) {
      const min = (p[i].recordedAt - p[i - 1].recordedAt) / 60000;
      if (min > 0 && haversineKm(p[i - 1], p[i]) / (min / 60) >= MOVING_KMH) m += min;
    }
    return Math.round(m);
  }
  stoppedMinutes(now = new Date()) { return Math.max(0, this.durationMinutes(now) - this.movingMinutes()); }
  paceMinPerKm() { const d = this.distanceKm(); return d > 0 ? this.movingMinutes() / d : 0; }
  elevationGainM() {
    const a = this.trackPoints().map((l) => l.altitudeM).filter((x) => x != null);
    let g = 0;
    for (let i = 1; i < a.length; i++) if (a[i] > a[i - 1]) g += a[i] - a[i - 1];
    return g;
  }
  maxAltitudeM() {
    const a = this.trackPoints().map((l) => l.altitudeM).filter((x) => x != null);
    return a.length ? Math.max(...a) : null;
  }

  // Membuat HikingTrip dari JSON backend tanpa validasi tanggal (data riwayat boleh di masa lalu).
  static fromApi(j, mountain) {
    const t = Object.create(HikingTrip.prototype);
    t.id = String(j.id);
    t.mountain = mountain || new Mountain({ id: String(j.mountainId), name: j.mountainName || (j.mountain && j.mountain.name) || '-', elevationMdpl: (j.mountain && j.mountain.elevationMdpl) || 0, difficulty: (j.mountain && j.mountain.difficulty) || 'easy', trails: [j.trailName], latitude: j.mountain && j.mountain.latitude, longitude: j.mountain && j.mountain.longitude });
    t.trailId = j.trailId == null ? null : String(j.trailId);
    t.trailName = j.trailName;
    t.groupSize = j.groupSize;
    t.plannedDays = j.plannedDays;
    t.startDate = toDate(j.startDate);
    t.expectedReturnAt = toDate(j.expectedReturnAt);
    t.contact = null;
    t.contactId = j.contactId == null ? null : String(j.contactId);
    t.notes = j.notes || '';
    t.startedAt = toDate(j.startedAt);
    t.endedAt = toDate(j.endedAt);
    t._status = j.status;
    t._locations = Array.isArray(j.locations) ? j.locations.map(locationFromApi) : [];
    t._lastKnown = j.lastKnownLocation ? locationFromApi(j.lastKnownLocation) : null;
    t.progress = j.checkpoints || null; // {checkpoints:[...], next, paceFactor}
    return t;
  }
}

// ----------------------------------------------------------- EmergencyEvent
export class EmergencyEvent {
  constructor({ id, type = 'sos', message = '', location = null, tripId = null, now = new Date() }) {
    this.id = id;
    this.type = type; // sos | lost | injury | weather | other
    this.message = message;
    this.location = location || Location.unavailable();
    this.tripId = tripId;
    this.triggeredAt = now;
    this.resolvedAt = null;
    this._status = 'active';
  }
  get status() { return this._status; }
  static fromApi(j) {
    const e = new EmergencyEvent({ id: String(j.id), type: j.type, message: j.message || '', location: locationFromApi(j.location), tripId: j.tripId == null ? null : String(j.tripId), now: toDate(j.triggeredAt) || new Date() });
    e._status = j.status;
    e.resolvedAt = toDate(j.resolvedAt);
    return e;
  }
  resolve(status = 'resolved', now = new Date()) {
    if (this._status !== 'active') throw new Error('Kondisi darurat ini sudah ditutup');
    if (status !== 'resolved' && status !== 'cancelled') throw new Error('Status penutup tidak valid');
    this._status = status;
    this.resolvedAt = now;
  }
}