import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { AufgabenScreen } from './screens/AufgabenScreen';
import { AssistentScreen } from './screens/AssistentScreen';
import { HeuteScreen } from './screens/HeuteScreen';
import { WocheScreen } from './screens/WocheScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SignupScreen } from './screens/SignupScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { PrivacyPolicyScreen } from './screens/PrivacyPolicyScreen';
import { TermsOfServiceScreen } from './screens/TermsOfServiceScreen';
import { ThemeProvider } from './theme/themeContext';
import { AuthProvider } from './auth/authContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OnboardingGuard } from './components/OnboardingGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { watchForUpdates } from './utils/appUpdate';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <PreferencesProvider>
            <BrowserRouter 
            basename="/"
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Routes>
              <Route path="/" element={<App />}>
                <Route path="login" element={<LoginScreen />} />
                <Route path="signup" element={<SignupScreen />} />
                <Route path="onboarding" element={<ProtectedRoute><OnboardingScreen /></ProtectedRoute>} />
                <Route path="privacy" element={<PrivacyPolicyScreen />} />
                <Route path="terms" element={<TermsOfServiceScreen />} />
                <Route index element={<ProtectedRoute><OnboardingGuard><AssistentScreen /></OnboardingGuard></ProtectedRoute>} />
                <Route path="week" element={<ProtectedRoute><OnboardingGuard><WocheScreen /></OnboardingGuard></ProtectedRoute>} />
                <Route path="today" element={<ProtectedRoute><OnboardingGuard><HeuteScreen /></OnboardingGuard></ProtectedRoute>} />
                <Route path="tasks" element={<ProtectedRoute><OnboardingGuard><AufgabenScreen /></OnboardingGuard></ProtectedRoute>} />
                <Route path="chat" element={<Navigate to="/" replace />} />
                <Route path="settings" element={<ProtectedRoute><OnboardingGuard><SettingsScreen /></OnboardingGuard></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          </PreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
      </ErrorBoundary>
  </React.StrictMode>
);

// Installable app (PWA): register the service worker in production builds
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
  // back from the background after a deploy: switch to the new version at a calm moment
  watchForUpdates();
}
