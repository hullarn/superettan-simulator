const ADMIN_COOKIE = 'slutspurten_admin_session';
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sessionToken(password: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode('slutspurten-admin-session-v1'));
  return bytesToHex(signature);
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export async function verifyAdminPassword(candidate: string) {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && constantTimeEqual(candidate, expected!);
}

export async function isAdminSessionValid(cookieValue: string | undefined) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !cookieValue) return false;
  return constantTimeEqual(cookieValue, await sessionToken(password));
}

export async function createAdminSessionCookie() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('ADMIN_PASSWORD saknas.');
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=${await sessionToken(password)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearAdminSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function adminCookieName() {
  return ADMIN_COOKIE;
}

export function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const prefix = `${name}=`;
  return cookieHeader.split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

export async function isAdminRequest(request: Request) {
  return isAdminSessionValid(readCookie(request, ADMIN_COOKIE));
}
