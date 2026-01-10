import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import InboxScreen from './screens/InboxScreen';
import ReviewScreen from './screens/ReviewScreen';
import TodayScreen from './screens/TodayScreen';
import DailyReviewScreen from './screens/DailyReviewScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SignupScreen } from './screens/SignupScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ThemeProvider } from './theme/themeContext';
import { AuthProvider } from './auth/authContext';
import { ProtectedRoute } from './components/ProtectedRoute';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter 
          basename="/make_now"
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<App />}>
              <Route path="login" element={<LoginScreen />} />
              <Route path="signup" element={<SignupScreen />} />
              <Route index element={<ProtectedRoute><InboxScreen /></ProtectedRoute>} />
              <Route path="review/:id" element={<ProtectedRoute><ReviewScreen /></ProtectedRoute>} />
              <Route path="today" element={<ProtectedRoute><TodayScreen /></ProtectedRoute>} />
              <Route path="daily-review" element={<ProtectedRoute><DailyReviewScreen /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
