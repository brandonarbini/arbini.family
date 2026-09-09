import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Four tabs, in the order the web app's nav puts them: the board, who is around, the open
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

      <NativeTabs.Trigger name="around">
        <NativeTabs.Trigger.Label>Around</NativeTabs.Trigger.Label>
        {/*
          A calendar, not a map pin. The pin was iconography for a model that has been retired —
          nothing here is about location any more, and a glyph that says otherwise is the first
          thing anybody reads.
        */}
        <NativeTabs.Trigger.Icon sf="calendar" drawable="ic_menu_my_calendar" />
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
