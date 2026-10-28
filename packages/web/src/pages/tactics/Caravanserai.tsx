import {useState} from 'react';
import type {ReactNode} from 'react';
import {Button, Paper, Stack, Text} from '@mantine/core';
import {HEROES, HERO_PORTRAIT, PASSIVES, RULES, healthOf} from '@canvas/games-silk-road-run';
import type {
  FightState,
  PassiveId,
  PassivePick,
  Provision,
  StatId,
  Unit,
} from '@canvas/games-silk-road-run';
import {PALETTE_VARS} from './TacticsPanels';
import styles from './TacticsPage.module.css';

const STATS: {stat: StatId; label: string}[] = [
  {stat: 'speed', label: 'Speed'},
  {stat: 'power', label: 'Power'},
  {stat: 'defence', label: 'Defence'},
];

/** What `n` stat points do, under the choices once picked. */
const STAT_RULE: Record<StatId, (n: number) => string> = {
  speed: () => 'Its card comes round the track sooner, so it acts more often.',
  power: (n) => `Each of its abilities deals ${n} more damage.`,
  defence: (n) => `It has ${2 * n} more health.`,
};

/** The camel's health once healed `heals` times at the caravanserai, up to its full health. */
const healed = (camel: Unit, heals = 1) =>
  Math.min(camel.hp + heals * RULES.camelHeal, camel.maxHp);

/** What the caravan takes with it from the caravanserai. */
export interface SetOut {
  provision?: Provision;
  /** The party's two picks of the passives drafted, in the order picked. */
  passives?: PassivePick[];
  /** The provision taken as a heal of the camel (RULES.camelHeal), in place of a stat. */
  heal?: boolean;
  /** The extra provision, Humphrey unhurt all stage: a stat, or `extraHeal`. */
  extra?: Provision;
  extraHeal?: boolean;
}

/**
 * The caravanserai, between a won stage and the next (progression.md,
 * 19.2): after a stage that earns a provision, one hero still standing
 * takes 1 more of one stat, for the rest of the run, or the camel is
 * healed RULES.camelHeal instead, and the caravan sets out. When the stage
 * offers passives (`passives`, 19.3a) four are drafted: the party picks
 * one, a rival caravan one in answer (`rivalTakes`), the party another,
 * and the last goes to the rivals too; each pick is carried by a hero
 * standing for the rest of the run. Which rival hero carries what is never
 * shown: the heroes of the region ahead stay hidden. Unless healed,
 * the camel goes on with the health it ended the stage with. If the camel
 * took no damage in the stage (`extraProvision`), one more provision is
 * taken the same way. After a stage that earns nothing the caravan only rests.
 */
