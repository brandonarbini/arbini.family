/**
 * A person's avatar: a Boring Avatars "beam", drawn from their name.
 *
 * Deterministic from the name, which is the whole appeal: the same person gets the same face on
 * every device, forever, without anybody uploading a photo. That is also why nothing here takes a
 * colour — identity comes from the name, so `Profile.color` is not read.
 *
 * SVG markup rather than a React component, and that is the load-bearing decision. The Expo app
 * cannot run `boring-avatars` — it is React-DOM-and-SVG, and React Native is neither — so the
 * server draws the avatar and sends it as an image, from `/api/v1/avatars`. A route handler is
 * compiled in the react-server layer, where `react-dom/server` and the app's React are two
 * different copies of React: rendering a component with `useId` in one throws
 * "Cannot read properties of null". A string generator has no such layer to be on the wrong side
 * of, so one function serves the endpoint, the web, and anything later that wants a face in a
 * place React cannot reach.
 *
 * The geometry below is a port of `boring-avatars` v2.0.4 (MIT), which stays a devDependency for
 * exactly one purpose: `beam.test.ts` renders it and asserts this file agrees, so the port is
 * checked rather than claimed.
 */

/**
 * Bright on purpose. Everything around these is ink on paper, so the avatars are the one place
 * colour appears — five saturated marks that tell the rows apart at a glance and keep the page
 * from reading as a pastiche.
 *
 * One palette for the whole family, which is how these are meant to be used: the *name* is what
 * makes each avatar distinct, so a shared set of colours leaves the five of them looking like one
 * family rather than five unrelated stickers.
 *
 * **Nine entries, not five.** A beam takes its dominant colour from `colors[hash % len]`, so with
 * five colours and five people the hashes collide: Brandon, Jill and Tanner all landed on the same
 * gold. Nine is the shortest length at which all five of the current names come out distinct — sky,
 * blue, lime, magenta and coral, in board order. That is tuned to the names in `prisma/roster.ts`;
 * rename somebody and the assignment reshuffles, possibly onto a shared colour. Nothing breaks if
 * that happens, so it is a nicety rather than an invariant — but it is why the list is not shorter.
 *
 * The hot/cool alternation is taste. It once carried a rationale about neighbouring indices
 * appearing together, which is not true of a beam: the ground behind the face comes from
 * `colors[(hash + 13) % len]`, four places along at nine colours, and shows only as a sliver at
 * the edges where the face is rotated off-centre.
 */
export const FAMILY_PALETTE = [
  "#ff5e5b", // coral
  "#00c2a8", // turquoise
  "#ffb400", // gold
  "#3d7bff", // blue
  "#ffd166", // butter
  "#c34fd9", // magenta
  "#7ed957", // lime
  "#ff8c42", // orange
  "#2ec4f1", // sky
];

/** The coordinate system every beam is drawn in. Everything below is in these units. */
const SIZE = 36;
const CENTRE = SIZE / 2;

/**
 * The mask id, fixed rather than generated.
 *
 * `boring-avatars` takes it from `useId()`, which is right for a page with several avatars on it.
 * Here it is a constant, for two reasons. A standalone `.svg` is parsed as real XML by whatever
 * decodes it on a phone, and React 19.0 emitted ids like `«r0»` — not a legal XML name, and a mask
 * reference that fails to resolve turns the circle back into a square, silently. And the bytes stay
 * stable, which is what makes the ETag on `/api/v1/avatars` mean anything.
 *
 * Repeating on a web page is harmless: every mask here is the same 36×36 rounded rect, so a
 * duplicate id resolves to a mask identical to the one it shadows.
 */
const MASK_ID = "avatar-mask";

/**
 * One person's avatar as SVG markup.
 *
 * With no `size`, the result carries a viewBox and no intrinsic dimensions — one document that
 * scales to whatever draws it, which is what the API endpoint wants. With a size, it is fixed at
 * that many pixels, which is what an inline avatar on the web wants.
 */
