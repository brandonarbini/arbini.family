import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Avatar from "boring-avatars";
import { describe, expect, it } from "vitest";
import { FAMILY_PALETTE, beamSvg } from "@/lib/avatars/beam";

/**
 * `lib/avatars/beam.ts` is a port of `boring-avatars`, written out by hand so the avatar can be
 * drawn where React cannot go. This is what keeps the port honest: the library still renders here,
 * in a plain Node test where `react-dom/server` works, and the two outputs have to agree
 * character for character.
 *
 * If this fails after a `boring-avatars` bump, the library changed how it draws — which means
 * every face in the family is about to change. Decide that deliberately; do not paper over it.
 */

const FAMILY = [
  "Brandon Arbini",
  "Jill Arbini",
  "Tanner Arbini",
  "Addison Arbini",
  "Macy Arbini",
];

/** The library's own output, with its generated mask id swapped for the fixed one. */
function libraryMarkup(name: string, size?: number): string {
  const markup = renderToStaticMarkup(
    createElement(Avatar, {
      name,
      variant: "beam",
      colors: FAMILY_PALETTE,
      title: false,
      size,
      // `size` alone cannot say "no intrinsic size" — it falls back to "40px". These land after it
      // in the spread onto the <svg>, so they win.
      width: size,
      height: size,
    }),
  );

  const generated = / id="([^"]+)"/.exec(markup)?.[1];
  return generated ? markup.split(generated).join("avatar-mask") : markup;
}

describe("beamSvg", () => {
  it.each(FAMILY)("draws %s exactly as boring-avatars does", (name) => {
    expect(beamSvg(name)).toBe(libraryMarkup(name));
  });

  it("matches at a fixed size too", () => {
    expect(beamSvg("Jill Arbini", 44)).toBe(libraryMarkup("Jill Arbini", 44));
  });

  /**
   * Names that exercise the branches the family happens not to: an open mouth, a squared wrapper,
   * negative offsets. Deterministic input, so a disagreement here is a real disagreement.
   */
  it.each(["a", "Zoë", "", "person-with-a-very-long-name", "42"])(
    "agrees on the edge case %j",
    (name) => {
      expect(beamSvg(name)).toBe(libraryMarkup(name));
    },
  );

  it("omits width and height unless asked for a size", () => {
    expect(beamSvg("Macy Arbini")).not.toMatch(/\swidth="\d+"\/?>/);
    expect(beamSvg("Macy Arbini", 28)).toContain('width="28" height="28"');
  });

  it("gives every member of the family a distinct dominant colour", () => {
    const wrappers = FAMILY.map(
      // The wrapper — the big rounded rect that is most of the frame — is the second fill.
      (name) => [...beamSvg(name).matchAll(/fill="(#[0-9a-f]{6})"/gi)][1]?.[1],
    );

    expect(new Set(wrappers).size).toBe(FAMILY.length);
  });
});
