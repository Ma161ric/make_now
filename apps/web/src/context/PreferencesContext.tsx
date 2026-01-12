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
  maxHoursPerDay: number;    // 1-12 hours, default 8
  schedulingLimits: SchedulingLimits;
}

const calculateTaskLimits = (maxHoursPerDay: number): SchedulingLimits => {
  // Estimate based on available hours:
  // Long task (60-120 min): average 90 min
  // Middle task (20-60 min): average 40 min  
  // Short task (5-20 min): average 12 min
  const minutesPerDay = maxHoursPerDay * 60;
  
  // Cap to reasonable maximums
  const maxLong = Math.max(1, Math.floor(minutesPerDay / 120));
  const maxMiddle = Math.max(2, Math.floor((minutesPerDay * 0.6) / 40));
  const maxShort = Math.max(3, Math.floor((minutesPerDay * 0.3) / 12));
  
  return {
    max_long_tasks: Math.min(5, maxLong),
    max_middle_tasks: Math.min(10, maxMiddle),
    max_short_tasks: Math.min(15, maxShort),
  };
};

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultScreen: 'today',
  timezone: typeof Intl !== 'undefined' 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : 'Europe/Berlin',
  maxHoursPerDay: 8,
  schedulingLimits: calculateTaskLimits(8),
};

interface PreferencesContextType {
  preferences: UserPreferences;
  setPreferences: (prefs: UserPreferences) => void;
  updateDefaultScreen: (screen: 'notes' | 'today' | 'week') => void;
  updateTimezone: (tz: string) => void;
  updateMaxHoursPerDay: (hours: number) => void;
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

  const updateMaxHoursPerDay = (hours: number) => {
    const clamped = Math.max(1, Math.min(12, hours));
    const newLimits = calculateTaskLimits(clamped);
    setPreferences({ ...preferences, maxHoursPerDay: clamped, schedulingLimits: newLimits });
  };

  const updateSchedulingLimits = (limits: SchedulingLimits) => {
    setPreferences({ ...preferences, schedulingLimits: limits });
  };

  return (
    <PreferencesContext.Provider value={{ preferences, setPreferences, updateDefaultScreen, updateTimezone, updateMaxHoursPerDay, updateSchedulingLimits }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    console.warn('[PreferencesContext] Hook used outside Provider, returning defaults');
    return {
      preferences: DEFAULT_PREFERENCES,
      setPreferences: () => {},
      updateDefaultScreen: () => {},
      updateTimezone: () => {},
      updateMaxHoursPerDay: () => {},
      updateSchedulingLimits: () => {},
    };
  }
  return context;
}
