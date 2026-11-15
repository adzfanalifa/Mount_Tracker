import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useTheme, makeStyles } from './theme';
import { useApp } from './store';
import { GOOGLE } from './config';
import { ThemeToggle } from './ui';
import { validateLogin, validateRegister, validateForgot, validateReset } from './validation';

WebBrowser.maybeCompleteAuthSession();

// fields: [placeholder, secure, key, keyboardType?]. validate(values) -> pesan error | null.
// onPress(values) boleh async; error yang dilempar ditampilkan di kotak merah.
function AuthScreen({ title, fields, cta, onPress, validate, children, bottom, initial, note }) {
  const { colors } = useTheme();
  const s = useS();
  const [vals, setVals] = useState(initial || {});
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e = validate ? validate(vals) : null;
    setErr(e);
    if (e) return;
    setBusy(true);
    try { await onPress(vals); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={{ backgroundColor: colors.auth }} contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.themeBtn}><ThemeToggle /></View>
      <View style={s.logo}><Ionicons name="triangle" size={44} color={colors.onAccent} /></View>
      <Text style={s.title}>{title}</Text>
      {note ? <Text style={s.note}>{note}</Text> : null}
      {fields.map(([ph, secure, key, kb]) => (
        <TextInput key={key} placeholder={ph} placeholderTextColor={colors.placeholder} secureTextEntry={!!secure} style={s.input} autoCapitalize="none"
          keyboardType={kb || 'default'} editable={!busy}
          value={vals[key] || ''} onChangeText={(v) => { setVals((o) => ({ ...o, [key]: v })); if (err) setErr(null); }} />
      ))}
      {err ? <Text style={s.err}>{err}</Text> : null}
      {children}
      <TouchableOpacity style={[s.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.btnLightText} /> : <Text style={s.btnT}>{cta}</Text>}
      </TouchableOpacity>
      {bottom}
    </ScrollView>
  );
}
const Link = ({ t, onPress, style }) => { const s = useS(); return <TouchableOpacity onPress={onPress}><Text style={[s.link, style]}>{t}</Text></TouchableOpacity>; };

// ------------------------------------------------------------ Login Google
const googleReady = !!(GOOGLE.webClientId || GOOGLE.androidClientId || GOOGLE.iosClientId);

function GoogleButtonReal({ onDone }) {
  const s = useS();
  const { loginGoogle } = useApp();
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE.webClientId || undefined,
    androidClientId: GOOGLE.androidClientId || undefined,
    iosClientId: GOOGLE.iosClientId || undefined,
  });
  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') { if (response.type === 'error') Alert.alert('Login Google gagal', (response.error && response.error.message) || 'Coba lagi'); return; }
    const idToken = response.params && response.params.id_token;
    if (!idToken) { Alert.alert('Login Google gagal', 'Token Google tidak diterima'); return; }
    setBusy(true);
    loginGoogle(idToken).then(onDone).catch((e) => Alert.alert('Login Google gagal', e.message)).finally(() => setBusy(false));
  }, [response]);
  return (
    <TouchableOpacity style={[s.gBtn, (!request || busy) && { opacity: 0.6 }]} disabled={!request || busy} onPress={() => promptAsync()}>
      <Ionicons name="logo-google" size={18} color={s.gText.color} />
      <Text style={s.gText}>{busy ? 'Memproses...' : 'Masuk dengan Google'}</Text>
    </TouchableOpacity>
  );
}

function GoogleButton({ onDone }) {
  const s = useS();
  if (googleReady) return <GoogleButtonReal onDone={onDone} />;
  return (
    <TouchableOpacity style={s.gBtn} onPress={() => Alert.alert('Login Google belum dikonfigurasi',
      'Isi EXPO_PUBLIC_GOOGLE_*_CLIENT_ID di mobile/.env dan GOOGLE_CLIENT_IDS di .env backend. Langkahnya ada di README.')}>
      <Ionicons name="logo-google" size={18} color={s.gText.color} />
      <Text style={s.gText}>Masuk dengan Google</Text>
    </TouchableOpacity>
  );
}

