import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { storage } from './storage';

// Token warna. "dark" = palet asli aplikasi; "light" = versi terang yang serasi.
export const PALETTES = {
  dark: {
    scheme: 'dark',
    bg: '#050708', screen: '#000000', auth: '#2E4A52', card: '#24444C', cardAlt: '#2F5660', field: '#5F7A80',
    accent: '#1A8CB0', accentSoft: 'rgba(26,140,176,0.18)', onAccent: '#FFFFFF',
    text: '#FFFFFF', textSoft: '#E5EEF0', mute: '#9FB3B8', placeholder: '#D5E1E3',
    ok: '#3DBE6B', warn: '#E0B33A', red: '#D64545', onStatus: '#111111',
    border: '#4A6A72', divider: '#3A4F54',
    topbar: '#1D3A40', pill: '#2F4E55', sheet: '#6B8388', sheetInput: '#4E666B', sheetText: '#E5EEF0',
    hero: '#1F6F8B', heroGround: '#2D7A55', mapBg: '#2D5A3F', mCard: '#1F6F8B', mCardText: '#E5F2F5',
    btnLight: '#EDEDED', btnLightText: '#111111', neutral: '#555555', badgeMuted: '#333333', cancelled: '#777777',
    track: '#000000', trackGrid: '#1A2A2E', overlay: 'rgba(0,0,0,0.5)', legendBg: 'rgba(0,0,0,0.6)',
    errorBg: '#7A2E2E', errorText: '#FFD2D2', avatarBg: '#E8E8E8', avatarIcon: '#111111',
    imageShade: 'rgba(0,0,0,0.35)', social: '#EDEDED', socialIcon: '#222222',
  },
  light: {
    scheme: 'light',
    bg: '#F2F6F7', screen: '#F2F6F7', auth: '#DCE9EC', card: '#FFFFFF', cardAlt: '#E4EEF0', field: '#FFFFFF',
    accent: '#137A9B', accentSoft: 'rgba(19,122,155,0.16)', onAccent: '#FFFFFF',
    text: '#10262B', textSoft: '#2F4A50', mute: '#5E7479', placeholder: '#7E9398',
    ok: '#2A9A55', warn: '#C88F14', red: '#C93C3C', onStatus: '#111111',
    border: '#C9D8DC', divider: '#D6E2E5',
    topbar: '#FFFFFF', pill: '#E4EEF0', sheet: '#E3ECEE', sheetInput: '#FFFFFF', sheetText: '#2F4A50',
    hero: '#6FB3CC', heroGround: '#6BA884', mapBg: '#CFE3D6', mCard: '#2C86A6', mCardText: '#F2FAFC',
    btnLight: '#1D3A40', btnLightText: '#FFFFFF', neutral: '#7A8C90', badgeMuted: '#D5DEE0', cancelled: '#8C9A9D',
    track: '#EAF1F2', trackGrid: '#C9D8DC', overlay: 'rgba(0,0,0,0.35)', legendBg: 'rgba(255,255,255,0.85)',
    errorBg: '#FDE2E2', errorText: '#8A1F1F', avatarBg: '#D5E1E3', avatarIcon: '#1D3A40',
    imageShade: 'rgba(0,0,0,0.30)', social: '#FFFFFF', socialIcon: '#222222',
  },
};

// Kompatibilitas lama: C = palet gelap (dipakai kode non-UI / tes).
export const C = PALETTES.dark;

const MODE_KEY = 'mt.themeMode';
export const THEME_MODES = ['system', 'light', 'dark'];

const ThemeCtx = createContext({ colors: PALETTES.dark, mode: 'system', scheme: 'dark', setMode: () => {}, toggle: () => {} });

export function ThemeProvider({ children }) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setModeState] = useState('system');

  useEffect(() => {
    storage.get(MODE_KEY).then((v) => { if (THEME_MODES.includes(v)) setModeState(v); });
  }, []);

  const setMode = useCallback((m) => {
    if (!THEME_MODES.includes(m)) return;
    setModeState(m);
    storage.set(MODE_KEY, m);
  }, []);

  const scheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const toggle = useCallback(() => setMode(scheme === 'dark' ? 'light' : 'dark'), [scheme, setMode]);
  const value = useMemo(() => ({ colors: PALETTES[scheme], mode, scheme, setMode, toggle }), [scheme, mode, setMode, toggle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

// makeStyles((c) => ({...})) -> hook yang mengembalikan StyleSheet sesuai tema aktif (di-cache per palet).
export function makeStyles(factory) {
  const cache = new Map();
  return function useStyles() {
    const { colors } = useTheme();
    let s = cache.get(colors);
    if (!s) { s = StyleSheet.create(factory(colors)); cache.set(colors, s); }
    return s;
  };
}
