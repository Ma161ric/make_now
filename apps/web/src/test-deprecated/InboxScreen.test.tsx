/**
 * InboxScreen Component Tests
 * Tests core functionality: note capture, extraction, error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import InboxScreen from './InboxScreen';
import { AuthProvider } from '../auth/authContext';
import { PreferencesProvider } from '../context/PreferencesContext';

// Mock dependencies
vi.mock('../storage', () => ({
  addNote: vi.fn().mockResolvedValue(undefined),
  listNotes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../hooks/useSyncEffect', () => ({
  useDataMigration: vi.fn(),
  useDayPlanSync: vi.fn(),
}));

vi.mock('../hooks/useLiveNotes', () => ({
  useLiveNotes: vi.fn().mockReturnValue([]),
}));

vi.mock('@make-now/core', () => ({
  extractFromNoteMock: vi.fn().mockReturnValue({
    items: [
      { type: 'task', title: 'Test Task', duration_min: 30, duration_max: 60, confidence: 0.9 },
    ],
    overall_confidence: 0.9,
  }),
  validateExtraction: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}));

// Wrapper component for context providers
function RenderWithProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PreferencesProvider>{children}</PreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('InboxScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders inbox capture form', () => {
    render(<InboxScreen />, { wrapper: RenderWithProviders });
    
    expect(screen.getByText('Inbox Capture')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /freitext notiz/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /speichern/i })).toBeInTheDocument();
  });

  it('validates minimum character length', async () => {
    render(<InboxScreen />, { wrapper: RenderWithProviders });
    
    const textarea = screen.getByRole('textbox', { name: /freitext notiz/i });
    const submitBtn = screen.getByRole('button', { name: /speichern/i });

    fireEvent.change(textarea, { target: { value: 'ab' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/mindestens 3 zeichen/i)).toBeInTheDocument();
    });
  });

  it('validates maximum character length', async () => {
    render(<InboxScreen />, { wrapper: RenderWithProviders });
    
    const textarea = screen.getByRole('textbox', { name: /freitext notiz/i });
    const submitBtn = screen.getByRole('button', { name: /speichern/i });

    fireEvent.change(textarea, { target: { value: 'a'.repeat(2001) } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/maximal 2000 zeichen/i)).toBeInTheDocument();
    });
  });

  it('displays error when save fails', async () => {
    const { addNote } = await import('../storage');
    vi.mocked(addNote).mockRejectedValueOnce(new Error('Network error'));

    render(<InboxScreen />, { wrapper: RenderWithProviders });
    
    const textarea = screen.getByRole('textbox', { name: /freitext notiz/i });
    const submitBtn = screen.getByRole('button', { name: /speichern/i });

    fireEvent.change(textarea, { target: { value: 'Valid note here' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/speichern fehlgeschlagen/i)).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    const { addNote } = await import('../storage');
    vi.mocked(addNote).mockRejectedValueOnce(new Error('Network error'));

    render(<InboxScreen />, { wrapper: RenderWithProviders });
    
    const textarea = screen.getByRole('textbox', { name: /freitext notiz/i });
    const submitBtn = screen.getByRole('button', { name: /speichern/i });

    fireEvent.change(textarea, { target: { value: 'Valid note here' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nochmal versuchen/i })).toBeInTheDocument();
    });
  });

  it('displays success message after successful save', async () => {
    render(<InboxScreen />, { wrapper: RenderWithProviders });
    
    const textarea = screen.getByRole('textbox', { name: /freitext notiz/i });
    const submitBtn = screen.getByRole('button', { name: /speichern/i });

    fireEvent.change(textarea, { target: { value: 'Valid note here' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/gespeichert/i)).toBeInTheDocument();
    });
  });

  it('clears textarea after successful save', async () => {
    render(<InboxScreen />, { wrapper: RenderWithProviders });
    
    const textarea = screen.getByRole('textbox', { name: /freitext notiz/i }) as HTMLTextAreaElement;
    const submitBtn = screen.getByRole('button', { name: /speichern/i });

    fireEvent.change(textarea, { target: { value: 'Valid note here' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('displays character count', () => {
    render(<InboxScreen />, { wrapper: RenderWithProviders });
    
    const textarea = screen.getByRole('textbox', { name: /freitext notiz/i });
    
    fireEvent.change(textarea, { target: { value: 'Test' } });
    
    expect(screen.getByText('4/2000')).toBeInTheDocument();
  });

  it('disables submit button while syncing', async () => {
    render(<InboxScreen />, { wrapper: RenderWithProviders });
    
    const textarea = screen.getByRole('textbox', { name: /freitext notiz/i });
    const submitBtn = screen.getByRole('button', { name: /speichern/i });

    fireEvent.change(textarea, { target: { value: 'Valid note here' } });
    fireEvent.click(submitBtn);

    // Button should be disabled during sync
    expect(submitBtn).toBeDisabled();
  });
});
