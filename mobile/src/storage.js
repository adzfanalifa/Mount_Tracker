import AsyncStorage from '@react-native-async-storage/async-storage';

// Pembungkus AsyncStorage yang tidak pernah melempar error (gagal = nilai default).
export const storage = {
  async get(key, fallback = null) {
    try { const v = await AsyncStorage.getItem(key); return v == null ? fallback : v; } catch (e) { return fallback; }
  },
  async set(key, value) {
    try { if (value == null) await AsyncStorage.removeItem(key); else await AsyncStorage.setItem(key, String(value)); } catch (e) { /* abaikan */ }
  },
  async getJSON(key, fallback = null) {
    const v = await this.get(key);
    if (v == null) return fallback;
    try { return JSON.parse(v); } catch (e) { return fallback; }
  },
  async setJSON(key, value) {
    await this.set(key, value == null ? null : JSON.stringify(value));
  },
  remove(key) { return this.set(key, null); },
};
