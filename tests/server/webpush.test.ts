import { createECDH, createHmac, createDecipheriv, createPublicKey, verify, generateKeyPairSync } from 'node:crypto';
import { encryptPayload, vapidJwt, isPushEndpoint } from '../../api/_lib/webpush.ts';
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d?: unknown) => { c ? pass++ : (fail++, console.log('FAIL', n, d ?? '')); };
const u = (s: string) => Buffer.from(s, 'base64url');
// RFC 8291 Appendix A
const V = {
  plain: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPriv: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPub: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPub: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPriv: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const out = encryptPayload(u(V.plain), V.uaPub, V.auth, { salt: u(V.salt), asPrivate: u(V.asPriv) });
ok('RFC 8291 test vector', out.toString('base64url') === V.body, out.toString('base64url'));

// independent decryption as the browser would do it
function decrypt(body: Buffer, uaPriv: Buffer, authSecret: Buffer) {
  const salt = body.subarray(0, 16); const idlen = body[20]; const asPub = body.subarray(21, 21 + idlen); const ct = body.subarray(21 + idlen);
  const e = createECDH('prime256v1'); e.setPrivateKey(uaPriv); const uaPub = e.getPublicKey();
  const H = (k: Buffer, d: Buffer) => createHmac('sha256', k).update(d).digest();
  const ikm = H(H(authSecret, e.computeSecret(asPub)), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
  const prk = H(salt, ikm);
  const cek = H(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = H(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const d = createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return pt.subarray(0, pt.lastIndexOf(2)).toString();
}
const ua = createECDH('prime256v1'); ua.generateKeys();
const auth = Buffer.from('0123456789abcdef');
const msg = JSON.stringify({ title: 'In 5 Min', body: 'Übungsblatt Algorithmen', url: '/today' });
ok('roundtrip', decrypt(encryptPayload(Buffer.from(msg), ua.getPublicKey().toString('base64url'), auth.toString('base64url')), ua.getPrivateKey(), auth) === msg);

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwt = vapidJwt('https://web.push.apple.com/abc', privateKey);
const [h, b, s] = jwt.split('.');
ok('jwt aud', JSON.parse(u(b).toString()).aud === 'https://web.push.apple.com');
ok('jwt signature', verify('sha256', Buffer.from(`${h}.${b}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, u(s)));
ok('endpoint allowlist', isPushEndpoint('https://web.push.apple.com/x') && isPushEndpoint('https://fcm.googleapis.com/fcm/send/x') && !isPushEndpoint('https://evil.com/x') && !isPushEndpoint('http://web.push.apple.com/x') && !isPushEndpoint('https://web.push.apple.com.evil.com/x'));
console.log(`${pass} passed ${fail} failed`);
