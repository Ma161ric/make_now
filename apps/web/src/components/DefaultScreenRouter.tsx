import { usePreferences } from '../context/PreferencesContext';
import InboxScreen from '../screens/InboxScreen';
import { HeuteScreen } from '../screens/HeuteScreen';
import WeekCalendarScreen from '../screens/WeekCalendarScreen';

export function DefaultScreenRouter() {
  const { preferences } = usePreferences();

  // Show the user's preferred default screen
  switch (preferences.defaultScreen) {
    case 'today':
      return <HeuteScreen />;
    case 'week':
      return <WeekCalendarScreen />;
    case 'notes':
    default:
      return <InboxScreen />;
  }
}
