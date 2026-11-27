import { describe, it, expect } from 'vitest';
import { fromChatProposals, isKnowledge } from '../utils/suggestions';
import { newPerson, withNote, sameName, MAX_NOTES } from '../utils/knowledge';

describe('chat proposals: Gedächtnis und Personen', () => {
  it('turns memory and person notes into suggestions', () => {
    const list = fromChatProposals(
      [
        { kind: 'memory', title: 'Trinkt nur Tee' },
        { kind: 'person_note', title: 'Hat am 3. März Geburtstag', person: ' Lena ', person_id: 'p3' },
        { kind: 'person_note', title: 'ohne Person' },
        { kind: 'task', title: 'Steuer', duration_min_minutes: 30 },
      ],
      'quelle',
      'm1',
    );
    expect(list.map((s) => s.kind)).toEqual(['memory', 'person_note', 'task']);
    expect(list[1]).toMatchObject({ person: 'Lena', person_id: 'p3', msg_id: 'm1', title: 'Hat am 3. März Geburtstag' });
    expect(list.filter(isKnowledge)).toHaveLength(2);
  });

  it('adds notes newest first and stops at the limit', () => {
    let p = withNote(newPerson('  Max  ', 'Kumpel'), 'erste');
    p = withNote(p, 'zweite');
    expect(p.name).toBe('Max');
    expect(p.notes.map((n) => n.text)).toEqual(['zweite', 'erste']);
    expect(() => withNote(p, '   ')).toThrow();
    const full = { ...p, notes: Array.from({ length: MAX_NOTES }, (_, i) => ({ id: String(i), text: 'x', created_at: '' })) };
    expect(() => withNote(full, 'zu viel')).toThrow(/Höchstens/);
  });

  it('matches names without case and extra spaces', () => {
    expect(sameName('max ', 'Max')).toBe(true);
    expect(sameName('Max', 'Maxi')).toBe(false);
  });
});
