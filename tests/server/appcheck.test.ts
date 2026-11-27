// App Check on the API: off unless APPCHECK_ENFORCE=1, then a valid token is required
import { requireUserInfo } from '../../api/_lib/firebaseAdmin.ts';
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
process.env.FIREBASE_SERVICE_ACCOUNT = '{}';
const req = (h: Record<string, string>) => ({ headers: { authorization: 'Bearer x', ...h } }) as any;
const status = async (h: Record<string, string>) => { try { await requireUserInfo(req(h)); return 200; } catch (e: any) { return e.status ?? 500; } };

delete process.env.APPCHECK_ENFORCE;
ok((await status({})) === 200, 'off: request without token works');
ok((await status({ 'x-firebase-appcheck': 'junk' })) === 200, 'off: junk token is ignored');
process.env.APPCHECK_ENFORCE = '1';
ok((await status({})) === 403, 'on: missing token is refused');
ok((await status({ 'x-firebase-appcheck': 'junk' })) === 403, 'on: invalid token is refused');
ok((await status({ 'x-firebase-appcheck': 'good-app-token' })) === 200, 'on: valid token passes');
ok((await (async () => { try { await requireUserInfo({ headers: { 'x-firebase-appcheck': 'good-app-token' } } as any); return 200; } catch (e: any) { return e.status; } })()) === 401, 'on: token alone without login is still 401');
console.log(`${pass} passed ${fail} failed`);
