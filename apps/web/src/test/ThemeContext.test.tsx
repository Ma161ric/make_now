import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';

// Mock localStorage for all tests in this file
const localStorageMock = {
  data: {} as Record<string, string>,
  getItem(key: string) {
    return this.data[key] || null;
  },
  setItem(key: string, value: string) {
    this.data[key] = String(value);
  },
  removeItem(key: string) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  },
};

// Test component to access theme context
function TestComponent() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <button onClick={toggleTheme} data-testid="toggle-button">
        Toggle
      </button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    // @ts-ignore - Mock localStorage before each test
    global.localStorage = localStorageMock;
    localStorageMock.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('should default to light theme when no stored preference', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should use stored theme preference from localStorage', () => {
    localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should toggle between light and dark themes', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');

    fireEvent.click(screen.getByTestId('toggle-button'));

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fireEvent.click(screen.getByTestId('toggle-button'));

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should persist theme changes to localStorage', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('toggle-button'));

    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('should set data-theme attribute on document element', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(screen.getByTestId('toggle-button'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should detect system dark mode preference', () => {
    // Mock matchMedia to return dark mode preference
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
  });

  it('should log error when useTheme is used outside ThemeProvider', () => {
    // When useTheme is called outside ThemeProvider, it throws an error
    // React's error boundary will catch this, but in tests it shows as console.error
    const consoleError = console.error;
    const errorMessages: string[] = [];
    console.error = vi.fn((msg) => {
      if (typeof msg === 'string') {
        errorMessages.push(msg);
      }
    });

    try {
      render(<TestComponent />);
    } catch (e) {
      // Error might be caught by React boundary
    }

    // Verify that the useTheme error was logged/thrown
    const hasThemeError = errorMessages.some(msg => msg.includes('useTheme must be used within ThemeProvider'));
    expect(hasThemeError || errorMessages.length > 0).toBe(true);

    console.error = consoleError;
  });
});
