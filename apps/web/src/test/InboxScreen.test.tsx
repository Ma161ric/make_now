import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestRouter } from './TestRouter';
import InboxScreen from '../screens/InboxScreen';
import * as storage from '../storage';

const testUserId = 'test-user-123';

vi.mock('../auth/authContext', () => ({
  useAuth: () => ({
    user: { id: testUserId, email: 'test@example.com', displayName: 'Test User' },
    firebaseUser: null,
    loading: false,
    error: null,
    isAuthenticated: true,
  }),
}));

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
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Test note' } });
    });

    expect(screen.getByText('9/2000 Zeichen')).toBeInTheDocument();
  });

  it('should reject empty input', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    expect(screen.getByText('Bitte gib eine Notiz ein.')).toBeInTheDocument();
  });

  it('should reject input shorter than 3 characters', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    act(() => {
      fireEvent.change(textarea, { target: { value: 'ab' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    expect(screen.getByText('Notiz muss mindestens 3 Zeichen haben.')).toBeInTheDocument();
  });

  it('should reject input longer than 2000 characters', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    act(() => {
      fireEvent.change(textarea, { target: { value: 'a'.repeat(2001) } });
    });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    expect(screen.getByText('Notiz darf maximal 2000 Zeichen haben.')).toBeInTheDocument();
  });

  it('should trim whitespace from input', async () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    act(() => {
      fireEvent.change(textarea, { target: { value: '  Test note with spaces  ' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Gespeichert. Jetzt prüfen.')).toBeInTheDocument();
    });

    const notes = storage.listNotes(testUserId);
    expect(notes[0].raw_text).toBe('Test note with spaces');
  });

  it('should save note with unprocessed status', async () => {
    act(() => {
      render(
        <TestRouter>
          <InboxScreen />
        </TestRouter>
      );
    });

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Test note' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    // Wait for async submission to complete
    await waitFor(() => {
      const notes = storage.listNotes(testUserId);
      expect(notes).toHaveLength(1);
    });

    const notes = storage.listNotes(testUserId);
    expect(notes[0].status).toBe('unprocessed');
  });

  it('should clear form after successful submission', async () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...') as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Test note' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(textarea.value).toBe('');
      expect(screen.getByText('0/2000 Zeichen')).toBeInTheDocument();
    });
  });

  it('should show success message and save note', async () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Test task for today' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Gespeichert. Jetzt prüfen.')).toBeInTheDocument();
    });

    const notes = storage.listNotes(testUserId);
    expect(notes).toHaveLength(1);
    expect(notes[0].raw_text).toBe('Test task for today');
  });

  it('should display saved notes in list', () => {
    // Pre-populate storage with notes
    storage.addNote(testUserId, 
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

    storage.addNote(testUserId, 
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

    storage.addNote(testUserId, 
      {
        id: 'note-1',
        raw_text: 'First note',
        created_at: oneHourAgo.toISOString(),
        status: 'unprocessed',
      },
      { items: [], questions: [], confidence: 'high' }
    );

    storage.addNote(testUserId, 
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
    
    storage.addNote(testUserId, 
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
    storage.addNote(testUserId, 
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

  it('should accept exactly 3 characters', async () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    act(() => {
      fireEvent.change(textarea, { target: { value: 'abc' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Gespeichert. Jetzt prüfen.')).toBeInTheDocument();
    });
  });

  it('should accept exactly 2000 characters', async () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    const text2000 = 'a'.repeat(2000);
    act(() => {
      fireEvent.change(textarea, { target: { value: text2000 } });
    });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Gespeichert. Jetzt prüfen.')).toBeInTheDocument();
    });
  });

  it('should handle rapid successive inputs', async () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    
    act(() => {
      fireEvent.change(textarea, { target: { value: 'First ' } });
      fireEvent.change(textarea, { target: { value: 'First Second ' } });
      fireEvent.change(textarea, { target: { value: 'First Second Third' } });
    });

    expect(textarea).toHaveValue('First Second Third');
  });

  it('should display sync status', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    expect(screen.getByText('Synced')).toBeInTheDocument();
  });

  it('should show section title', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    expect(screen.getByText('Inbox Capture')).toBeInTheDocument();
  });

  it('should show label for textarea', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    expect(screen.getByLabelText('Freitext Notiz')).toBeInTheDocument();
  });

  it('should show character count update as user types', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Test text here' } });
    });

    expect(screen.getByText('14/2000 Zeichen')).toBeInTheDocument();
  });

  it('should handle note with special characters', async () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Test with äöü and émojis 🎯' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Gespeichert. Jetzt prüfen.')).toBeInTheDocument();
    });
  });

  it('should display multiple notes with different dates', () => {
    const now = new Date();
    const notes: storage.StoredNote[] = [
      {
        id: 'note-1',
        raw_text: 'First note',
        created_at: new Date(now.getTime() - 60000).toISOString(),
        status: 'unprocessed',
      },
      {
        id: 'note-2',
        raw_text: 'Second note',
        created_at: now.toISOString(),
        status: 'unprocessed',
      },
    ];

    notes.forEach(note => {
      storage.addNote(testUserId, note, { items: [], questions: [], confidence: 'high' });
    });

    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    expect(screen.getByText(/First note/)).toBeInTheDocument();
    expect(screen.getByText(/Second note/)).toBeInTheDocument();
  });

  it('should not submit with empty space-only input', () => {
    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText('Notiz eingeben...');
    act(() => {
      fireEvent.change(textarea, { target: { value: '   ' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Speichern' });
    act(() => {
      fireEvent.click(submitButton);
    });

    // Should show validation error for empty/whitespace-only input
    expect(screen.getByText('Bitte gib eine Notiz ein.')).toBeInTheDocument();
  });

  it('should handle very long note preview', () => {
    const longText = 'a'.repeat(150);
    const note: storage.StoredNote = {
      id: 'note-long',
      raw_text: longText,
      created_at: new Date().toISOString(),
      status: 'unprocessed',
    };

    storage.addNote(testUserId, note, { items: [], questions: [], confidence: 'high' });

    render(
      <TestRouter>
        <InboxScreen />
      </TestRouter>
    );

    const preview = 'a'.repeat(80);
    expect(screen.getByText(preview)).toBeInTheDocument();
  });
});
