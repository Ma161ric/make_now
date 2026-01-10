import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth, AuthProvider } from '../auth/authContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with no user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should signup with email and password', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signup('test@example.com', 'password123', 'Test User');
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.user?.email).toBe('test@example.com');
    expect(result.current.user?.displayName).toBe('Test User');
    expect(result.current.user?.provider).toBe('email');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should login with email and password', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.user?.email).toBe('test@example.com');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should reject empty signup fields', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.signup('', '', '');
      } catch (err) {
        // Expected
      }
    });

    expect(result.current.error).toBe('Alle Felder sind erforderlich');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should reject short password', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.signup('test@example.com', '123', 'Test');
      } catch (err) {
        // Expected
      }
    });

    expect(result.current.error).toBe('Passwort muss mindestens 6 Zeichen lang sein');
  });

  it('should login with Google', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginWithGoogle();
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.user?.provider).toBe('google');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should login with Apple', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginWithApple();
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.user?.provider).toBe('apple');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should persist user to localStorage after login', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    const stored = localStorage.getItem('auth_user');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).email).toBe('test@example.com');
  });

  it('should restore user from localStorage on mount', () => {
    const mockUser = {
      id: 'user_123',
      email: 'test@example.com',
      displayName: 'Test User',
      provider: 'email' as const,
    };
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should logout and clear user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('auth_user')).toBeNull();
  });
});
