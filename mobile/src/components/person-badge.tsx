import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

import { useAuthCookie } from '@/hooks/use-auth-cookie';
import { useTheme } from '@/hooks/use-theme';
import { env } from '@/lib/env';

/**
 * A person's avatar, fetched from the board.
 *
 * The picture comes from `/api/v1/avatars/{profileId}` rather than being drawn here. The generator
 * is `lib/avatars/beam.ts` on the server, and it stays there on purpose: an avatar ported into
 * this app would be frozen into whatever binary was shipped, so restyling them — or letting
 * somebody use an actual photograph — would be wrong on every installed phone until it was
 * rebuilt. Behind a URL, both are a deploy, and the phone and the browser cannot drift.
 *
 * The URL comes off the board rather than being assembled here, because it carries a version. The
 * cache below keys on the URL and will not re-ask the server about a file it already holds, so a
 * new face has to arrive at a new address or it never arrives at all.
 *
 * Round, which is the one place this app breaks its own rule about corners (`Radius` is 0, and
 * everything else here is square). The web has drawn these as circles since the beginning, and two
 * clients disagreeing about a person's face is worse than one exception to a house style.
 */
export function PersonBadge({
  profileId,
  avatarPath,
  size = 40,
  style,
}: {
  profileId: string;
  /**
   * The versioned path the server sent alongside this person. Absent only if the board is older
   * than the field, which the fallback below covers — and which costs nothing but the version.
   */
  avatarPath?: string;
  size?: number;
  /** For the caller that dims a row — see the poll options. */
  style?: StyleProp<ImageStyle>;
}) {
  const theme = useTheme();
  const { data: cookie } = useAuthCookie();

  return (
    <Image
      // Null until the keychain answers, which is a frame or two on a cold start. The style below
      // holds the space either way, so nothing moves when the face arrives.
      source={
        cookie
          ? {
              uri: `${env.apiUrl}${avatarPath ?? `/api/v1/avatars/${profileId}`}`,
              headers: { Cookie: cookie },
            }
          : null
      }
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          // Doubles as the placeholder: an empty disc in the paper's own grey, rather than a hole.
          backgroundColor: theme.backgroundElement,
        },
        style,
      ]}
      contentFit="cover"
      // Long enough to read as a fade rather than a flicker, short enough not to feel like a load.
      transition={150}
      cachePolicy="memory-disk"
      // The name is rendered as text beside every one of these; announcing it again would just
      // make a screen reader say it twice.
      accessible={false}
    />
  );
}
