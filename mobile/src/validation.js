// Validasi input modul pengguna (login, daftar, lupa & reset password).
// Setiap fungsi mengembalikan pesan error pertama, atau null jika valid.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[A-Za-z0-9_.]{3,30}$/;
export const PASSWORD_MIN = 6;

const t = (v) => String(v ?? '').trim();

export const isEmail = (v) => EMAIL_RE.test(t(v));
export const isUsername = (v) => USERNAME_RE.test(t(v));

export function validateLogin({ identity, password }) {
  if (!t(identity)) return 'Email/username wajib diisi';
  if (t(identity).includes('@') ? !isEmail(identity) : !isUsername(identity)) return 'Email/username tidak valid';
  if (!password) return 'Password wajib diisi';
  return null;
}

function validatePasswordPair(password, confirm) {
  if (!password || String(password).length < PASSWORD_MIN) return `Password minimal ${PASSWORD_MIN} karakter`;
  if (password !== confirm) return 'Konfirmasi password tidak sama';
  return null;
}

export function validateRegister({ username, email, password, confirmPassword }) {
  if (!isUsername(username)) return 'Username 3-30 karakter (huruf, angka, _ atau .)';
  if (!isEmail(email)) return 'Format email tidak valid';
  return validatePasswordPair(password, confirmPassword);
}

export function validateForgot({ username, email }) {
  if (!isUsername(username)) return 'Username tidak valid';
  if (!isEmail(email)) return 'Format email tidak valid';
  return null;
}

export function validateReset({ password, confirmPassword }) {
  return validatePasswordPair(password, confirmPassword);
}