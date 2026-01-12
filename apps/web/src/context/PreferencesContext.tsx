import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../auth/authContext';

interface SchedulingLimits {
  max_long_tasks: number;    // 60-120 min
  max_middle_tasks: number;  // 20-60 min
  max_short_tasks: number;   // 5-20 min
}

interface UserPreferences {
  defaultScreen: 'notes' | 'today' | 'week';
  timezone: string;
  schedulingLimits: SchedulingLimits;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultScreen: 'today',
  timezone: typeof Intl !== 'undefined' 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : 'Europe/Berlin',
  schedulingLimits: {
    max_long_tasks: 3,
    max_middle_tasks: 6,
    max_short_tasks: 8,
  },
};

interface PreferencesContextType {
  preferences: UserPreferences;
  setPreferences: (prefs: UserPreferences) => void;
  updateDefaultScreen: (screen: 'notes' | 'today' | 'week') => void;
  updateTimezone: (tz: string) => void;
  updateSchedulingLimits: (limits: SchedulingLimits) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferencesState] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Load preferences from localStorage
  useEffect(() => {
    if (user?.id) {
      const stored = localStorage.getItem(`prefs-${user.id}`);
      if (stored) {
        try {
          setPreferencesState(JSON.parse(stored));
        } catch (e) {
          setPreferencesState(DEFAULT_PREFERENCES);
        }
      }
    }
  }, [user?.id]);

  const setPreferences = (prefs: UserPreferences) => {
    setPreferencesState(prefs);
    if (user?.id) {
      localStorage.setItem(`prefs-${user.id}`, JSON.stringify(prefs));
    }
  };

  const updateDefaultScreen = (screen: 'notes' | 'today' | 'week') => {
    setPreferences({ ...preferences, defaultScreen: screen as 'notes' | 'today' | 'week' });
  };

  const updateTimezone = (tz: string) => {
    setPreferences({ ...preferences, timezone: tz });
  };

  const updateSchedulingLimits = (limits: SchedulingLimits) => {
    setPreferences({ ...preferences, schedulingLimits: limits });
  };

  return (
    <PreferencesContext.Provider value={{ preferences, setPreferences, updateDefaultScreen, updateTimezone, updateSchedulingLimits }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}
