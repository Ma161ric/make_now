/**
 * What the assistant knows: facts about you (users/{uid}/memories) and the
 * people you mentioned with notes about them (users/{uid}/people).
 * Stored in Firestore only (nothing extra on the device), read by the chat on the server.
 */
import { getDb } from '../firebase/firebaseConfig';
import { uuid } from '../utils';

export const MEMORY_MAX = 300;
export const NAME_MAX = 80;
export const ABOUT_MAX = 200;
export const NOTE_MAX = 500;
export const MAX_MEMORIES = 200;
export const MAX_NOTES = 50;

export interface Memory {
  id: string;
  text: string;
  created_at: string;
  source: 'chat' | 'manual';
}

export interface PersonNote {
  id: string;
  text: string;
  created_at: string;
}

export interface Person {
  id: string;
  name: string;
  about: string;
  notes: PersonNote[];
  created_at: string;
  updated_at: string;
}

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);
export const sameName = (a: string, b: string) => clean(a, NAME_MAX).toLowerCase() === clean(b, NAME_MAX).toLowerCase();
const byNewest = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at);

async function fs() {
  const db = await getDb();
  const m = await import('firebase/firestore');
  return { db, ...m };
}

export async function listMemories(uid: string): Promise<Memory[]> {
  const { db, collection, getDocs } = await fs();
  const snap = await getDocs(collection(db, `users/${uid}/memories`));
  const list: Memory[] = [];
  snap.forEach((d: any) => {
    const x = d.data();
    if (typeof x?.text === 'string') list.push({ id: d.id, text: x.text, created_at: typeof x.created_at === 'string' ? x.created_at : '', source: x.source === 'manual' ? 'manual' : 'chat' });
  });
  return list.sort(byNewest);
}

export async function saveMemory(uid: string, text: string, source: Memory['source'], id = uuid(), created_at = new Date().toISOString()): Promise<Memory> {
  const t = clean(text, MEMORY_MAX);
  if (!t) throw new Error('Leerer Text');
  const { db, doc, setDoc } = await fs();
  const m: Memory = { id, text: t, created_at, source };
  await setDoc(doc(db, `users/${uid}/memories/${id}`), { text: m.text, created_at: m.created_at, source: m.source });
  return m;
}

/** New fact unless the same one is already there */
export async function addMemory(uid: string, text: string, source: Memory['source']): Promise<{ memory: Memory; existed: boolean }> {
  const all = await listMemories(uid);
  const found = all.find((m) => m.text.toLowerCase() === clean(text, MEMORY_MAX).toLowerCase());
  if (found) return { memory: found, existed: true };
  if (all.length >= MAX_MEMORIES) throw new Error(`Höchstens ${MAX_MEMORIES} Einträge. Lösch unter „Wissen“ ein paar alte.`);
  return { memory: await saveMemory(uid, text, source), existed: false };
}

export async function deleteMemory(uid: string, id: string): Promise<void> {
  const { db, doc, deleteDoc } = await fs();
  await deleteDoc(doc(db, `users/${uid}/memories/${id}`));
}

export async function listPeople(uid: string): Promise<Person[]> {
  const { db, collection, getDocs } = await fs();
  const snap = await getDocs(collection(db, `users/${uid}/people`));
  const list: Person[] = [];
  snap.forEach((d: any) => {
    const x = d.data();
    if (typeof x?.name !== 'string' || !x.name.trim()) return;
    list.push({
      id: d.id,
      name: x.name,
      about: typeof x.about === 'string' ? x.about : '',
      notes: (Array.isArray(x.notes) ? x.notes : []).filter((n: any) => typeof n?.text === 'string').map((n: any) => ({ id: String(n.id || uuid()), text: n.text, created_at: typeof n.created_at === 'string' ? n.created_at : '' })).sort(byNewest),
      created_at: typeof x.created_at === 'string' ? x.created_at : '',
      updated_at: typeof x.updated_at === 'string' ? x.updated_at : '',
    });
  });
  return list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function savePerson(uid: string, p: Person): Promise<Person> {
  const name = clean(p.name, NAME_MAX);
  if (!name) throw new Error('Name fehlt');
  const out: Person = { ...p, name, about: clean(p.about, ABOUT_MAX), notes: p.notes.slice(0, MAX_NOTES).map((n) => ({ ...n, text: n.text.trim().slice(0, NOTE_MAX) })), updated_at: new Date().toISOString() };
  const { db, doc, setDoc } = await fs();
  await setDoc(doc(db, `users/${uid}/people/${p.id}`), { name: out.name, about: out.about, notes: out.notes, created_at: out.created_at, updated_at: out.updated_at });
  return out;
}

export function newPerson(name: string, about = ''): Person {
  const now = new Date().toISOString();
  return { id: uuid(), name: clean(name, NAME_MAX), about: clean(about, ABOUT_MAX), notes: [], created_at: now, updated_at: now };
}

export function withNote(p: Person, text: string): Person {
  const t = text.trim().slice(0, NOTE_MAX);
  if (!t) throw new Error('Leere Notiz');
  if (p.notes.length >= MAX_NOTES) throw new Error(`Höchstens ${MAX_NOTES} Notizen pro Person. Lösch ein paar alte.`);
  return { ...p, notes: [{ id: uuid(), text: t, created_at: new Date().toISOString() }, ...p.notes] };
}

/**
 * A note from the chat: to the person with that id, or to the one person with that name,
 * or to a new person. Several people with the same name and no id: the newest one is not
 * guessed, a new entry is not made either; the caller gets an error to ask.
 */
export async function addPersonNote(uid: string, note: { person: string; person_id?: string; text: string }): Promise<Person> {
  const people = await listPeople(uid);
  let p = note.person_id ? people.find((x) => x.id === note.person_id) : undefined;
  if (!p) {
    const matches = people.filter((x) => sameName(x.name, note.person));
    if (matches.length > 1) throw new Error(`Es gibt mehrere „${clean(note.person, NAME_MAX)}“. Sag im Chat, welche Person gemeint ist.`);
    p = matches[0];
  }
  return savePerson(uid, withNote(p || newPerson(note.person), note.text));
}

export async function deletePerson(uid: string, id: string): Promise<void> {
  const { db, doc, deleteDoc } = await fs();
  await deleteDoc(doc(db, `users/${uid}/people/${id}`));
}
