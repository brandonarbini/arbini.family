import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Three tabs, in the order the web app's nav puts them: the board, the open questions, and the
 * one screen where you change something about yourself.
 *
 * There were four. "Around" drew the same fourteen days the board already drew, in the same three
 * marks, as buttons — one tab was a photograph of the other, and the app's most frequent action
 * began by leaving the screen that asked for it. The board now carries both.
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

      <NativeTabs.Trigger name="polls">
        <NativeTabs.Trigger.Label>Asks</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" drawable="ic_menu_sort_by_size" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" drawable="ic_menu_myplaces" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
