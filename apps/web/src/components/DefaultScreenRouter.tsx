import { usePreferences } from '../context/PreferencesContext';
import { InboxNeuScreen } from '../screens/AufgabenScreen';
import { HeuteScreen } from '../screens/HeuteScreen';
import { WocheScreen } from '../screens/WocheScreen';

export function DefaultScreenRouter() {
  const { preferences } = usePreferences();

  // Show the user's preferred default screen
  switch (preferences.defaultScreen) {
    case 'today':
      return <HeuteScreen />;
    case 'week':
      return <WocheScreen />;
    case 'notes':
    default:
      return <InboxNeuScreen />;
  }
}
