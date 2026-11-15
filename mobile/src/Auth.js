import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from './theme';
import { useApp } from './store';
import { validateLogin, validateRegister, validateForgot, validateReset } from './validation';

// fields: [placeholder, secure, key]. validate(values) -> pesan error | null. onPress dipanggil hanya jika valid.
function AuthScreen({ title, fields, cta, onPress, validate, children, bottom }) {
  const [vals, setVals] = useState({});
  const [err, setErr] = useState(null);
  const submit = () => {
    const e = validate ? validate(vals) : null;
    setErr(e);
    if (!e) onPress(vals);
  };
  return (
    <ScrollView style={{ backgroundColor: C.auth }} contentContainerStyle={s.wrap}>
      <View style={s.logo}><Ionicons name="triangle" size={44} color="#fff" /></View>
      <Text style={s.title}>{title}</Text>
      {fields.map(([ph, secure, key]) => (
        <TextInput key={key} placeholder={ph} placeholderTextColor="#D5E1E3" secureTextEntry={!!secure} style={s.input} autoCapitalize="none"
          value={vals[key] || ''} onChangeText={(v) => { setVals((o) => ({ ...o, [key]: v })); if (err) setErr(null); }} />
      ))}
      {err ? <Text style={s.err}>{err}</Text> : null}
      {children}
      <TouchableOpacity style={s.btn} onPress={submit}><Text style={s.btnT}>{cta}</Text></TouchableOpacity>
      {bottom}
    </ScrollView>
  );
}
const Link = ({ t, onPress }) => <TouchableOpacity onPress={onPress}><Text style={s.link}>{t}</Text></TouchableOpacity>;

export const Login = ({ navigation: n }) => { const { login } = useApp(); return (
  <AuthScreen title="Sign In" cta="Login" fields={[['Email/Username', false, 'identity'], ['Password', true, 'password']]}
    validate={validateLogin} onPress={(v) => { login(v); n.replace('Main'); }}
    bottom={<View style={{ width: '100%', alignItems: 'center' }}>
      <View style={s.social}>{['logo-google', 'logo-facebook', 'logo-apple'].map(i => <View key={i} style={s.sBtn}><Ionicons name={i} size={20} color="#222" /></View>)}</View>
      <TouchableOpacity style={[s.btn, { marginTop: 60 }]} onPress={() => n.navigate('Register')}><Text style={s.btnT}>Create New Account</Text></TouchableOpacity>
    </View>}>
    <Link t="Forgot Password?" onPress={() => n.navigate('Forgot')} />
  </AuthScreen>
); };
export const Register = ({ navigation: n }) => { const { register } = useApp(); return (
  <AuthScreen title="Sign Up" cta="Register" onPress={(v) => { register(v); n.replace('Main'); }} validate={validateRegister}
    fields={[['Username', false, 'username'], ['Email', false, 'email'], ['Password', true, 'password'], ['Confirm Password', true, 'confirmPassword']]}
    bottom={<Link t="Sudah punya akun? Sign In" onPress={() => n.navigate('Login')} />} />
); };
export const Forgot = ({ navigation: n }) => (
  <AuthScreen title="Reset Your Password" cta="Continue" fields={[['Username', false, 'username'], ['Email', false, 'email']]}
    validate={validateForgot} onPress={() => n.navigate('Reset')} />
);
export const Reset = ({ navigation: n }) => (
  <AuthScreen title="Reset Your Password" cta="Confirm" fields={[['Create New Password', true, 'password'], ['Confirm Password', true, 'confirmPassword']]}
    validate={validateReset} onPress={() => n.popToTop()} />
);

const s = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', padding: 28, paddingTop: 90 },
  logo: { width: 84, height: 84, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', marginVertical: 18, fontSize: 15 },
  input: { width: '100%', backgroundColor: C.field, borderRadius: 8, padding: 12, marginBottom: 12, color: '#fff' },
  err: { color: '#FFD2D2', backgroundColor: '#7A2E2E', alignSelf: 'stretch', padding: 8, borderRadius: 6, marginBottom: 10, fontSize: 12 },
  link: { color: C.accent, alignSelf: 'flex-start', marginBottom: 14, fontSize: 12 },
  btn: { width: '100%', backgroundColor: '#EDEDED', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
  btnT: { fontWeight: '600', color: '#111' },
  social: { flexDirection: 'row', gap: 14, marginTop: 18 },
  sBtn: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#EDEDED', alignItems: 'center', justifyContent: 'center' },
});