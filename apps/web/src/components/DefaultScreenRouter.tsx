import { usePreferences } from '../context/PreferencesContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import InboxScreen from '../screens/InboxScreen';
import TodayScreen from '../screens/TodayScreen';
import WeekCalendarScreen from '../screens/WeekCalendarScreen';

export function DefaultScreenRouter() {
  const { preferences } = usePreferences();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect on initial load, not when preferences change
    if (!hasRedirected.current) {
      hasRedirected.current = true;
      if (preferences.defaultScreen === 'notes') {
        navigate('/inbox', { replace: true });
      } else {
        navigate(`/${preferences.defaultScreen}`, { replace: true });
      }
    }
  }, [navigate]);

  // Show inbox by default while loading preferences
  switch (preferences.defaultScreen) {
    case 'today':
      return <TodayScreen />;
    case 'week':
      return <WeekCalendarScreen />;
    case 'notes':
    default:
      return <InboxScreen />;
  }
}
