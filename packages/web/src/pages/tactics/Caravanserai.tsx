import {useState} from 'react';
import type {ReactNode} from 'react';
import {Button, Paper, Stack, Text} from '@mantine/core';
import {
  HEROES,
  HERO_PORTRAIT,
  PASSIVES,
  RULES,
  cardRarity,
  healthOf,
  isStatCard,
} from '@canvas/games-silk-road-run';
import type {
  CardId,
  DraftPick,
  DraftView,
  FightState,
  Rarity,
  StatId,
  Unit,
} from '@canvas/games-silk-road-run';
import {PALETTE_VARS} from './TacticsPanels';
import styles from './TacticsPage.module.css';

/** Each rarity's name on a drafted card (progression.md, 19.3b). */
const RARITY_NAME: Record<Rarity, string> = {
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common',
};

const STAT_NAME: Record<StatId, string> = {speed: 'Speed', defence: 'Defence', power: 'Power'};

/** What a stat point does. */
const STAT_RULE: Record<StatId, string> = {
  speed: 'Its card comes round the track sooner, so it acts more often.',
  power: 'Each of its abilities deals 1 more damage.',
  defence: 'It has 2 more health.',
};

/** A provision card's name: a stat's +1, or the passive's or upgrade's. */
const cardName = (card: CardId) =>
  isStatCard(card) ? `${STAT_NAME[card]} +1` : PASSIVES[card].name;

/** A card's category, after its rarity (progression.md, 19.3c; owner, 2026-10-29). */
const cardKind = (card: CardId) =>
  isStatCard(card)
    ? 'stat upgrade'
    : PASSIVES[card].kind === 'upgrade'
      ? 'ability upgrade'
      : 'passive upgrade';

/** What a card does, on it. */
const cardRule = (card: CardId) => (isStatCard(card) ? STAT_RULE[card] : PASSIVES[card].rule);

/** A pick in the making: a card (its taker chosen next) or the camel healed. */
type Pending = {card: CardId; hero: Unit['hero'] | null} | 'heal';

/**
 * The caravanserai, between a won stage and the next (progression.md,
 * 19.3): its draft of provisions, stat, passive and ability upgrades,
 * drawn by rarity. The party picks one and the rival caravan one in turn,
 * until each has its share (one after a regular stage, two after a boss);
 * the rest are discarded. Each of the party's picks goes to a hero
 * standing for the rest of the run, or heals the camel instead, and is
 * kept once locked in (`onPick`): only then does the rival's answer show.
 * The rival's provisions go to the enemies of every stage to come. Unless
 * healed, the camel goes on with the health it ended the stage with. If
 * it took no damage in the stage, one more card is drawn and the party
 * picks one more, last (`extra`).
 */
