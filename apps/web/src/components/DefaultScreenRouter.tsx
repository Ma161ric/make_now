import { usePreferences } from '../context/PreferencesContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import InboxScreen from '../screens/InboxScreen';
import TodayScreen from '../screens/TodayScreen';
import WeekCalendarScreen from '../screens/WeekCalendarScreen';

export function DefaultScreenRouter() {
  const { preferences } = usePreferences();
  const navigate = useNavigate();

  useEffect(() => {
    if (preferences.defaultScreen === 'notes') {
      navigate('/inbox', { replace: true });
    } else {
      navigate(`/${preferences.defaultScreen}`, { replace: true });
    }
  }, [preferences.defaultScreen, navigate]);

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
