import { Mountain } from './models';

// Data contoh. Nanti diganti dari GET /mountains.
export const MOUNTAINS = [
  new Mountain({ id: 'rinjani', name: 'Rinjani', elevationMdpl: 3726, difficulty: 'easy', trails: ['Rinjani via Sembalun', 'Rinjani via Senaru'] }),
  new Mountain({ id: 'gede', name: 'Gede', elevationMdpl: 2958, difficulty: 'easy', trails: ['Gede via Cibodas', 'Gede via Gunung Putri'] }),
  new Mountain({ id: 'pangrango', name: 'Pangrango', elevationMdpl: 3019, difficulty: 'medium', trails: ['Pangrango via Cibodas'] }),
  new Mountain({ id: 'carstensz', name: 'Carstensz', elevationMdpl: 4884, difficulty: 'extreme', trails: ['Carstensz (jalur utama)'] }),
];

export const DIFFICULTY = {
  easy: { label: 'Easy', color: '#3DBE6B' },
  medium: { label: 'Medium', color: '#E0B33A' },
  extreme: { label: 'Extreme', color: '#D64545' },
};
