import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import { readState } from './store.js';

const scrypt = promisify(scryptCallback);
const sessions = new Map<string, number>();
const SESSION_MS = 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, encoded] = stored.split(':');
  if (!salt || !encoded) return false;
  const expected = Buffer.from(encoded, 'hex');
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function cookies(req: Request): Record<string, string> {
  return Object.fromEntries((req.headers.cookie ?? '').split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2));
}

export function createSession(): string {
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, Date.now() + SESSION_MS);
  return token;
}

export function clearSession(req: Request): void {
  const token = cookies(req).at_session;
  if (token) sessions.delete(token);
}

export function revokeAllSessions(): void {
  sessions.clear();
}

export function isAuthenticated(req: Request): boolean {
  const token = cookies(req).at_session;
  const expires = token ? sessions.get(token) : undefined;
  if (!token || !expires || expires < Date.now()) {
    if (token) sessions.delete(token);
    return false;
  }
  return true;
}

function normalizeIp(value: string): string {
  return value.replace(/^::ffff:/, '').replace(/^\[|\]$/g, '');
}

function ipv4Number(ip: string): number | undefined {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return undefined;
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function sourceMatches(ip: string, rule: string): boolean {
  const normalizedRule = normalizeIp(rule.trim());
  if (!normalizedRule) return false;
  if (!normalizedRule.includes('/')) return ip === normalizedRule;
  const [network, bitsText] = normalizedRule.split('/');
  const bits = Number(bitsText);
  const addressNumber = ipv4Number(ip);
  const networkNumber = ipv4Number(network);
  if (addressNumber === undefined || networkNumber === undefined || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (addressNumber & mask) === (networkNumber & mask);
}

function isLoopback(ip: string): boolean {
  return ip === '::1' || ip === '127.0.0.1';
}

export function isSourceAllowed(rawIp: string, rules: string[]): boolean {
  const ip = normalizeIp(rawIp);
  return isLoopback(ip) || rules.some(rule => sourceMatches(ip, rule));
}

export async function accessGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const state = await readState();
  const ip = normalizeIp(req.ip || req.socket.remoteAddress || '');
  if (state.settings.restrictSources && !isSourceAllowed(ip, state.settings.allowedSources)) {
    res.status(403).json({ error: `当前访问源不在允许列表中：${ip || '未知地址'}` });
    return;
  }
  next();
}

export async function authGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const state = await readState();
  if (!state.settings.authEnabled || isAuthenticated(req)) {
    next();
    return;
  }
  res.status(401).json({ error: '需要登录', code: 'AUTH_REQUIRED' });
}

export function sessionCookie(token: string): string {
  return `at_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}`;
}

export const expiredSessionCookie = 'at_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';
