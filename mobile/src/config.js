// Konfigurasi aplikasi. Ubah lewat file mobile/.env (lihat .env.example), lalu restart "npx expo start -c".
// Alamat backend juga bisa diganti dari aplikasi: Profil > Pembaruan Data (admin) atau layar Login > "Server".

const env = (k) => (typeof process !== 'undefined' && process.env ? process.env[k] : undefined);

export const API_URL = env('EXPO_PUBLIC_API_URL') || 'http://192.168.1.5:8000';
export const API_TIMEOUT_MS = Number(env('EXPO_PUBLIC_API_TIMEOUT_MS')) || 12000;

export const GOOGLE = {
  webClientId: env('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') || '',
  androidClientId: env('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID') || '',
  iosClientId: env('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') || '',
};

// Interval kerja otomatis selama pendakian aktif.
export const TRACK_INTERVAL_MS = 30000; // simpan lokasi GPS
export const HEALTH_INTERVAL_MS = 5 * 60000; // kirim data kesehatan
