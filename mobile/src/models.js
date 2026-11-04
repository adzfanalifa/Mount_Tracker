// Kelas PBO sesuai docs/class-diagram.md: User, EmergencyContact, Mountain, HikingTrip, Location, EmergencyEvent

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const dateUtil = { startOfDay, addDays };

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
  constructor({ id, username, email = '' }) {
    this.id = id;
    this.username = username;
    this.email = email;
    this._contacts = [];
  }
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
  hasEmergencyContact() { return this._contacts.length > 0; }
}

// ----------------------------------------------------------------- Mountain
export class Mountain {
  constructor({ id, name, elevationMdpl, difficulty = 'easy', trails = [] }) {
    this.id = id;
    this.name = name;
    this.elevationMdpl = elevationMdpl;
    this.difficulty = difficulty; // easy | medium | extreme
    this.trails = trails;
  }
  isHardLevel() { return this.difficulty === 'extreme'; }
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
    return null;
  }
  unavailableCount() { return this._locations.filter((l) => !l.isAvailable()).length; }
  isOverdue(now = new Date()) { return this._status === TRIP_STATUS.ACTIVE && now > this.expectedReturnAt; }
  durationMinutes(now = new Date()) {
    if (!this.startedAt) return 0;
    return Math.max(0, Math.floor(((this.endedAt || now) - this.startedAt) / 60000));
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
  resolve(status = 'resolved', now = new Date()) {
    if (this._status !== 'active') throw new Error('Kondisi darurat ini sudah ditutup');
    if (status !== 'resolved' && status !== 'cancelled') throw new Error('Status penutup tidak valid');
    this._status = status;
    this.resolvedAt = now;
  }
}
