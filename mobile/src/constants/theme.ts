/**
 * The board's design tokens, ported from the web app's `app/globals.css`.
 *
 * The values there are authored in oklch, which is the right space to *design* in but not one
 * React Native parses reliably across platforms, so they are converted to sRGB hex here. That
 * conversion is the reason this file is the source of truth rather than a re-derivation: if a
 * token changes on the web, convert it again and paste it, don't eyeball a new hex.
 *
 * Neither Typekit face crosses over, because Adobe Fonts does not licence embedding a font in an
 * app binary. They are handled differently, on purpose:
 *
 * - **Luke**, the wordmark, becomes artwork: `src/components/wordmark.tsx` renders an outlined
 *   SVG. It is one fixed string that never changes, so nothing is lost by drawing it once — and
 *   outlines are artwork rather than an embedded font, which sidesteps the licence entirely.
 * - **P22 Stickley**, the headline face, falls back to the platform serif — New York on iOS. A
 *   different voice in the same register, and a deliberate acceptance rather than a gap: buying an
 *   app licence would be the alternative.
 * - **The paper grain**, an inline `feTurbulence` SVG painted behind the page, has no cheap native
 *   equivalent, and a tiled PNG would be a download that can fail offline.
 *
 * What does survive is the part that carries most of the identity: the warm paper ground, square
 * corners, and rules drawn in ink rather than in a grey chosen to disappear.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    /** Paper, not white. Pure white reads as a screen, never as a page. */
    background: '#F9F6F1',
    text: '#1A1511',
    /**
     * Print secondary text is still ink. It takes its hierarchy from size and case, not from
     * fading toward the background, so this is much darker than a typical UI's muted grey.
     */
    textSecondary: '#59514A',
    backgroundElement: '#EEEBE4',
    backgroundSelected: '#EEEBE4',
    /** An actual rule, in ink — meant to be seen. Weight varies; the colour does not. */
    border: '#797065',
    primary: '#AF2D18',
    primaryText: '#FBF8F2',
    success: '#196632',
    destructive: '#B7191C',
  },
  dark: {
    /**
     * "Paper" has no dark equivalent, so dark mode inverts the relationship rather than the
     * palette: the warmth moves onto the type instead of the ground.
     */
    background: '#100C0A',
    text: '#EEEBE5',
    textSecondary: '#A49D95',
    backgroundElement: '#231E1B',
    backgroundSelected: '#231E1B',
    border: '#635C54',
    primary: '#D9553F',
    primaryText: '#FBF8F2',
    success: '#56AE6C',
    destructive: '#E24942',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` — New York, standing in for P22 Stickley. */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Square. Rounded corners are the loudest modern signal after the cards themselves, and print has
 * no equivalent — a rule meets a rule at a right angle. Exported as a named constant so the
 * intent is visible at call sites instead of looking like a forgotten `borderRadius`.
 */
export const Radius = 0;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
