/**
 * Web Push without extra packages (RFC 8291 encryption + RFC 8292 VAPID).
 *
 * The VAPID key pair is created on first use and kept in Firestore
 * (config/vapid, server-only), so no secret has to be set up by hand.
 */
import { createECDH, createHmac, createCipheriv, createPrivateKey, generateKeyPairSync, randomBytes, sign as cryptoSign, type KeyObject } from 'node:crypto';
import { db } from './firebaseAdmin.js';

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushMessage {
  title: string;
  body: string;
  /** where a tap on the notification leads, e.g. /today */
  url?: string;
  /** same tag replaces an older notification instead of stacking */
  tag?: string;
}

const b64u = (b: Buffer) => b.toString('base64url');
const fromB64u = (s: string) => Buffer.from(s, 'base64url');
const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();

// ---------------------------------------------------------------- encryption

/** RFC 8291 aes128gcm body for one push message. salt/asKeys only for tests. */
export function encryptPayload(
  plaintext: Buffer,
  uaPublicB64: string,
  authSecretB64: string,
  opts: { salt?: Buffer; asPrivate?: Buffer } = {}
): Buffer {
  const uaPublic = fromB64u(uaPublicB64);
  const authSecret = fromB64u(authSecretB64);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('Ungültiges Push-Abo');

  const ecdh = createECDH('prime256v1');
  if (opts.asPrivate) ecdh.setPrivateKey(opts.asPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = opts.salt || randomBytes(16);

  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);

  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, ct]);
}

// ---------------------------------------------------------------- VAPID

interface Vapid {
  publicKey: string; // base64url, 65 bytes uncompressed
  privateKey: KeyObject;
}
let cached: Vapid | null = null;

export async function vapid(): Promise<Vapid> {
  if (cached) return cached;
  const ref = db().doc('config/vapid');
  let jwk = (await ref.get()).data() as { x: string; y: string; d: string } | undefined;
  if (!jwk?.d) {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const exported = privateKey.export({ format: 'jwk' }) as { x: string; y: string; d: string };
    // create() fails if another request was faster: then use theirs
    await ref.create({ x: exported.x, y: exported.y, d: exported.d, created_at: new Date() }).catch(() => {});
    jwk = (await ref.get()).data() as { x: string; y: string; d: string };
  }
  const publicKey = b64u(Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)]));
  cached = { publicKey, privateKey: createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }, format: 'jwk' }) };
  return cached;
}

export function vapidJwt(endpoint: string, key: KeyObject, now = Date.now()): string {
  const aud = new URL(endpoint).origin;
  const head = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(Buffer.from(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: 'https://make-now.vercel.app' })));
  const sig = cryptoSign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64u(sig)}`;
}

/** Only real push services (no arbitrary URLs from the client) */
export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return (
      u.protocol === 'https:' &&
      /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.api\.chromium\.org)$/.test(u.hostname)
    );
  } catch {
    return false;
  }
}

export type SendResult = 'ok' | 'gone' | 'error';

export async function sendPush(sub: PushSubscriptionJSON, msg: PushMessage): Promise<SendResult> {
  if (!isPushEndpoint(sub.endpoint)) return 'gone';
  const { publicKey, privateKey } = await vapid();
  const body = encryptPayload(Buffer.from(JSON.stringify(msg)), sub.keys.p256dh, sub.keys.auth);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${vapidJwt(sub.endpoint, privateKey)}, k=${publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '1800',
      Urgency: 'high',
    },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res) return 'error';
  if (res.status === 404 || res.status === 410) return 'gone';
  if (!res.ok) {
    console.warn('[push] failed', res.status, (await res.text().catch(() => '')).slice(0, 200));
    return 'error';
  }
  return 'ok';
}

// ---------------------------------------------------------------- per user

const devices = (uid: string) => db().collection(`push_subscriptions/${uid}/devices`);
const deviceId = (endpoint: string) => createHmac('sha256', 'dayflow').update(endpoint).digest('base64url').slice(0, 32);

export async function saveSubscription(uid: string, sub: PushSubscriptionJSON, userAgent: string): Promise<void> {
  await devices(uid).doc(deviceId(sub.endpoint)).set({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    ua: userAgent.slice(0, 200),
    created_at: new Date(),
  });
}

export async function removeSubscription(uid: string, endpoint: string): Promise<void> {
  await devices(uid).doc(deviceId(endpoint)).delete();
}

export async function countDevices(uid: string): Promise<number> {
  return (await devices(uid).get()).size;
}

/** Sends to all of a user's devices, removes devices that are gone. Returns how many got it. */
export async function pushToUser(uid: string, msg: PushMessage): Promise<number> {
  const snap = await devices(uid).get();
  let sent = 0;
  await Promise.all(
    snap.docs.map(async (d) => {
      const r = await sendPush(d.data() as PushSubscriptionJSON, msg);
      if (r === 'ok') sent++;
      if (r === 'gone') await d.ref.delete().catch(() => {});
    })
  );
  return sent;
}
