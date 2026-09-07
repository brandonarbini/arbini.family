/**
 * Stand-in data for the screens, until the API they read exists.
 *
 * Deliberately shaped like the board's real vocabulary — a gathering that may be absent, presence
 * rows whose place may be unrecorded, agenda entries of three different kinds — so that Stage 3
 * swaps the source without redrawing the screens. The strings are pre-formatted here because
 * formatting is the server's job on the web (`lib/dates.ts` is timezone-pinned to
 * America/Los_Angeles) and will be the server's job over the wire too; the app should not be
 * deciding what "today" means.
 *
 * Delete this file when `/api/v1/board` lands.
 */

export const BOARD_FIXTURE = {
  dateline: 'Sunday 7 September 2026 · Home',

  awaiting: [
    {
      id: 'poll-1',
      title: 'Thanksgiving — Thursday or Saturday?',
      waitingOn: 'Jill is waiting on you',
    },
  ],

  gathering: {
    headline: "12 days until everyone's together",
    when: 'Friday 19 September',
    place: 'Home',
  } as { headline: string; when: string; place: string } | null,

  presence: [
    { profileId: 'p1', name: 'Brandon Arbini', place: 'Home', until: null },
    { profileId: 'p2', name: 'Jill Arbini', place: 'Vanguard', until: '12 Sep' },
    { profileId: 'p3', name: 'Tanner Arbini', place: null, until: null },
    { profileId: 'p4', name: 'Addison Arbini', place: 'Home', until: null },
    { profileId: 'p5', name: 'Macy Arbini', place: 'Home', until: null },
  ] as { profileId: string; name: string; place: string | null; until: string | null }[],

  agenda: [
    { id: 'a1', when: 'Tomorrow', subject: 'Jill', detail: 'is at Vanguard until 12 Sep' },
    { id: 'a2', when: 'Wed 9 Sep', subject: 'Tanner', detail: 'comes home' },
    { id: 'a3', when: 'Fri 19 Sep', subject: 'Everyone', detail: 'is at Home' },
    { id: 'a4', when: 'Thu 2 Oct', subject: 'Brandon', detail: 'turns 47' },
  ],
};

export const WHERE_FIXTURE = {
  dateline: 'Sunday 7 September 2026 · Home',
  stays: [
    { id: 's1', place: 'Home', dates: 'From 1 Sep', note: null, openEnded: true },
    { id: 's2', place: 'Vanguard', dates: '22 Sep – 26 Sep', note: 'work trip', openEnded: false },
  ] as { id: string; place: string; dates: string; note: string | null; openEnded: boolean }[],
};
