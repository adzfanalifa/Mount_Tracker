import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './theme';

// react-native-maps tidak mendukung web: tampilkan ringkasan saja.
export default function TrailMap({ style, checkpoints = [], summit = null }) {
  const { colors } = useTheme();
  return (
    <View style={[{ height: 240, borderRadius: 10, marginTop: 10, backgroundColor: colors.mapBg, alignItems: 'center', justifyContent: 'center', gap: 6 }, style]}>
      <Ionicons name="map-outline" size={30} color={colors.text} />
      <Text style={{ color: colors.text }}>Peta tersedia di aplikasi Android/iOS</Text>
      {checkpoints.length > 0 && <Text style={{ color: colors.mute, fontSize: 12 }}>{checkpoints.length} pos di jalur ini</Text>}
      {!checkpoints.length && summit && <Text style={{ color: colors.mute, fontSize: 12 }}>{summit.latitude.toFixed(4)}, {summit.longitude.toFixed(4)}</Text>}
    </View>
  );
}
