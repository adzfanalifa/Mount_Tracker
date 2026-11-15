import { Platform } from 'react-native';

// Pedometer HP (expo-sensors). Jika tidak tersedia / izin ditolak, dianggap tidak ada (null).
let Pedometer = null;
try {
  // eslint-disable-next-line global-require
  Pedometer = require('expo-sensors').Pedometer;
} catch (e) {
  Pedometer = null;
}

export async function pedometerAvailable() {
  if (!Pedometer || Platform.OS === 'web') return false;
  try {
    if (!(await Pedometer.isAvailableAsync())) return false;
    const p = Pedometer.requestPermissionsAsync ? await Pedometer.requestPermissionsAsync() : { granted: true };
    return p.granted !== false;
  } catch (e) {
    return false;
  }
}

// Mulai menghitung langkah. onSteps(totalSejakMulai). Mengembalikan fungsi untuk berhenti.
export async function watchSteps(onSteps) {
  if (!(await pedometerAvailable())) return null;
  try {
    const sub = Pedometer.watchStepCount((r) => onSteps(r.steps));
    return () => sub && sub.remove && sub.remove();
  } catch (e) {
    return null;
  }
}
