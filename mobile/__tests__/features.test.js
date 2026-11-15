import { validateLogin, validateRegister, validateForgot, validateReset } from '../src/validation';
import { parseMountains, fetchMountains, normalizeUrl } from '../src/dataSync';
import { runSelfTests, summarize, CASES, TEST_GROUPS } from '../src/selftest';
import { Mountain } from '../src/models';

describe('Validasi akses pengguna', () => {
  test('login kosong ditolak', () => expect(validateLogin({ identity: '', password: '' })).toMatch('wajib'));
  test('login username valid', () => expect(validateLogin({ identity: 'pendaki_1', password: 'x' })).toBeNull());
  test('login email valid', () => expect(validateLogin({ identity: 'a@b.co', password: 'x' })).toBeNull());
  test('login email rusak ditolak', () => expect(validateLogin({ identity: 'a@b', password: 'x' })).not.toBeNull());
  test('login tanpa password ditolak', () => expect(validateLogin({ identity: 'pendaki', password: '' })).toMatch('Password'));
  const reg = (o = {}) => validateRegister({ username: 'pendaki', email: 'a@b.co', password: 'rahasia', confirmPassword: 'rahasia', ...o });
  test('register valid', () => expect(reg()).toBeNull());
  test('username pendek ditolak', () => expect(reg({ username: 'ab' })).toMatch('Username'));
  test('email salah ditolak', () => expect(reg({ email: 'salah' })).toMatch('email'));
  test('password pendek ditolak', () => expect(reg({ password: '123', confirmPassword: '123' })).toMatch('minimal'));
  test('konfirmasi beda ditolak', () => expect(reg({ confirmPassword: 'lain123' })).toMatch('Konfirmasi'));
  test('forgot & reset', () => {
    expect(validateForgot({ username: 'pendaki', email: 'a@b.co' })).toBeNull();
    expect(validateReset({ password: 'abcdef', confirmPassword: 'abcdef' })).toBeNull();
  });
});

describe('Pembaruan data gunung', () => {
  const good = [{ id: 1, name: 'Gede', elevationMdpl: 2958, difficulty: 'easy', trails: ['Gede via Cibodas'] }];
  const res = (status, body) => async () => ({ ok: status < 300, status, json: async () => body });

  test('parse data valid jadi Mountain', () => {
    const [m] = parseMountains(good);
    expect(m).toBeInstanceOf(Mountain);
    expect(m.id).toBe('1');
  });
  test('daftar kosong ditolak', () => expect(() => parseMountains([])).toThrow('kosong'));
  test('bukan array ditolak', () => expect(() => parseMountains({})).toThrow());
  test('kesulitan tidak dikenal ditolak', () => expect(() => parseMountains([{ ...good[0], difficulty: 'hard' }])).toThrow('kesulitan'));
  test('id ganda ditolak', () => expect(() => parseMountains([good[0], good[0]])).toThrow('ganda'));
  test('url dinormalisasi', () => expect(normalizeUrl(' http://1.2.3.4:8000/ ')).toBe('http://1.2.3.4:8000'));
  test('url tanpa http ditolak', () => expect(() => normalizeUrl('server')).toThrow());
  test('fetch sukses memanggil /mountains', async () => {
    const f = jest.fn(res(200, good));
    const list = await fetchMountains('http://x.id/', { fetchImpl: f });
    expect(f.mock.calls[0][0]).toBe('http://x.id/mountains');
    expect(list).toHaveLength(1);
  });
  test('jaringan putus', async () => {
    await expect(fetchMountains('http://x.id', { fetchImpl: async () => { throw new TypeError('fail'); } })).rejects.toThrow('terhubung');
  });
  test('status 404', async () => expect(fetchMountains('http://x.id', { fetchImpl: res(404, {}) })).rejects.toThrow('404'));
});

describe('Status pengujian (self-test)', () => {
  test('semua kasus lulus', async () => {
    const r = await runSelfTests();
    const failed = r.filter((x) => !x.pass);
    expect(failed).toEqual([]);
    expect(summarize(r)).toEqual({ total: CASES.length, passed: CASES.length, failed: 0 });
  });
  test('setiap grup punya kasus', () => TEST_GROUPS.forEach((g) => expect(CASES.some((c) => c[0] === g)).toBe(true)));
  test('kasus yang melempar error dicatat gagal', async () => {
    const [r] = await runSelfTests([['Input', 'x', () => { throw new Error('boom'); }]]);
    expect(r.pass).toBe(false);
    expect(r.error).toBe('boom');
  });
});