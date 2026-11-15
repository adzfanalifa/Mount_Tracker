import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/theme';
import { Login, Register, Forgot, Reset } from './src/Auth';
import { Home, Maps, Health, Starterpack, Mount } from './src/Screens';
import { AppProvider, useApp } from './src/store';
import { PlanHike, Contacts, Emergency, SystemStatus } from './src/Extra';
import { History, HistoryDetail, Profile } from './src/HistoryProfile';
import { Guide, TestStatus, DataUpdate } from './src/More';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const navRef = createNavigationContainerRef();
const icons = { Home: 'home', Maps: 'map', Health: 'heart', Starterpack: 'bag-handle', Mount: 'triangle' };

function Tabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.card },
      tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.mute,
      tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} size={size} color={color} />,
    })}>
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Maps" component={Maps} />
      <Tab.Screen name="Health" component={Health} />
      <Tab.Screen name="Starterpack" component={Starterpack} />
      <Tab.Screen name="Mount" component={Mount} />
    </Tab.Navigator>
  );
}

function Root() {
  const { colors, scheme } = useTheme();
  const { booting, user, sessionExpired, clearSessionExpired } = useApp();
  const shown = useRef(false);

  // Token kedaluwarsa (401) -> kembali ke Login.
  useEffect(() => {
    if (!sessionExpired || !navRef.isReady()) return;
    clearSessionExpired();
    navRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    if (!shown.current) { shown.current = true; Alert.alert('Sesi berakhir', 'Silakan login ulang.', [{ text: 'OK', onPress: () => { shown.current = false; } }]); }
  }, [sessionExpired]);

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.auth, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.card, primary: colors.accent } };
  const hdr = (title) => ({ headerShown: true, title, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text });

  return (
    <NavigationContainer ref={navRef} theme={navTheme}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={user ? 'Main' : 'Login'}>
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Register" component={Register} />
        <Stack.Screen name="Forgot" component={Forgot} />
        <Stack.Screen name="Reset" component={Reset} />
        <Stack.Screen name="Main" component={Tabs} />
        <Stack.Screen name="PlanHike" component={PlanHike} options={hdr('Rencana Pendakian')} />
        <Stack.Screen name="Contacts" component={Contacts} options={hdr('Kontak Darurat')} />
        <Stack.Screen name="Emergency" component={Emergency} options={hdr('Darurat')} />
        <Stack.Screen name="History" component={History} />
        <Stack.Screen name="HistoryDetail" component={HistoryDetail} />
        <Stack.Screen name="Profile" component={Profile} />
        <Stack.Screen name="SystemStatus" component={SystemStatus} options={hdr('Status Sistem')} />
        <Stack.Screen name="Guide" component={Guide} options={hdr('Panduan Pengguna')} />
        <Stack.Screen name="TestStatus" component={TestStatus} options={hdr('Status Pengujian')} />
        <Stack.Screen name="DataUpdate" component={DataUpdate} options={hdr('Pembaruan Data')} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </ThemeProvider>
  );
}