export function Caravanserai(props: {
  fight: FightState;
  stage: number;
  stages: number;
  draft: DraftView | null;
  busy: boolean;
  error: string | null;
  /** Locks in one of the party's picks: the rules answer with the rival's. */
  onPick: (pick: DraftPick) => void;
  onSetOut: () => void;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const draft = props.draft;
  const offer = draft?.offer ?? [];
  const mine = draft?.mine ?? [];
  const rival = draft?.rival ?? [];
  const done = !draft || mine.length >= draft.picks;
  const heroes = props.fight.units
    .filter((u) => u.side === 'player' && u.alive && !HEROES[u.hero].walksRoad)
    .sort((a, b) => a.partyIndex - b.partyIndex);
  const camel = props.fight.units.find((u) => u.side === 'player' && HEROES[u.hero].walksRoad);
  const camelName = camel ? HEROES[camel.hero].name : '';
  const heals = mine.filter((p) => 'heal' in p).length;
  const camelHp = camel ? Math.min(camel.hp + heals * RULES.camelHeal, camel.maxHp) : 0;
  const canHeal = Boolean(camel && camelHp < camel.maxHp && !done);
  const myIndex = (card: CardId) => mine.findIndex((p) => 'card' in p && p.card === card);
  const taken = (card: CardId) => myIndex(card) >= 0 || rival.includes(card);
  const making = pending !== null && pending !== 'heal' && !taken(pending.card) ? pending : null;
  const healing = pending === 'heal' && canHeal;
  /** A hero's stat, its stat picks made here included. */
  const statOf = (unit: Unit, stat: StatId) =>
    unit[stat] + mine.filter((p) => 'card' in p && p.hero === unit.hero && p.card === stat).length;
  /** Whether a hero can take a card: a stat below RULES.statMax, a passive it doesn't carry. */
  const canTake = (unit: Unit, card: CardId) =>
    isStatCard(card)
      ? statOf(unit, card) < RULES.statMax
      : !(unit.passives?.includes(card) ?? false) &&
        !mine.some((p) => 'card' in p && p.hero === unit.hero && p.card === card);
  const tapCard = (card: CardId) => {
    if (done || taken(card)) return;
    setPending((p) => (p !== null && p !== 'heal' && p.card === card ? null : {card, hero: null}));
  };
  const lock = (pick: DraftPick) => {
    props.onPick(pick);
    setPending(null);
  };
  const lead = draft ? (
    <>
      {draft.extra && (
        <span data-testid="extra-provision">
          {camelName} took no damage this stage: an extra provision for you, and one more
          drawn.{' '}
        </span>
      )}
      {offer.length} provisions drawn, stat, passive and ability upgrades, the stronger the rarer:
      you pick one and a rival caravan on the road ahead takes one
      {draft.rivalPicks > 1 ? `, until it has ${draft.rivalPicks}` : ''}
      {draft.extra ? ', then you take one more' : ''}; the rest are discarded. Each is kept for the
      rest of the run, the rival’s by the enemies ahead. Every pick is final once locked in. Instead
      of a pick, you can heal {camelName} {RULES.camelHeal}.
    </>
  ) : null;

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

          {camel && <CamelHealth camel={camel} hp={camelHp} />}

          {draft && offer.length > 0 && (
            <Section
              title="Provisions"
              done={done}
              count={draft.picks > 1 ? `${mine.length} of ${draft.picks}` : undefined}
              lead={lead}
              rule={draftRule(mine, rival, offer, done, camelName)}
              ruleTestId="draft-rule"
            >
              <div className={styles.passiveOffer} data-testid="draft-offer">
                {offer.map((card) => {
                  const rarity = cardRarity(card);
                  const i = myIndex(card);
                  const pick = mine[i];
                  const theirs = rival.includes(card);
                  const discarded = done && i < 0 && !theirs;
                  const on = making?.card === card;
                  return (
                    <button
                      key={card}
                      type="button"
                      className={`${styles.provisionStat} ${styles.passiveCard} ${i >= 0 || on ? styles.heroPicked : ''} ${theirs ? styles.passiveRival : ''}`}
                      aria-pressed={i >= 0 || on}
                      disabled={i >= 0 || theirs || done || props.busy}
                      data-testid={`card-${card}`}
                      data-rival={theirs ? 'true' : undefined}
                      data-discarded={discarded ? 'true' : undefined}
                      onClick={() => tapCard(card)}
                    >
                      <span className={`${styles.display} ${styles.passiveName}`}>
                        {cardName(card)}
                      </span>
                      <span
                        className={styles.passiveRarity}
                        data-rarity={rarity}
                        data-testid={`card-rarity-${card}`}
                      >
                        {RARITY_NAME[rarity]} {cardKind(card)}
                      </span>
                      <span>{cardRule(card)}</span>
                      {pick && 'card' in pick && (
                        <span className={styles.passiveTaken}>
                          Your pick {i + 1}: {HEROES[pick.hero].name}
                        </span>
                      )}
                      {theirs && (
                        <span className={styles.passiveTaken}>Taken by a rival caravan</span>
                      )}
                      {discarded && <span className={styles.provisionNote}>Discarded</span>}
                    </button>
                  );
                })}
              </div>

              {!done && camel && (
                <button
                  type="button"
                  className={`${styles.provisionStat} ${styles.provisionHeal} ${healing ? styles.heroPicked : ''}`}
                  aria-pressed={healing}
                  disabled={!canHeal || props.busy}
                  data-testid="draft-heal"
                  onClick={() => setPending((p) => (p === 'heal' ? null : 'heal'))}
                >
                  <span className={styles.provisionLabel}>
                    Instead, heal {camelName} {RULES.camelHeal}
                  </span>
                  <span className={styles.provisionValue}>
                    {canHeal ? (
                      <>
                        {camelHp} → <b>{Math.min(camelHp + RULES.camelHeal, camel.maxHp)}</b>{' '}
                        <span className={styles.provisionNote}>of {camel.maxHp} health</span>
                      </>
                    ) : (
                      <>
                        {camelHp} <span className={styles.provisionNote}>at full health</span>
                      </>
                    )}
                  </span>
                  <HealthBar
                    hp={camelHp}
                    max={camel.maxHp}
                    to={Math.min(camelHp + RULES.camelHeal, camel.maxHp)}
                  />
                </button>
              )}

              {making && (
                <>
                  <div className={styles.sectionLabel}>Who takes {cardName(making.card)}?</div>
                  <div className={styles.carriers} data-testid="draft-carriers">
                    {heroes.map((unit) => {
                      const on = making.hero === unit.hero;
                      const can = canTake(unit, making.card);
                      const stat = isStatCard(making.card) ? making.card : null;
                      return (
                        <button
                          key={unit.id}
                          type="button"
                          className={`${styles.provisionStat} ${styles.carrier} ${on ? styles.heroPicked : ''}`}
                          aria-pressed={on}
                          disabled={!can}
                          data-testid={`carrier-${unit.hero}`}
                          onClick={() => setPending({card: making.card, hero: unit.hero})}
                        >
                          <Portrait unit={unit} className={styles.carrierPortrait} />
                          <span>
                            {HEROES[unit.hero].name}
                            {stat && (
                              <span className={styles.provisionNote}>
                                {' '}
                                {can
                                  ? `${statOf(unit, stat)} → ${statOf(unit, stat) + 1}`
                                  : 'at most'}
                                {stat === 'defence' &&
                                  can &&
                                  `, health ${healthOf(statOf(unit, stat))} → ${healthOf(statOf(unit, stat) + 1)}`}
                              </span>
                            )}
                            {!stat && !can && (
                              <span className={styles.provisionNote}> carries it</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {making?.hero && (
                <Button
                  className={styles.seal!}
                  fw="bold"
                  loading={props.busy}
                  data-testid="draft-lock"
                  onClick={() => lock({hero: making.hero!, card: making.card})}
                >
                  Lock in {cardName(making.card)} for {HEROES[making.hero].name}
                </Button>
              )}
              {healing && (
                <Button
                  className={styles.seal!}
                  fw="bold"
                  loading={props.busy}
                  data-testid="draft-lock"
                  onClick={() => lock({heal: true})}
                >
                  Lock in: heal {camelName} {RULES.camelHeal}
                </Button>
              )}
            </Section>
          )}

          <Stack gap={6} className={styles.setOutBar!}>
            <Text c="dimmed" fz="sm" ta="center">
              {!done
                ? `Still to choose: ${mine.length ? 'your next provision' : 'a provision'}.`
                : !draft || offer.length === 0
                  ? 'Nothing to choose this time: the caravan only rests.'
                  : 'Ready to set out.'}
            </Text>
            <Button
              size="lg"
              className={styles.seal!}
              fw="bold"
              loading={props.busy}
              disabled={!done}
              data-testid="set-out"
              onClick={props.onSetOut}
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
 * line on what it is, its choices, and what the picks do.
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

/**
 * The camel's health as the caravan goes on, `hp` once the heals picked
 * here are taken: wounds stay from stage to stage unless healed here.
 */
function CamelHealth(props: {camel: Unit; hp: number}) {
  const {camel} = props;
  const name = HEROES[camel.hero].name;
  return (
    <div className={styles.camelHealth} data-testid="camel-health">
      <Portrait unit={camel} className={styles.carrierPortrait} />
      <div className={styles.camelHealthBody}>
        <div className={styles.camelHealthHead}>
          <span className={styles.display}>{name}</span>
          <span>
            {props.hp} of {camel.maxHp} health
          </span>
        </div>
        <HealthBar hp={props.hp} max={camel.maxHp} />
        <div className={styles.sectionLead}>
          Its wounds stay with it from stage to stage unless healed here; the heroes start each
          stage at full health.
        </div>
      </div>
    </div>
  );
}

/** What the draft so far does: each pick, the rival's answer to it, and what's discarded. */
function draftRule(
  mine: DraftPick[],
  rival: CardId[],
  offer: CardId[],
  done: boolean,
  camelName: string
) {
  if (!mine.length) return 'Choose a provision, and who takes it.';
  const lines: string[] = [];
  mine.forEach((p, i) => {
    lines.push(
      'card' in p
        ? `${HEROES[p.hero].name} takes ${cardName(p.card)}.`
        : `${camelName} is healed ${RULES.camelHeal}.`
    );
    const r = rival[i];
    if (r) lines.push(`A rival caravan takes ${cardName(r)}.`);
  });
  if (done) {
    const gone = offer.filter(
      (c) => !rival.includes(c) && !mine.some((p) => 'card' in p && p.card === c)
    );
    if (gone.length) lines.push(`Discarded: ${gone.map(cardName).join(', ')}.`);
  } else lines.push('Choose your next provision.');
  return lines.map((l) => <div key={l}>{l}</div>);
}
