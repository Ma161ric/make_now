import React from 'react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Test wrapper for React Router with v7 future flags enabled
 * Prevents warnings during test runs
 */
export const TestRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {children}
    </BrowserRouter>
  );
};
