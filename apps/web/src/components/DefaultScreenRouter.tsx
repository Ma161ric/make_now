import { usePreferences } from '../context/PreferencesContext';
import InboxScreen from '../screens/InboxScreen';
import TodayScreen from '../screens/TodayScreen';
import WeekCalendarScreen from '../screens/WeekCalendarScreen';

export function DefaultScreenRouter() {
  const { preferences } = usePreferences();

  // Show the user's preferred default screen
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