export function Caravanserai(props: {
  fight: FightState;
  stage: number;
  stages: number;
  provision: boolean;
  extraProvision: boolean;
  passives: PassiveId[];
  /** For each passive the party could pick first, the one a rival caravan takes in answer. */
  rivalTakes: Partial<Record<PassiveId, PassiveId>>;
  busy: boolean;
  error: string | null;
  onSetOut: (choices: SetOut) => void;
}) {
  const [picks, setPicks] = useState<Choice[]>([]);
  /** The party's draft picks so far, in order; the last may wait for its carrier. */
  const [draft, setDraft] = useState<{passive: PassiveId; carrier: Unit['hero'] | null}[]>([]);
  const offered = props.passives.length > 0;
  /** The rivals' picks, each following the party's pick before it: its answer, then the last left. */
  const picked = draft.filter((p) => p.carrier !== null).map((p) => p.passive);
  const rival: PassiveId[] = [];
  const answer = picked[0] && props.rivalTakes[picked[0]];
  if (answer) rival.push(answer);
  if (picked.length === 2) {
    const last = props.passives.find((id) => !picked.includes(id) && !rival.includes(id));
    if (last) rival.push(last);
  }
  const rivalOf = (id: PassiveId) => rival.includes(id);
  const mineOf = (id: PassiveId) => draft.findIndex((p) => p.passive === id);
  /** The pick being made: the last, while it waits for a carrier or there is another to make. */
  const active = draft.at(-1);
  const draftDone = draft.length === 2 && draft.every((p) => p.carrier !== null);
  /**
   * A tap on a passive: one of the party's un-picks it (and the pick after
   * it); an open one becomes the pick being made, or starts the next.
   */
  const tapPassive = (id: PassiveId) =>
    setDraft((d) => {
      const at = d.findIndex((p) => p.passive === id);
      if (at >= 0) return d.slice(0, at);
      if (d.at(-1)?.carrier === null) return [...d.slice(0, -1), {passive: id, carrier: null}];
      if (d.length < 2) return [...d, {passive: id, carrier: null}];
      return d;
    });
  const setCarrier = (hero: Unit['hero']) =>
    setDraft((d) => (d.length ? [...d.slice(0, -1), {...d.at(-1)!, carrier: hero}] : d));
  const carries = (unit: Unit, id: PassiveId | null) =>
    id !== null && (unit.passives?.includes(id) ?? false);
  const heroes = props.fight.units
    .filter((u) => u.side === 'player' && u.alive && !HEROES[u.hero].walksRoad)
    .sort((a, b) => a.partyIndex - b.partyIndex);
  const camel = props.fight.units.find((u) => u.side === 'player' && HEROES[u.hero].walksRoad);
  const camelName = camel ? HEROES[camel.hero].name : '';
  /** The provisions to spend: the stage's, and the extra one if Humphrey took no damage. */
  const count = Number(props.provision) + Number(props.extraProvision);
  const choose = count > 0;
  const tally = (c: Choice) => picks.filter((p) => same(p, c)).length;
  /** A stat or heal can take one more pick: no stat above RULES.statMax, no heal past full health. */
  const room = (c: Choice) =>
    c === 'heal'
      ? camel !== undefined && healed(camel, tally('heal') + 1) > healed(camel, tally('heal'))
      : (heroes.find((u) => u.hero === c.hero)?.[c.stat] ?? RULES.statMax) + tally(c) <
        RULES.statMax;
  const anyRoom = [
    ...heroes.flatMap((u) => STATS.map(({stat}) => ({hero: u.hero, stat}))),
    ...(camel ? ['heal' as const] : []),
  ].some(room);
  // Done when every provision is spent, or the ones spent left nothing to raise or heal.
  const provisionsDone = picks.length === count || (picks.length > 0 && !anyRoom);
  /**
   * A tap on a choice: another pick on it while there are provisions left
   * and it has room; else, if picked, it's cleared; else it takes the last
   * pick's place.
   */
  const tap = (c: Choice) =>
    setPicks((p) => {
      const on = p.filter((x) => same(x, c)).length;
      if (p.length < count && room(c)) return [...p, c];
      if (on) return p.filter((x) => !same(x, c));
      return [...p.slice(0, -1), c];
    });

  /** What's still to choose before the caravan can set out, if anything. */
  const missing = [
    choose && !provisionsDone && (count > 1 && picks.length ? 'one more provision' : 'a provision'),
    offered &&
      !draftDone &&
      (active?.carrier === null
        ? 'who carries it'
        : draft.length
          ? 'your second passive'
          : 'a passive'),
  ].filter(Boolean);
  // The stage's provision first, then the extra one.
  const [first, second] = props.provision ? picks : [undefined, picks[0]];

  return (
    <Stack
      className={`${styles.page} ${styles.startPage}`}
      style={PALETTE_VARS}
      align="center"
      py={{base: 'sm', sm: 'xl'}}
      gap="lg"
      px={{base: 'xs', sm: 'md'}}
      data-testid="caravanserai"
    >
      <Paper className={styles.plaque!} p={{base: 'md', sm: 'xl'}} maw={760} w="100%">
        <Stack gap="md">
          <Stack gap={4}>
            <Text component="h1" className={styles.display!} fz={28} fw="bold" m={0}>
              Caravanserai
            </Text>
            <Text c="dimmed">
              Stage {props.stage + 1} of {props.stages} won. The caravan rests behind the inn’s
              walls before the road goes on.
            </Text>
          </Stack>

          {camel && <CamelHealth camel={camel} />}

          {choose && (
            <Section
              title={count > 1 ? 'Provisions' : 'Provision'}
              done={provisionsDone}
              count={count > 1 ? `${picks.length} of ${count}` : undefined}
              lead={
                <>
                  {props.extraProvision && (
                    <span data-testid="extra-provision">
                      {camelName} took no damage this stage:{' '}
                      {count > 1 ? 'an extra provision' : 'a provision'}.{' '}
                    </span>
                  )}
                  {count > 1
                    ? `For each, raise one hero’s stat by 1 for the rest of the run (the same one twice if you like), or heal ${camelName} ${RULES.camelHeal}.`
                    : `Raise one hero’s stat by 1 for the rest of the run, or heal ${camelName} ${RULES.camelHeal}.`}
                </>
              }
              rule={pickRule(picks, camel, camelName)}
              ruleTestId="provision-rule"
            >
              <div className={styles.provisionList} data-testid="provision-picks">
                {heroes.map((unit) => (
                  <ProvisionRow key={unit.id} unit={unit} tally={tally} room={room} onPick={tap} />
                ))}
                {camel && (
                  <HealRow
                    camel={camel}
                    picks={tally('heal')}
                    room={room('heal')}
                    onPick={() => tap('heal')}
                  />
                )}
              </div>
            </Section>
          )}

          {offered && (
            <Section
              title="Passive draft"
              done={draftDone}
              count={`${draft.filter((p) => p.carrier !== null).length} of 2`}
              lead={
                <>
                  Four passives, drafted: you pick one, a rival caravan on the road ahead takes one,
                  you pick another, and the rivals take the last. Each is carried for the rest of
                  the run.
                </>
              }
              rule={draftRule(draft, rival)}
              ruleTestId="passive-rule"
            >
              <div className={styles.passiveOffer} data-testid="passive-offer">
                {props.passives.map((id) => {
                  const def = PASSIVES[id];
                  const mine = mineOf(id);
                  const theirs = rivalOf(id);
                  const pick = draft[mine];
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.provisionStat} ${styles.passiveCard} ${mine >= 0 ? styles.heroPicked : ''} ${theirs ? styles.passiveRival : ''}`}
                      aria-pressed={mine >= 0}
                      disabled={Boolean(theirs) || (draftDone && mine < 0)}
                      data-testid={`passive-${id}`}
                      data-rival={theirs ? 'true' : undefined}
                      onClick={() => tapPassive(id)}
                    >
                      <span className={`${styles.display} ${styles.passiveName}`}>{def.name}</span>
                      <span>{def.rule}</span>
                      {pick && (
                        <span className={styles.passiveTaken}>
                          Your pick {mine + 1}
                          {pick.carrier ? `: ${HEROES[pick.carrier].name}` : ''}
                        </span>
                      )}
                      {theirs && (
                        <span className={styles.passiveTaken}>Taken by a rival caravan</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {active && !draftDone && (
                <>
                  <div className={styles.sectionLabel}>
                    Who carries {PASSIVES[active.passive].name}?
                  </div>
                  <div className={styles.carriers} data-testid="passive-carriers">
                    {heroes.map((unit) => {
                      const on = active.carrier === unit.hero;
                      const has = carries(unit, active.passive);
                      return (
                        <button
                          key={unit.id}
                          type="button"
                          className={`${styles.provisionStat} ${styles.carrier} ${on ? styles.heroPicked : ''}`}
                          aria-pressed={on}
                          disabled={has}
                          data-testid={`carrier-${unit.hero}`}
                          onClick={() => setCarrier(unit.hero)}
                        >
                          <Portrait unit={unit} className={styles.carrierPortrait} />
                          <span>
                            {HEROES[unit.hero].name}
                            {has && <span className={styles.provisionNote}> carries it</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </Section>
          )}

          <Stack gap={6} className={styles.setOutBar!}>
            <Text c="dimmed" fz="sm" ta="center">
              {missing.length
                ? `Still to choose: ${missing.join(', ')}.`
                : !choose && !offered
                  ? 'Nothing to choose this time: the caravan only rests.'
                  : 'Ready to set out.'}
            </Text>
            <Button
              size="lg"
              className={styles.seal!}
              fw="bold"
              loading={props.busy}
              disabled={missing.length > 0}
              onClick={() =>
                props.onSetOut({
                  ...(first === 'heal' ? {heal: true} : first ? {provision: first} : {}),
                  ...(second === 'heal' ? {extraHeal: true} : second ? {extra: second} : {}),
                  ...(offered && draftDone
                    ? {passives: draft.map((p) => ({hero: p.carrier!, passive: p.passive}))}
                    : {}),
                })
              }
            >
              Set out
            </Button>
            {props.error && <Text c="var(--c-madderLight)">{props.error}</Text>}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

/**
 * One choice to make here, a panel: its title (ticked once chosen) over a
 * line on what it is, its choices, and what the pick does.
 */
function Section(props: {
  title: string;
  done: boolean;
  /** How many of its picks are made, when it takes more than one. */
  count?: string | undefined;
  lead: ReactNode;
  rule: ReactNode;
  ruleTestId: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.provisionSection}>
      <div>
        <div className={`${styles.display} ${styles.sectionTitle}`}>
          {props.title}
          {props.count && <span className={styles.sectionCount}>{props.count}</span>}
          {props.done && <span className={styles.sectionDone}>✓</span>}
        </div>
        <div className={styles.sectionLead}>{props.lead}</div>
      </div>
      {props.children}
      <div
        className={`${styles.sectionRule} ${props.done ? styles.sectionRuleDone : ''}`}
        data-testid={props.ruleTestId}
      >
        {props.rule}
      </div>
    </section>
  );
}

/** A unit's portrait, facing left as the party does in a fight; its letter without one. */
function Portrait(props: {unit: Unit; className: string | undefined}) {
  const portrait = HERO_PORTRAIT[props.unit.hero]?.src;
  return (
    <span className={props.className}>
      {portrait ? <img src={portrait} alt="" /> : HEROES[props.unit.hero].letter}
    </span>
  );
}

/** A health bar: `hp` of `max`, and the part a heal would add (`to`), lighter. */
function HealthBar(props: {hp: number; max: number; to?: number}) {
  const pct = (n: number) => `${(100 * n) / props.max}%`;
  return (
    <span className={styles.healthBar} aria-hidden>
      {props.to !== undefined && props.to > props.hp && (
        <i className={styles.healthBarGain} style={{width: pct(props.to)}} />
      )}
      <i style={{width: pct(props.hp)}} />
    </span>
  );
}

/** The camel's health as the caravan goes on: wounds stay from stage to stage unless healed here. */
function CamelHealth(props: {camel: Unit}) {
  const {camel} = props;
  const name = HEROES[camel.hero].name;
  return (
    <div className={styles.camelHealth} data-testid="camel-health">
      <Portrait unit={camel} className={styles.carrierPortrait} />
      <div className={styles.camelHealthBody}>
        <div className={styles.camelHealthHead}>
          <span className={styles.display}>{name}</span>
          <span>
            {camel.hp} of {camel.maxHp} health
          </span>
        </div>
        <HealthBar hp={camel.hp} max={camel.maxHp} />
        <div className={styles.sectionLead}>
          Its wounds stay with it from stage to stage unless healed here; the heroes start each
          stage at full health.
        </div>
      </div>
    </div>
  );
}

/** What the draft so far does: each pick and who carries it, and what the rivals take in turn. */
function draftRule(
  draft: {passive: PassiveId; carrier: Unit['hero'] | null}[],
  rival: PassiveId[]
) {
  if (!draft.length) return 'Choose a passive.';
  const lines: string[] = [];
  draft.forEach((p, i) => {
    lines.push(
      p.carrier
        ? `${HEROES[p.carrier].name} carries ${PASSIVES[p.passive].name}.`
        : `Choose a hero to carry ${PASSIVES[p.passive].name}.`
    );
    const r = rival[i];
    if (r) lines.push(`A rival caravan takes ${PASSIVES[r].name}.`);
  });
  if (draft.length === 1 && draft[0]!.carrier) lines.push('Choose your second passive.');
  return lines.map((l) => <div key={l}>{l}</div>);
}

/** A provision's pick: a hero's stat raised, or the camel healed. */
type Choice = Provision | 'heal';

const same = (a: Choice, b: Choice) =>
  a === 'heal' || b === 'heal' ? a === b : a.hero === b.hero && a.stat === b.stat;

/** What the picks do, under the choices: each stat raised, and the camel's health after its heals. */
function pickRule(picks: Choice[], camel: Unit | undefined, camelName: string) {
  if (!picks.length)
    return `Choose a hero’s stat to raise, or heal ${camelName} ${RULES.camelHeal}.`;
  const lines: string[] = [];
  for (const p of picks) {
    if (p === 'heal' || picks.findIndex((x) => same(x, p)) !== picks.indexOf(p)) continue;
    const n = picks.filter((x) => same(x, p)).length;
    lines.push(`${HEROES[p.hero].name}: ${STAT_RULE[p.stat](n)}`);
  }
  const heals = picks.filter((p) => p === 'heal').length;
  if (heals && camel)
    lines.push(`${camelName} sets out with ${healed(camel, heals)} of ${camel.maxHp} health.`);
  return lines.map((l) => <div key={l}>{l}</div>);
}

/** A pick count on a choice, when it has any. */
function Tally({n}: {n: number}) {
  return n ? <span className={styles.provisionTally}>+{n}</span> : null;
}

/**
 * One hero standing: portrait and name, and a choice for each stat, showing
 * what its picks make it (or one more would); a stat already at
 * RULES.statMax can't be chosen.
 */
function ProvisionRow(props: {
  unit: Unit;
  tally: (c: Choice) => number;
  room: (c: Choice) => boolean;
  onPick: (c: Choice) => void;
}) {
  const {unit} = props;
  const hero = HEROES[unit.hero];
  return (
    <div className={styles.provisionHero}>
      <div className={styles.provisionWho}>
        <Portrait unit={unit} className={styles.carrierPortrait} />
        <span className={styles.display}>{hero.name}</span>
      </div>
      <div className={styles.provisionStats}>
        {STATS.map(({stat, label}) => {
          const choice = {hero: unit.hero, stat};
          const n = props.tally(choice);
          const full = !n && !props.room(choice);
          const to = unit[stat] + Math.max(n, 1);
          return (
            <button
              key={stat}
              type="button"
              className={`${styles.provisionStat} ${n ? styles.heroPicked : ''}`}
              aria-pressed={n > 0}
              disabled={full}
              data-testid={`provision-${unit.hero}-${stat}`}
              onClick={() => props.onPick(choice)}
            >
              <span className={styles.provisionLabel}>
                {label}
                <Tally n={n} />
              </span>
              <span className={styles.provisionValue}>
                {full ? (
                  <>
                    {unit[stat]} <span className={styles.provisionNote}>at most</span>
                  </>
                ) : (
                  <>
                    {unit[stat]} → <b>{to}</b>
                  </>
                )}
              </span>
              {stat === 'defence' && !full && (
                <span className={styles.provisionNote}>
                  health {unit.maxHp} → {unit.maxHp + healthOf(to) - healthOf(unit.defence)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The camel: portrait and name, and a provision taken as a heal of
 * RULES.camelHeal, up to its full health, in place of a stat; at full
 * health it can't be chosen.
 */
function HealRow(props: {camel: Unit; picks: number; room: boolean; onPick: () => void}) {
  const {camel} = props;
  const hero = HEROES[camel.hero];
  const full = !props.picks && !props.room;
  const to = healed(camel, Math.max(props.picks, 1));
  return (
    <div className={styles.provisionHero}>
      <div className={styles.provisionWho}>
        <Portrait unit={camel} className={styles.carrierPortrait} />
        <span className={styles.display}>{hero.name}</span>
      </div>
      <div className={styles.provisionStats}>
        <button
          type="button"
          className={`${styles.provisionStat} ${styles.provisionHeal} ${props.picks ? styles.heroPicked : ''}`}
          aria-pressed={props.picks > 0}
          disabled={full}
          data-testid="provision-heal"
          onClick={props.onPick}
        >
          <span className={styles.provisionLabel}>
            Heal {RULES.camelHeal}
            <Tally n={props.picks} />
          </span>
          <span className={styles.provisionValue}>
            {full ? (
              <>
                {camel.hp} <span className={styles.provisionNote}>at full health</span>
              </>
            ) : (
              <>
                {camel.hp} → <b>{to}</b>{' '}
                <span className={styles.provisionNote}>of {camel.maxHp} health</span>
              </>
            )}
          </span>
          <HealthBar hp={camel.hp} max={camel.maxHp} to={to} />
        </button>
      </div>
    </div>
  );
}
