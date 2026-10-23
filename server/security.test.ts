import { describe, expect, it } from 'vitest';
import { hashPassword, isSourceAllowed, verifyPassword } from './security.js';

describe('password security', () => {
  it('stores a salted hash and verifies only the matching password', async () => {
    const hash = await hashPassword('correct-horse');
    expect(hash).not.toContain('correct-horse');
    await expect(verifyPassword('correct-horse', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });
});

describe('source access rules', () => {
  it('supports exact addresses, IPv4 CIDR, mapped IPv4 and the loopback recovery path', () => {
    expect(isSourceAllowed('192.168.1.42', ['192.168.1.0/24'])).toBe(true);
    expect(isSourceAllowed('192.168.2.42', ['192.168.1.0/24'])).toBe(false);
    expect(isSourceAllowed('::ffff:10.0.0.8', ['10.0.0.8'])).toBe(true);
    expect(isSourceAllowed('2001:db8::1', ['2001:db8::1'])).toBe(true);
    expect(isSourceAllowed('127.0.0.1', [])).toBe(true);
  });
});
