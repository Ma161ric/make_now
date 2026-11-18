// Lets the server tests import the TypeScript sources directly:
// './x.js' imports resolve to './x.ts', and firebase-admin is swapped for an in-memory fake.
import { register } from 'node:module';

const fake = new URL('./fake-firebase.mjs', import.meta.url).href;
register(
  'data:text/javascript,' +
    encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('firebase-admin')) return { url: ${JSON.stringify(fake)}, shortCircuit: true };
  if (spec.endsWith('.js') && ctx.parentURL && ctx.parentURL.startsWith('file:')) {
    const u = new URL(spec, ctx.parentURL);
    const ts = fileURLToPath(u).replace(/\\.js$/, '.ts');
    if (existsSync(ts)) return next(u.href.replace(/\\.js$/, '.ts'), ctx);
  }
  return next(spec, ctx);
}`),
);
