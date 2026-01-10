import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestRouter } from './TestRouter';
import InboxScreen from '../screens/InboxScreen';
import * as storage from '../storage';

vi.mock('@make-now/core', async () => {
  const actual = await vi.importActual('@make-now/core');
  return {
    ...actual,
    extractFromNoteMock: vi.fn(() => ({
      items: [
        {
          type: 'task',
          title: 'Test task',
          duration_minutes: 30,
        },
      ],
      questions: [],
      confidence: 'high' as const,
    })),
    validateExtraction: vi.fn(() => ({ valid: true })),
  };
});

describe('InboxScreen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render inbox capture form', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    expect(screen.getByText('Inbox Capture')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Notiz eingeben...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
  });

  it('should show character counter', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    fireEvent.change(textarea, { target: { value: 'Test note' } });

    expect(screen.getByText('9/2000 Zeichen')).toBeInTheDocument();
  });

  it('should reject empty input', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    fireEvent.click(submitButton);

    expect(screen.getByText('Bitte gib eine Notiz ein.')).toBeInTheDocument();
  });

  it('should reject input shorter than 3 characters', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    fireEvent.change(textarea, { target: { value: 'ab' } });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    fireEvent.click(submitButton);

    expect(screen.getByText('Notiz muss mindestens 3 Zeichen haben.')).toBeInTheDocument();
  });

  it('should reject input longer than 2000 characters', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    const longText = 'a'.repeat(2001);
    fireEvent.change(textarea, { target: { value: longText } });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    fireEvent.click(submitButton);

    expect(screen.getByText('Notiz darf maximal 2000 Zeichen haben.')).toBeInTheDocument();
  });

  it('should trim whitespace from input', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    fireEvent.change(textarea, { target: { value: '  Test note with spaces  ' } });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    fireEvent.click(submitButton);

    expect(screen.getByText('Gespeichert. Jetzt prüfen.')).toBeInTheDocument();

    const notes = storage.listNotes();
    expect(notes[0].raw_text).toBe('Test note with spaces');
  });

  it('should save note with unprocessed status', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    fireEvent.change(textarea, { target: { value: 'Test note' } });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    fireEvent.click(submitButton);

    const notes = storage.listNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].status).toBe('unprocessed');
  });

  it('should clear form after successful submission', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Test note' } });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    fireEvent.click(submitButton);

    expect(textarea.value).toBe('');
    expect(screen.getByText('0/2000 Zeichen')).toBeInTheDocument();
  });

  it('should show success message and save note', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    fireEvent.change(textarea, { target: { value: 'Test task for today' } });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    fireEvent.click(submitButton);

    expect(screen.getByText('Gespeichert. Jetzt prüfen.')).toBeInTheDocument();

    const notes = storage.listNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].raw_text).toBe('Test task for today');
  });

  it('should display saved notes in list', () => {
    // Pre-populate storage with notes
    storage.addNote(
      {
        id: 'note-1',
        raw_text: 'First task',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      },
      {
        items: [],
        questions: [],
        confidence: 'high',
      }
    );

    storage.addNote(
      {
        id: 'note-2',
        raw_text: 'Second task',
        created_at: new Date(Date.now() - 60000).toISOString(),
        status: 'unprocessed',
      },
      {
        items: [],
        questions: [],
        confidence: 'high',
      }
    );

    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    expect(screen.getByText(/First task/)).toBeInTheDocument();
    expect(screen.getByText(/Second task/)).toBeInTheDocument();
  });

  it('should display notes in reverse chronological order', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    storage.addNote(
      {
        id: 'note-1',
        raw_text: 'First note',
        created_at: oneHourAgo.toISOString(),
        status: 'unprocessed',
      },
      { items: [], questions: [], confidence: 'high' }
    );

    storage.addNote(
      {
        id: 'note-2',
        raw_text: 'Second note (newer)',
        created_at: now.toISOString(),
        status: 'unprocessed',
      },
      { items: [], questions: [], confidence: 'high' }
    );

    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0]).toHaveTextContent('Second note (newer)');
    expect(listItems[1]).toHaveTextContent('First note');
  });

  it('should show note preview (first 80 characters)', () => {
    const longText = 'a'.repeat(100);
    
    storage.addNote(
      {
        id: 'note-1',
        raw_text: longText,
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      },
      { items: [], questions: [], confidence: 'high' }
    );

    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const preview = 'a'.repeat(80);
    expect(screen.getByText(preview)).toBeInTheDocument();
  });

  it('should provide review link for each note', () => {
    storage.addNote(
      {
        id: 'note-1',
        raw_text: 'Test note',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      },
      { items: [], questions: [], confidence: 'high' }
    );

    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const reviewLink = screen.getByRole('link', { name: 'Review' });
    expect(reviewLink).toHaveAttribute('href', '/review/note-1');
  });

  it('should show no notes message when list is empty', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    expect(screen.getByText('Keine Notizen vorhanden.')).toBeInTheDocument();
  });

  it('should accept exactly 3 characters', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    fireEvent.change(textarea, { target: { value: 'abc' } });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    fireEvent.click(submitButton);

    expect(screen.getByText('Gespeichert. Jetzt prüfen.')).toBeInTheDocument();
  });

  it('should accept exactly 2000 characters', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    const text2000 = 'a'.repeat(2000);
    fireEvent.change(textarea, { target: { value: text2000 } });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    fireEvent.click(submitButton);

    expect(screen.getByText('Gespeichert. Jetzt prüfen.')).toBeInTheDocument();
  });
});
