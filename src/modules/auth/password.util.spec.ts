import { hashPassword, verifyPassword } from './password.util';

describe('Password Security Utilities (password.util)', () => {
  it('generates unique salt and hash for the same password', () => {
    const password = 'SuperSecretPassword123!';
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);

    expect(hash1).not.toEqual(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(hash2).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
  });

  it('correctly verifies valid password against generated hash', () => {
    const password = 'CorrectHorseBatteryStaple!9';
    const hash = hashPassword(password);

    expect(verifyPassword(password, hash)).toBe(true);
  });

  it('rejects incorrect passwords', () => {
    const password = 'MySecurePassword!';
    const hash = hashPassword(password);

    expect(verifyPassword('WrongPassword!', hash)).toBe(false);
    expect(verifyPassword('mysecurepassword!', hash)).toBe(false);
    expect(verifyPassword('', hash)).toBe(false);
  });

  it('safely rejects malformed or truncated hashes without crashing', () => {
    expect(verifyPassword('test', '')).toBe(false);
    expect(verifyPassword('test', 'malformed_hash_no_colon')).toBe(false);
    expect(verifyPassword('test', '1234:invalid_hex_string_zzz')).toBe(false);
    expect(verifyPassword('test', 'deadbeef:1234')).toBe(false);
  });
});
