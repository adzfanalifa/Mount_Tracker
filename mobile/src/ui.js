import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, makeStyles } from './theme';

// Komponen kecil untuk loading / error / kosong dan tombol ganti tema.

export function Loading({ text = 'Memuat...', style }) {
  const { colors } = useTheme();
  const s = useS();
  return (
    <View style={[s.box, style]}>
      <ActivityIndicator color={colors.accent} />
      <Text style={s.mute}>{text}</Text>
    </View>
  );
}

export function ErrorBox({ message, onRetry, style }) {
  const s = useS();
  if (!message) return null;
  return (
    <View style={[s.err, style]}>
      <Text style={s.errT}>{message}</Text>
      {onRetry ? <TouchableOpacity onPress={onRetry} hitSlop={8}><Text style={s.retry}>Coba lagi</Text></TouchableOpacity> : null}
    </View>
  );
}

export function Empty({ text, icon = 'information-circle-outline', style }) {
  const { colors } = useTheme();
  const s = useS();
  return (
    <View style={[s.box, style]}>
      <Ionicons name={icon} size={26} color={colors.mute} />
      <Text style={[s.mute, { textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

// Ikon matahari/bulan di pojok kanan atas: ganti tema terang/gelap secara manual.
export function ThemeToggle({ size = 22, color }) {
  const { colors, scheme, toggle } = useTheme();
  return (
    <TouchableOpacity onPress={toggle} hitSlop={10} accessibilityLabel="Ganti tema terang/gelap">
      <Ionicons name={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={size} color={color || colors.text} />
    </TouchableOpacity>
  );
}

const useS = makeStyles((c) => ({
  box: { alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  mute: { color: c.mute, fontSize: 12 },
  err: { backgroundColor: c.errorBg, borderRadius: 8, padding: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  errT: { color: c.errorText, fontSize: 12, flex: 1 },
  retry: { color: c.errorText, fontWeight: '700', fontSize: 12, textDecorationLine: 'underline' },
}));
