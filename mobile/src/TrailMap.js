import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTheme } from './theme';

const INDONESIA = { latitude: -2.5, longitude: 118, latitudeDelta: 22, longitudeDelta: 22 };

// Peta jalur (react-native-maps). Tanpa gunung terpilih: hanya peta + posisi user.
// checkpoints: [{id, name, latitude, longitude, status, elevationMdpl}], basecamp: {latitude, longitude, name}
export default function TrailMap({ style, checkpoints = [], basecamp = null, track = [], summit = null, userLocation = null, showUser = false }) {
  const { colors, scheme } = useTheme();
  const ref = useRef(null);

  const route = useMemo(() => [basecamp, ...checkpoints].filter(Boolean).map((p) => ({ latitude: p.latitude, longitude: p.longitude })), [basecamp, checkpoints]);
  const trackCoords = useMemo(() => track.filter((l) => l.isAvailable()).map((l) => ({ latitude: l.latitude, longitude: l.longitude })), [track]);
  const fitPoints = route.length ? [...route, ...trackCoords] : summit ? [summit] : userLocation ? [userLocation] : [];
  const key = fitPoints.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join('|');

  const fit = () => {
    const m = ref.current;
    if (!m) return;
    if (fitPoints.length >= 2) {
      m.fitToCoordinates(fitPoints, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
    } else if (fitPoints.length === 1) {
      const d = route.length || summit ? 0.12 : 0.05;
      m.animateToRegion({ ...fitPoints[0], latitudeDelta: d, longitudeDelta: d }, 500);
    } else {
      m.animateToRegion(INDONESIA, 500);
    }
  };
  useEffect(() => { const h = setTimeout(fit, 300); return () => clearTimeout(h); }, [key]);

  const pin = (st) => (st === 'done' ? colors.ok : st === 'current' ? colors.red : colors.accent);

  return (
    <View style={[st.wrap, { backgroundColor: colors.mapBg }, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={INDONESIA}
        onMapReady={fit}
        showsUserLocation={showUser}
        showsMyLocationButton={showUser}
        userInterfaceStyle={scheme}
        mapType="terrain"
        toolbarEnabled={false}
      >
        {route.length >= 2 && <Polyline coordinates={route} strokeColor={colors.accent} strokeWidth={4} lineDashPattern={[8, 6]} />}
        {trackCoords.length >= 2 && <Polyline coordinates={trackCoords} strokeColor={colors.warn} strokeWidth={3} />}
        {basecamp && <Marker coordinate={basecamp} title={basecamp.name || 'Basecamp'} pinColor={colors.mute} />}
        {checkpoints.map((c) => (
          <Marker key={`${c.id}-${c.status}`} coordinate={{ latitude: c.latitude, longitude: c.longitude }} title={c.name}
            description={`${c.elevationMdpl} mdpl${c.isSample ? ' · koordinat perkiraan' : ''}`} pinColor={pin(c.status)} />
        ))}
        {!checkpoints.length && summit && <Marker coordinate={summit} title={summit.name || 'Puncak'} pinColor={colors.red} />}
      </MapView>
    </View>
  );
}

const st = StyleSheet.create({ wrap: { height: 240, borderRadius: 10, overflow: 'hidden', marginTop: 10 } });