// ------------------------------------------------------------ alamat server (untuk HP)
function ServerBox() {
  const { colors } = useTheme();
  const s = useS();
  const { apiUrl, setApiUrl, testServer, loadMountains } = useApp();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(apiUrl);
  const [busy, setBusy] = useState(false);
  useEffect(() => setUrl(apiUrl), [apiUrl]);
  const save = async () => {
    setBusy(true);
    try {
      await setApiUrl(url);
      const st = await testServer();
      loadMountains().catch(() => {});
      Alert.alert('Terhubung', `${st.app || 'Server'}: database ${st.database}`);
      setOpen(false);
    } catch (e) {
      Alert.alert('Server belum terhubung', e.message);
    } finally { setBusy(false); }
  };
  return (
    <View style={{ width: '100%', marginTop: 24, alignItems: 'center' }}>
      <TouchableOpacity onPress={() => setOpen(!open)}><Text style={s.server}>Server: {apiUrl} <Ionicons name={open ? 'chevron-up' : 'settings-outline'} size={11} color={colors.mute} /></Text></TouchableOpacity>
      {open && (
        <View style={{ width: '100%', marginTop: 8 }}>
          <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" style={s.input} placeholder="http://192.168.1.5:8000" placeholderTextColor={colors.placeholder} />
          <TouchableOpacity style={[s.btn, { marginTop: 0 }]} onPress={save} disabled={busy}><Text style={s.btnT}>{busy ? 'Mengecek...' : 'Simpan & Tes Koneksi'}</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------ layar
export const Login = ({ navigation: n }) => {
  const { login } = useApp();
  const s = useS();
  const go = () => n.reset({ index: 0, routes: [{ name: 'Main' }] });
  return (
    <AuthScreen title="Sign In" cta="Login" fields={[['Email/Username', false, 'identity', 'email-address'], ['Password', true, 'password']]}
      validate={validateLogin} onPress={async (v) => { await login(v); go(); }}
      bottom={<View style={{ width: '100%', alignItems: 'center' }}>
        <Text style={s.or}>atau</Text>
        <GoogleButton onDone={go} />
        <TouchableOpacity style={[s.btn, { marginTop: 40 }]} onPress={() => n.navigate('Register')}><Text style={s.btnT}>Create New Account</Text></TouchableOpacity>
        <ServerBox />
      </View>}>
      <Link t="Forgot Password?" onPress={() => n.navigate('Forgot')} />
    </AuthScreen>
  );
};

export const Register = ({ navigation: n }) => {
  const { register } = useApp();
  return (
    <AuthScreen title="Sign Up" cta="Register" validate={validateRegister}
      onPress={async (v) => { await register(v); n.reset({ index: 0, routes: [{ name: 'Main' }] }); }}
      fields={[['Username', false, 'username'], ['Email', false, 'email', 'email-address'], ['Password', true, 'password'], ['Confirm Password', true, 'confirmPassword']]}
      bottom={<Link t="Sudah punya akun? Sign In" onPress={() => n.navigate('Login')} style={{ alignSelf: 'center', marginTop: 14 }} />} />
  );
};

export const Forgot = ({ navigation: n }) => {
  const { forgot } = useApp();
  return (
    <AuthScreen title="Reset Your Password" cta="Continue" note="Masukkan username dan email akunmu. Kode reset 6 digit akan dikirim ke email."
      fields={[['Username', false, 'username'], ['Email', false, 'email', 'email-address']]}
      validate={validateForgot}
      onPress={async (v) => {
        const d = await forgot(v);
        n.navigate('Reset', { email: v.email.trim(), debugCode: d && d.debugCode });
      }} />
  );
};

export const Reset = ({ navigation: n, route }) => {
  const { reset } = useApp();
  const email = (route.params && route.params.email) || '';
  const debugCode = route.params && route.params.debugCode;
  return (
    <AuthScreen title="Reset Your Password" cta="Confirm"
      note={`Cek email ${email} lalu masukkan kodenya.${debugCode ? `\n(Mode debug server) Kode: ${debugCode}` : ''}`}
      fields={[['Kode 6 digit', false, 'code', 'number-pad'], ['Create New Password', true, 'password'], ['Confirm Password', true, 'confirmPassword']]}
      validate={(v) => (!/^\d{6}$/.test(String(v.code || '').trim()) ? 'Kode reset harus 6 digit angka' : validateReset(v))}
      onPress={async (v) => {
        await reset({ email, code: String(v.code).trim(), newPassword: v.password, confirmPassword: v.confirmPassword });
        Alert.alert('Berhasil', 'Password sudah diganti. Silakan login.', [{ text: 'OK', onPress: () => n.popToTop() }]);
      }} />
  );
};

const useS = makeStyles((c) => ({
  wrap: { flexGrow: 1, alignItems: 'center', padding: 28, paddingTop: 90 },
  themeBtn: { position: 'absolute', top: 48, right: 24 },
  logo: { width: 84, height: 84, borderRadius: 18, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.text, marginVertical: 18, fontSize: 15 },
  note: { color: c.textSoft, fontSize: 12, textAlign: 'center', marginTop: -8, marginBottom: 14 },
  input: { width: '100%', backgroundColor: c.field, borderRadius: 8, padding: 12, marginBottom: 12, color: c.text },
  err: { color: c.errorText, backgroundColor: c.errorBg, alignSelf: 'stretch', padding: 8, borderRadius: 6, marginBottom: 10, fontSize: 12 },
  link: { color: c.accent, alignSelf: 'flex-start', marginBottom: 14, fontSize: 12 },
  btn: { width: '100%', backgroundColor: c.btnLight, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8, minHeight: 44, justifyContent: 'center' },
  btnT: { fontWeight: '600', color: c.btnLightText },
  or: { color: c.textSoft, fontSize: 12, marginTop: 16 },
  gBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', backgroundColor: c.social, borderRadius: 8, padding: 11, marginTop: 10 },
  gText: { color: c.socialIcon, fontWeight: '600' },
  server: { color: c.mute, fontSize: 11 },
}));
