// In-memory stand-in for firebase-admin, enough for planner tests.
export const store = new Map(); // path -> data
let auto = 0;
export class Timestamp {
  constructor(ms) { this.ms = ms; }
  static fromDate(d) { return new Timestamp(d.getTime()); }
  static now() { return new Timestamp(Date.now()); }
  toDate() { return new Date(this.ms); }
  toMillis() { return this.ms; }
  valueOf() { return this.ms; }
}
export const FieldValue = {
  serverTimestamp: () => Timestamp.now(),
  increment: (n) => ({ __inc: n }),
};
const clone = (v) => (v === undefined ? v : structuredClone(v, {}));
function applyPatch(base, patch) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && '__inc' in v) out[k] = (out[k] || 0) + v.__inc;
    else out[k] = v;
  }
  return out;
}
function docRef(path) {
  return {
    id: path.split('/').pop(),
    path,
    async get() { const d = store.get(path); return { exists: !!d, id: path.split('/').pop(), data: () => d && { ...d } }; },
    async set(data, opts) { store.set(path, opts?.merge ? applyPatch(store.get(path), data) : applyPatch({}, data)); },
    async update(patch) { if (!store.has(path)) throw new Error('no doc ' + path); store.set(path, applyPatch(store.get(path), patch)); },
    async delete() { store.delete(path); },
  };
}
const val = (v) => (v instanceof Timestamp ? v.ms : v);
function query(col, filters = [], lim = Infinity) {
  return {
    where(f, op, v) { return query(col, [...filters, [f, op, v]], lim); },
    limit(n) { return query(col, filters, n); },
    async get() {
      const docs = [];
      for (const [p, d] of store) {
        if (!p.startsWith(col + '/') || p.slice(col.length + 1).includes('/')) continue;
        const ok = filters.every(([f, op, v]) => {
          const a = val(d[f]);
          const b = val(v);
          return op === '==' ? a === b : op === '<' ? a < b : op === '>=' ? a >= b : op === '>' ? a > b : op === '<=' ? a <= b : op === 'in' ? b.includes(a) : false;
        });
        if (ok) docs.push({ id: p.split('/').pop(), data: () => ({ ...d }) });
        if (docs.length >= lim) break;
      }
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  };
}
const fakeDb = {
  doc: (p) => docRef(p),
  collection: (col) => ({ ...query(col), doc: (id) => docRef(`${col}/${id || 'auto' + ++auto}`), add: async (d) => { const r = docRef(`${col}/auto${++auto}`); await r.set(d); return r; } }),
};
export const getFirestore = () => fakeDb;
export const initializeApp = () => ({});
export const getApps = () => [{}];
export const cert = () => ({});
export const getAuth = () => ({ verifyIdToken: async () => ({ uid: 'u1' }) });
export const getAppCheck = () => ({ verifyToken: async (t) => { if (t !== 'good-app-token') throw new Error('bad'); return { appId: 'web' }; } });
