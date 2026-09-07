import WordmarkSvg from '@/assets/wordmark.svg';
import { useTheme } from '@/hooks/use-theme';

/**
 * The masthead wordmark: "Arbini Family" set in Luke and converted to outlines.
 *
 * Vector rather than type, because Adobe Fonts — where Luke is licensed — does not permit
 * embedding a font in an app binary. Outlining sidesteps that entirely: the result is artwork, not
 * a font. It costs nothing here because this is the one string in the app that never changes.
 *
 * Sized by width alone; the height follows from the asset's own proportions. Keep the ratio below
 * in step with the `viewBox` in `assets/wordmark.svg` — they are two halves of one measurement,
 * and a mismatch shows up as a wordmark that is subtly squashed rather than as an error.
 */
const WORDMARK_ASPECT_RATIO = 310.59 / 46.21;

export function Wordmark({ width = 260 }: { width?: number }) {
  const theme = useTheme();

  return (
    // `color` is what the asset's `fill="currentColor"` resolves against — the seam that lets one
    // file be ink on paper in light mode and paper on ink in dark, with no second export.
    <WordmarkSvg
      width={width}
      height={width / WORDMARK_ASPECT_RATIO}
      color={theme.text}
      // The glyphs are the mark; a screen reader should hear the name, not twelve paths.
      accessibilityRole="image"
      accessibilityLabel="Arbini Family"
    />
  );
}
