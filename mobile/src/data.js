import { Mountain } from './models';

// Data cadangan (offline) jika server belum bisa dihubungi. Id sama dengan seed.sql backend.
// Data utama selalu diambil dari GET /mountains.
export const MOUNTAINS = [
  new Mountain({ id: '1', name: 'Rinjani', elevationMdpl: 3726, difficulty: 'easy', trails: ['Rinjani via Sembalun', 'Rinjani via Senaru'], latitude: -8.4119, longitude: 116.4572 }),
  new Mountain({ id: '2', name: 'Gede', elevationMdpl: 2958, difficulty: 'easy', trails: ['Gede via Cibodas', 'Gede via Gunung Putri'], latitude: -6.7853, longitude: 106.981 }),
  new Mountain({ id: '3', name: 'Pangrango', elevationMdpl: 3019, difficulty: 'medium', trails: ['Pangrango via Cibodas'], latitude: -6.7697, longitude: 106.963 }),
  new Mountain({ id: '4', name: 'Carstensz', elevationMdpl: 4884, difficulty: 'extreme', trails: ['Carstensz (jalur utama)'], latitude: -4.0833, longitude: 137.1833 }),
];

export const DIFFICULTY = {
  easy: { label: 'Easy', color: '#3DBE6B' },
  medium: { label: 'Medium', color: '#E0B33A' },
  extreme: { label: 'Extreme', color: '#D64545' },
};
