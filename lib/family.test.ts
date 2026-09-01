import { describe, expect, it } from "vitest";
import { isFamilyEmail, normalizeEmail, parseFamilyEmails } from "@/lib/family";

const RAW =
  "b@arbini.com, Kim@arbini.family ,tanner@arbini.family,ellie@arbini.family,nico@arbini.family";
const ALLOWED = parseFamilyEmails(RAW);

describe("parseFamilyEmails", () => {
  it("splits, trims and case-folds", () => {
    expect(parseFamilyEmails(RAW).has("kim@arbini.family")).toBe(true);
    expect(parseFamilyEmails(RAW).size).toBe(5);
  });

  it("drops empty entries from sloppy formatting", () => {
    expect(parseFamilyEmails("a@x.com,,  , b@x.com,")).toEqual(
      new Set(["a@x.com", "b@x.com"]),
    );
  });

  it("is empty for an unset or blank value", () => {
    // Empty must mean "admit nobody". A missing variable that silently admitted everyone would
    // turn a deploy misconfiguration into an open door.
    expect(parseFamilyEmails(undefined).size).toBe(0);
    expect(parseFamilyEmails(null).size).toBe(0);
    expect(parseFamilyEmails("").size).toBe(0);
    expect(parseFamilyEmails("   ").size).toBe(0);
  });
});

describe("isFamilyEmail", () => {
  it("admits a listed address", () => {
    expect(isFamilyEmail("tanner@arbini.family", ALLOWED)).toBe(true);
  });

  it("ignores case", () => {
    // A phone keyboard capitalizes the first letter; that must not read as a stranger.
    expect(isFamilyEmail("Tanner@arbini.family", ALLOWED)).toBe(true);
    expect(isFamilyEmail("TANNER@ARBINI.FAMILY", ALLOWED)).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isFamilyEmail("  tanner@arbini.family  ", ALLOWED)).toBe(true);
    expect(isFamilyEmail("\ttanner@arbini.family\n", ALLOWED)).toBe(true);
  });

  it("rejects an address one character off a real one", () => {
    expect(isFamilyEmail("taner@arbini.family", ALLOWED)).toBe(false);
    expect(isFamilyEmail("tanner@arbini.famliy", ALLOWED)).toBe(false);
    expect(isFamilyEmail("tanner@arbini.family.com", ALLOWED)).toBe(false);
    expect(isFamilyEmail("tanner@arbini.famil", ALLOWED)).toBe(false);
  });

  it("rejects plus-addressed and dotted variants of a listed address", () => {
    // Deliberate: Gmail would deliver these to the same mailbox, but folding them here lets
    // anyone who knows one family address mint unlimited passing variants. An allowlist admits
    // only what was literally written down.
    expect(isFamilyEmail("tanner+hub@arbini.family", ALLOWED)).toBe(false);
    expect(isFamilyEmail("t.anner@arbini.family", ALLOWED)).toBe(false);
  });

  it("rejects everything when the allowlist is empty", () => {
    expect(isFamilyEmail("tanner@arbini.family", new Set())).toBe(false);
  });

  it("rejects a missing or blank address", () => {
    expect(isFamilyEmail(undefined, ALLOWED)).toBe(false);
    expect(isFamilyEmail(null, ALLOWED)).toBe(false);
    expect(isFamilyEmail("", ALLOWED)).toBe(false);
    expect(isFamilyEmail("   ", ALLOWED)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Tanner@Arbini.Family ")).toBe(
      "tanner@arbini.family",
    );
  });
});
