import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock localStorage - define directly on globalThis
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
  key(index: number) {
    const keys = Object.keys(this.data);
    return keys[index] || null;
  },
  get length() {
    return Object.keys(this.data).length;
  },
};

// @ts-ignore
globalThis.localStorage = localStorageMock;

// Mock window.matchMedia
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
});
