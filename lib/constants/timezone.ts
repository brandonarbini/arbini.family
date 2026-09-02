/**
 * The one timezone the family calendar is reckoned in.
 *
 * Everything on the board is a *calendar date* — "Ellie is home from the 20th" — not an instant.
 * A kid signing in from a dorm two timezones away has to see the same "today" their parents see,
 * so "today" is resolved here rather than from the browser or the server's own clock offset.
 *
 * A constant rather than an environment variable on purpose: a family has exactly one home
 * timezone and it does not vary by deployment. If that ever stops being true, this is the only
 * place that has to learn about it.
 */
export const FAMILY_TIMEZONE = "America/Los_Angeles";
