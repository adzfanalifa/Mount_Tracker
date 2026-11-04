import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from './theme';

function AuthScreen({ title, fields, cta, onPress, children, bottom }) {
  return (
    <ScrollView style={{ backgroundColor: C.auth }} contentContainerStyle={s.wrap}>
      <View style={s.logo}><Ionicons name="triangle" size={44} color="#fff" /></View>
      <Text style={s.title}>{title}</Text>
      {fields.map(([ph, secure]) => (
        <TextInput key={ph} placeholder={ph} placeholderTextColor="#D5E1E3" secureTextEntry={secure} style={s.input} autoCapitalize="none" />
      ))}
      {children}
      <TouchableOpacity style={s.btn} onPress={onPress}><Text style={s.btnT}>{cta}</Text></TouchableOpacity>
      {bottom}
    </ScrollView>
  );
}
const Link = ({ t, onPress }) => <TouchableOpacity onPress={onPress}><Text style={s.link}>{t}</Text></TouchableOpacity>;

export const Login = ({ navigation: n }) => (
  <AuthScreen title="Sign In" cta="Login" fields={[['Email/Username'], ['Password', true]]} onPress={() => n.replace('Main')}
    bottom={<View style={{ width: '100%', alignItems: 'center' }}>
      <View style={s.social}>{['logo-google', 'logo-facebook', 'logo-apple'].map(i => <View key={i} style={s.sBtn}><Ionicons name={i} size={20} color="#222" /></View>)}</View>
      <TouchableOpacity style={[s.btn, { marginTop: 60 }]} onPress={() => n.navigate('Register')}><Text style={s.btnT}>Create New Account</Text></TouchableOpacity>
    </View>}>
    <Link t="Forgot Password?" onPress={() => n.navigate('Forgot')} />
  </AuthScreen>
);
export const Register = ({ navigation: n }) => (
  <AuthScreen title="Sign Up" cta="Register" onPress={() => n.replace('Main')}
    fields={[['Username'], ['Email'], ['Password', true], ['Confirm Password', true]]}
    bottom={<Link t="Sudah punya akun? Sign In" onPress={() => n.navigate('Login')} />} />
);
export const Forgot = ({ navigation: n }) => (
  <AuthScreen title="Reset Your Password" cta="Continue" fields={[['Username'], ['Email']]} onPress={() => n.navigate('Reset')} />
);
export const Reset = ({ navigation: n }) => (
  <AuthScreen title="Reset Your Password" cta="Confirm" fields={[['Create New Password', true], ['Confirm Password', true]]} onPress={() => n.popToTop()} />
);

const s = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', padding: 28, paddingTop: 90 },
  logo: { width: 84, height: 84, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', marginVertical: 18, fontSize: 15 },
  input: { width: '100%', backgroundColor: C.field, borderRadius: 8, padding: 12, marginBottom: 12, color: '#fff' },
  link: { color: C.accent, alignSelf: 'flex-start', marginBottom: 14, fontSize: 12 },
  btn: { width: '100%', backgroundColor: '#EDEDED', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
  btnT: { fontWeight: '600', color: '#111' },
  social: { flexDirection: 'row', gap: 14, marginTop: 18 },
  sBtn: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#EDEDED', alignItems: 'center', justifyContent: 'center' },
});
