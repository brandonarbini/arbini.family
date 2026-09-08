import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Four tabs, in the order the web app's nav puts them: the board, where everyone is, the open
 * questions, and the one screen where you change something about yourself.
 *
 * The colours are monochrome on purpose. iOS tints tab bars with the system blue unless told
 * otherwise, and `labelStyle` alone does not override the icon — that is why the first build had
 * blue glyphs under red labels. Both halves have to be set, and the palette this app works in
 * spends colour on the few things worth looking for rather than on its own furniture. So the
 * selected tab is simply full ink and the rest is muted, which is what a masthead nav does.
 *
 * (To spend the accent here instead, `selected` on both `iconColor` and `labelStyle` becomes
 * `colors.primary` — the press red. It is one line, and it is a real choice, not an oversight.)
 */
export default function TabsLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      iconColor={{ default: colors.textSecondary, selected: colors.text }}
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.text },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Board</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="newspaper" drawable="ic_menu_agenda" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="where">
        <NativeTabs.Trigger.Label>Where I am</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="mappin.and.ellipse" drawable="ic_menu_mylocation" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="polls">
        <NativeTabs.Trigger.Label>Polls</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" drawable="ic_menu_sort_by_size" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" drawable="ic_menu_myplaces" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