export function beamSvg(name: string, size?: number): string {
  const beam = generate(name, FAMILY_PALETTE);
  const dimensions =
    size === undefined ? "" : ` width="${size}" height="${size}"`;

  return (
    `<svg viewBox="0 0 ${SIZE} ${SIZE}" fill="none" role="img" xmlns="http://www.w3.org/2000/svg"${dimensions}>` +
    `<mask id="${MASK_ID}" maskUnits="userSpaceOnUse" x="0" y="0" width="${SIZE}" height="${SIZE}">` +
    // rx far larger than the box: the renderer clamps it to half the width, which is a circle.
    `<rect width="${SIZE}" height="${SIZE}" rx="${SIZE * 2}" fill="#FFFFFF"></rect>` +
    `</mask>` +
    `<g mask="url(#${MASK_ID})">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="${beam.backgroundColor}"></rect>` +
    // The face: a rounded rect turned off-centre, which is why the ground behind it shows at all.
    `<rect x="0" y="0" width="${SIZE}" height="${SIZE}" transform="translate(${beam.translateX} ${beam.translateY}) rotate(${beam.rotate} ${CENTRE} ${CENTRE}) scale(${beam.scale})" fill="${beam.wrapperColor}" rx="${beam.isCircle ? SIZE : SIZE / 6}"></rect>` +
    `<g transform="translate(${beam.faceTranslateX} ${beam.faceTranslateY}) rotate(${beam.faceRotate} ${CENTRE} ${CENTRE})">` +
    (beam.isMouthOpen
      ? `<path d="M15 ${19 + beam.mouthSpread}c2 1 4 1 6 0" stroke="${beam.faceColor}" fill="none" stroke-linecap="round"></path>`
      : `<path d="M13,${19 + beam.mouthSpread} a1,0.75 0 0,0 10,0" fill="${beam.faceColor}"></path>`) +
    `<rect x="${14 - beam.eyeSpread}" y="14" width="1.5" height="2" rx="1" stroke="none" fill="${beam.faceColor}"></rect>` +
    `<rect x="${20 + beam.eyeSpread}" y="14" width="1.5" height="2" rx="1" stroke="none" fill="${beam.faceColor}"></rect>` +
    `</g>` +
    `</g>` +
    `</svg>`
  );
}

/**
 * Every number in one face, derived from one hash of the name.
 *
 * Ported verbatim from `boring-avatars`, down to the constants that look arbitrary — `+ 13` for
 * the ground colour, `< 5 ? n + 4` for the offsets. They are arbitrary. Changing one is not a
 * refactor: it gives every person in the family a different face.
 */
function generate(name: string, colors: string[]) {
  const hash = hashCode(name);
  const wrapperColor = colorAt(hash, colors);

  // Nudged away from centre when the offset is small, so a face is never quite square in frame.
  const rawX = unit(hash, 10, 1);
  const translateX = rawX < 5 ? rawX + SIZE / 9 : rawX;
  const rawY = unit(hash, 10, 2);
  const translateY = rawY < 5 ? rawY + SIZE / 9 : rawY;

  return {
    wrapperColor,
    // Black or white, whichever the face can be read against.
    faceColor: contrast(wrapperColor),
    backgroundColor: colorAt(hash + 13, colors),
    translateX,
    translateY,
    rotate: unit(hash, 360),
    scale: 1 + unit(hash, SIZE / 12) / 10,
    isMouthOpen: isEvenDigit(hash, 2),
    isCircle: isEvenDigit(hash, 1),
    eyeSpread: unit(hash, 5),
    mouthSpread: unit(hash, 3),
    faceRotate: unit(hash, 10, 3),
    // A face already pushed off-centre follows the wrapper rather than wandering further.
    faceTranslateX: translateX > SIZE / 6 ? translateX / 2 : unit(hash, 8, 1),
    faceTranslateY: translateY > SIZE / 6 ? translateY / 2 : unit(hash, 7, 2),
  };
}

/** Java's `String.hashCode`, folded to 32 bits and made positive. */
function hashCode(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/** The digit `place` positions from the right — the hash read as a pool of decimal digits. */
function digit(value: number, place: number): number {
  return Math.floor((value / Math.pow(10, place)) % 10);
}

function isEvenDigit(value: number, place: number): boolean {
  return digit(value, place) % 2 === 0;
}

/**
 * A number in `[0, range)`, optionally signed by a digit of the hash. Place 0 means unsigned —
 * `boring-avatars` leans on the index being falsy there, and so does this.
 */
function unit(value: number, range: number, place?: number): number {
  const magnitude = value % range;
  return place && isEvenDigit(value, place) ? -magnitude : magnitude;
}

function colorAt(value: number, colors: string[]): string {
  return colors[value % colors.length];
}

/** Perceived-brightness contrast, the same weighting `boring-avatars` uses. */
function contrast(hex: string): string {
  const value = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? "#000000" : "#FFFFFF";
}
