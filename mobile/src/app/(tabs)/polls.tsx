import type { PollDto, PollOptionDto, ReplyKindDto } from '@server/api/v1/dto';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Page } from '@/components/page';
import { Copy, RuledList, Section } from '@/components/section';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { formatShortDay } from '@/lib/dates';
import { useAnswerPoll, useMe, usePolls } from '@/lib/queries';

/**
 * The ballots: what has been asked, and what you said.
 *
 * Answering is the whole point of this screen on a phone — asking is a desk job, and settling is
 * a decision somebody makes once. Both stay on the web until there is a reason to move them.
 */
export default function PollsScreen() {
  const { data, isPending, error, refetch, isRefetching } = usePolls();

  if (isPending) return <Page dateline="Loading">{null}</Page>;

  if (error) {
    return (
      <Page dateline="Not loaded">
        <Section title="Polls">
          <Copy muted>
            {error instanceof ApiError
              ? error.message
              : 'Could not reach the board. It may be the network.'}
          </Copy>
        </Section>
      </Page>
    );
  }

  if (data.length === 0) {
    return (
      <Page dateline="Polls">
        <Section title="Nothing asked">
          <Copy muted>
            When somebody asks the family a question, it turns up here. Start one on the website.
          </Copy>
        </Section>
      </Page>
    );
  }

  // Anything still waiting on this person comes first: it is the only thing on the board that
  // asks the reader for something rather than telling them something.
  const ordered = [...data].sort((a, b) => Number(b.awaitingYou) - Number(a.awaitingYou));

  return (
    <Page
      dateline="Polls"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {ordered.map((poll) => (
        <Poll key={poll.id} poll={poll} />
      ))}
    </Page>
  );
}

function Poll({ poll }: { poll: PollDto }) {
  const settled = poll.status === 'SETTLED';

  return (
    <Section title={poll.title}>
      <Copy muted style={styles.subhead}>
        {settled ? 'Settled' : poll.awaitingYou ? 'Waiting on you' : 'Answered'}
        {poll.askedByName ? ` · asked by ${poll.askedByName.split(' ')[0]}` : ''}
        {poll.placeName ? ` · at ${poll.placeName}` : ''}
      </Copy>

      <RuledList>
        {poll.options.map((option) => (
          <Option key={option.id} pollId={poll.id} option={option} locked={settled} />
        ))}
      </RuledList>

      {settled ? (
        <Copy muted style={styles.locked}>
          The answer is in — the board has been updated to match.
        </Copy>
      ) : null}
    </Section>
  );
}

const ANSWERS: { kind: ReplyKindDto; label: string }[] = [
  { kind: 'YES', label: 'YES' },
  { kind: 'MAYBE', label: 'MAYBE' },
  { kind: 'NO', label: 'NO' },
];

function Option({
  pollId,
  option,
  locked,
}: {
  pollId: string;
  option: PollOptionDto;
  locked: boolean;
}) {
  const theme = useTheme();
  const answer = useAnswerPoll();
  const { data: me } = useMe();

  /**
   * Who has not answered, with the reader named as "you".
   *
   * Telling Brandon "Waiting on Brandon" is the same third-person slip the server already avoids
   * for `askedByName` — it reads as a bug rather than as a fact. The viewer goes first, because
   * the one name on that list you can do something about is your own.
   */
  const waitingOn = option.silentNames
    .map((name) => (me && name === me.name ? 'you' : name.split(' ')[0]))
    .sort((a, b) => (a === 'you' ? -1 : b === 'you' ? 1 : 0));

  const dates =
    option.startsOn === option.endsOn
      ? formatShortDay(option.startsOn)
      : `${formatShortDay(option.startsOn)} – ${formatShortDay(option.endsOn)}`;

  return (
    <View>
      <View style={styles.optionHead}>
        <Copy style={styles.dates}>{dates}</Copy>
        {option.isSettled ? (
          <Text style={[styles.chosen, { color: theme.success, borderColor: theme.success }]}>
            CHOSEN
          </Text>
        ) : option.everyoneCanMake ? (
          // Not "nobody said no": silence is not consent, and a date declared possible because
          // three people ignored it would be wrong in the way that matters most.
          <Text style={[styles.chosen, { color: theme.success, borderColor: theme.success }]}>
            ALL YES
          </Text>
        ) : null}
      </View>

      <Copy muted style={styles.tally}>
        {[
          option.yesNames.length ? `${option.yesNames.length} yes` : null,
          option.maybeNames.length ? `${option.maybeNames.length} maybe` : null,
          option.noNames.length ? `${option.noNames.length} no` : null,
          option.silentNames.length ? `${option.silentNames.length} silent` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Copy>

      {waitingOn.length > 0 && !locked ? (
        <Copy muted style={styles.waitingOn}>
          Waiting on {waitingOn.join(', ')}
        </Copy>
      ) : null}

      {locked ? null : (
        <View style={styles.answers}>
          {ANSWERS.map(({ kind, label }) => {
            const selected = option.myReply === kind;
            return (
              <Pressable
                key={kind}
                disabled={answer.isPending}
                onPress={() =>
                  answer.mutate({
                    pollId,
                    optionId: option.id,
                    // Tapping your own answer again takes it back — you become silent, which the
                    // tally counts separately from a no.
                    kind: selected ? null : kind,
                  })
                }
                style={({ pressed }) => [
                  styles.answer,
                  {
                    borderColor: selected ? theme.text : theme.border,
                    backgroundColor: selected ? theme.text : 'transparent',
                    opacity: answer.isPending ? 0.4 : pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.answerLabel,
                    { color: selected ? theme.background : theme.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
          {answer.isPending ? (
            <ActivityIndicator style={styles.spinner} color={theme.textSecondary} />
          ) : null}
        </View>
      )}

      {answer.error ? (
        <Copy style={[styles.error, { color: theme.destructive }]}>
          {answer.error instanceof ApiError
            ? answer.error.message
            : 'That answer didn’t go through.'}
        </Copy>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  subhead: {
    marginTop: -Spacing.two,
    marginBottom: Spacing.three,
    fontSize: 14,
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dates: {
    fontSize: 18,
  },
  chosen: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    letterSpacing: 1.4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    overflow: 'hidden',
  },
  tally: {
    fontSize: 14,
  },
  waitingOn: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  answers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  answer: {
    borderRadius: Radius,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  answerLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  spinner: {
    marginLeft: Spacing.two,
  },
  error: {
    marginTop: Spacing.two,
    fontSize: 14,
  },
  locked: {
    marginTop: Spacing.three,
    fontSize: 14,
  },
});
