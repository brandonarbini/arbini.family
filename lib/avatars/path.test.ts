import { describe, expect, it } from "vitest";
import { beamSvg } from "@/lib/avatars/beam";
import { avatarHash, avatarPath } from "@/lib/avatars/path";

/**
 * The version parameter is a cache-busting promise: a phone that has an avatar on disk will not
 * re-ask for it, so the URL has to move whenever the picture does — and stay still whenever it
 * does not, or every board refresh would re-download five images.
 */

const BRANDON = "46170eb3-046d-4b80-9d3d-b66878703297";
const JILL = "050d1796-68b0-4adf-86b1-7eee0303d48d";

describe("avatarPath", () => {
  it("points at the endpoint for that person", () => {
    expect(avatarPath(BRANDON, "Brandon Arbini")).toMatch(
      new RegExp(`^/api/v1/avatars/${BRANDON}\\?v=[\\w-]+$`),
    );
  });

  it("stays put while the avatar does", () => {
    expect(avatarPath(BRANDON, "Brandon Arbini")).toBe(
      avatarPath(BRANDON, "Brandon Arbini"),
    );
  });

  it("moves when the avatar changes", () => {
    const before = avatarPath(BRANDON, "Brandon Arbini");
    const after = avatarPath(BRANDON, "Brandon Arbini-Smith");

    expect(after).not.toBe(before);
    expect(beamSvg("Brandon Arbini-Smith")).not.toBe(beamSvg("Brandon Arbini"));
  });

  /**
   * The version is a fact about the *picture*, not about the person holding it. Two people who
   * somehow drew the same face would share a version and still have their own URLs — which is
   * what keeps this a cache key rather than a second identity.
   */
  it("versions the picture, not the profile", () => {
    const mine = new URL(avatarPath(BRANDON, "Jill Arbini"), "https://x.test");
    const theirs = new URL(avatarPath(JILL, "Jill Arbini"), "https://x.test");

    expect(mine.pathname).not.toBe(theirs.pathname);
    expect(mine.searchParams.get("v")).toBe(theirs.searchParams.get("v"));
  });

  /**
   * The URL's version and the endpoint's ETag are the same claim about the same bytes. They are
   * one function so they cannot disagree; this is the check that they still are.
   */
  it("versions on the same hash the endpoint sends as its ETag", () => {
    const path = new URL(avatarPath(JILL, "Jill Arbini"), "https://x.test");

    expect(path.searchParams.get("v")).toBe(avatarHash(beamSvg("Jill Arbini")));
  });
});
