import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { C } from './src/theme';
import { Login, Register, Forgot, Reset } from './src/Auth';
import { Home, Maps, Health, Starterpack, Mount } from './src/Screens';
import { AppProvider } from './src/store';
import { PlanHike, Contacts, Emergency, History, SystemStatus } from './src/Extra';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const icons = { Home: 'home', Maps: 'map', Health: 'heart', Starterpack: 'bag-handle', Mount: 'triangle' };

function Tabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.card },
      tabBarActiveTintColor: C.accent, tabBarInactiveTintColor: C.mute,
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

const hdr = (title) => ({ headerShown: true, title, headerStyle: { backgroundColor: C.bg }, headerTintColor: '#fff' });

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg } }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Register" component={Register} />
          <Stack.Screen name="Forgot" component={Forgot} />
          <Stack.Screen name="Reset" component={Reset} />
          <Stack.Screen name="Main" component={Tabs} />
          <Stack.Screen name="PlanHike" component={PlanHike} options={hdr('Rencana Pendakian')} />
          <Stack.Screen name="Contacts" component={Contacts} options={hdr('Kontak Darurat')} />
          <Stack.Screen name="Emergency" component={Emergency} options={hdr('Darurat')} />
          <Stack.Screen name="History" component={History} options={hdr('Riwayat Perjalanan')} />
          <Stack.Screen name="SystemStatus" component={SystemStatus} options={hdr('Status Sistem')} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
