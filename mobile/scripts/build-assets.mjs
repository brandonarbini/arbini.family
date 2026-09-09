/**
 * Regenerates every PNG in assets/images/ from assets/mark.svg and assets/wordmark-stacked.svg.
 * (The third vector, assets/wordmark.svg, is the single-line masthead and is read by
 * src/components/wordmark.tsx at runtime, not by this script.)
 *
 *   node scripts/build-assets.mjs
 *
 * Run it after editing either source vector, then commit the PNGs — Expo reads
 * the rasters, not the vectors, so the SVGs alone are not enough. The script exists so the icons
 * are *derived* rather than drawn: a colour change is an edit here and one command, not an
 * afternoon in a vector editor and nine files that drift apart.
 *
 * Requires ImageMagick (`brew install imagemagick`). Its internal SVG renderer is used rather
 * than librsvg, which is why the generated SVGs below carry literal hex fills: `currentColor`,
 * which both source files use, is a CSS cascade feature that renderer does not resolve.
 *
 * Colours are the board's tokens, kept in step with src/constants/theme.ts by hand. That file is
 * the source of truth; if a token changes there, change it here too.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'images');
const TMP = mkdtempSync(join(tmpdir(), 'arbini-assets-'));

const PAPER = '#F9F6F1';
const RED = '#AF2D18';
const DARK_GROUND = '#100C0A';
const DARK_RED = '#D9553F';

/**
 * Each source SVG's artwork box, in its own user units. Read from the `viewBox`; duplicated here
 * because these numbers drive the centring maths and a silent mismatch would show up as artwork
 * that is off-centre by a hair rather than as an error.
 */
const MARK = { x: 0, y: 1.2, w: 34.7, h: 38.3 };
const WORDMARK = { x: 0, y: 0, w: 269.12, h: 148.16 };

function pathOf(file) {
  const svg = readFileSync(join(ROOT, 'assets', file), 'utf8');
  const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length === 0) throw new Error(`No <path> found in assets/${file}`);
  return paths;
}

const markPath = pathOf('mark.svg')[0];
const wordmarkPaths = pathOf('wordmark-stacked.svg');

function render(name, width, height, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
  const src = join(TMP, `${name}.svg`);
  writeFileSync(src, svg);
  execFileSync('magick', ['-background', 'none', src, join(OUT, `${name}.png`)]);
  console.log(`assets/images/${name}.png  ${width}x${height}`);
}

/** The mark, centred in a square, scaled so its height is `fraction` of the side. */
function square(name, size, { fraction, fill, background }) {
  const scale = (size * fraction) / MARK.h;
  const w = MARK.w * scale;
  const h = MARK.h * scale;
  const ground = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : '';
  render(
    name,
    size,
    size,
    `${ground}<g transform="translate(${(size - w) / 2},${(size - h) / 2}) scale(${scale}) translate(${-MARK.x},${-MARK.y})"><path d="${markPath}" fill="${fill}"/></g>`,
  );
}

/** The stacked wordmark on a transparent ground, sized by width. */
function wordmark(name, width, fill) {
  const scale = width / WORDMARK.w;
  const height = Math.round(WORDMARK.h * scale);
  const paths = wordmarkPaths.map((d) => `<path d="${d}" fill="${fill}"/>`).join('');
  render(name, width, height, `<g transform="scale(${scale})">${paths}</g>`);
}

// The home-screen icon. iOS masks the corners itself, so these are full-bleed squares with no
// rounding of their own. 0.62 leaves the mark room to breathe inside that mask.
//
// Light is paper on red — the loudest of the colourways we looked at, and the one that stays
// findable on a home screen full of other people's icons. Dark inverts the relationship rather
// than the palette, the same move src/constants/theme.ts makes: the red becomes the figure instead
// of the ground, so the tile recedes in dark mode instead of glowing.
square('icon', 1024, { fraction: 0.62, fill: PAPER, background: RED });
square('icon-dark', 1024, { fraction: 0.62, fill: DARK_RED, background: DARK_GROUND });
// Tinted: iOS derives the tint from luminance, so this is the mark in white on nothing.
square('icon-tinted', 1024, { fraction: 0.62, fill: '#FFFFFF', background: null });

// Android's adaptive icon crops to a shape the launcher chooses, and clips anything outside the
// centre 66%. Hence the smaller fraction here than on iOS — it is a safe zone, not a margin.
square('android-icon-foreground', 512, { fraction: 0.45, fill: PAPER, background: null });
square('android-icon-monochrome', 432, { fraction: 0.45, fill: '#000000', background: null });
render('android-icon-background', 512, 512, `<rect width="512" height="512" fill="${RED}"/>`);

// The splash: the wordmark stacked onto two lines, from assets/wordmark-stacked.svg rather than the
// single-line cut the in-app masthead uses. A launch screen is a whole portrait phone, and a 6.7:1
// sliver of a wordmark leaves almost all of it empty. expo-splash-screen sizes by `imageWidth` in
// points, so 1200px carries the 240pt image past 3x with room to spare.
//
// Only the figure is drawn here; the ground is `backgroundColor` in app.json, which is why these are
// transparent. Together they make the same paper-on-red as the icon in light mode, and dark inverts
// the relationship the same way icon-dark does — red as the figure, so the splash recedes at night
// instead of filling the screen with a flash of it.
wordmark('splash-icon', 1200, PAPER);
wordmark('splash-icon-dark', 1200, DARK_RED);

// Favicon for `expo export --platform web`.
square('favicon', 48, { fraction: 0.72, fill: PAPER, background: RED });
