import {useState} from 'react';
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
import {PALETTE_VARS, RunMenu} from './TacticsPanels';
import {ProvisionIcon} from './ProvisionIcon';
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

/** A pick in the making: a card (its taker chosen next), the camel healed, or the pick skipped. */
type Pending = {card: CardId; hero: Unit['hero'] | null} | 'heal' | 'skip';

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
 * picks one more, last (`extra`). The draft's turns are drawn rather
 * than told (`DraftOrder`), each card wears its icon, and the camel's heal
 * is offered only while it is hurt. Any pick can be skipped instead,
 * taking nothing; the rival still answers it.
 */
export function Caravanserai(props: {
  fight: FightState;
  draft: DraftView | null;
  busy: boolean;
  error: string | null;
  /** Locks in one of the party's picks: the rules answer with the rival's. */
  onPick: (pick: DraftPick) => void;
  onSetOut: () => void;
  /** Gives up the run, for the start menu (the run menu's Reset run). */
  onReset: () => void;
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
  const making =
    pending !== null && typeof pending === 'object' && !taken(pending.card) ? pending : null;
  const healing = pending === 'heal' && canHeal;
  const skipping = pending === 'skip' && !done;
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
    setPending((p) =>
      p !== null && typeof p === 'object' && p.card === card ? null : {card, hero: null}
    );
  };
  const lock = (pick: DraftPick) => {
    props.onPick(pick);
    setPending(null);
  };

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
          <Text component="h1" className={styles.display!} fz={28} fw="bold" m={0}>
            Caravanserai
          </Text>

          {draft && offer.length > 0 && (
            <section className={styles.provisionSection}>
              <DraftOrder draft={draft} offer={offer} camelName={camelName} done={done} />
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
                      <span className={styles.cardHead}>
                        <span className={styles.cardIcon}>
                          <ProvisionIcon card={card} px={3} />
                        </span>
                        <span className={styles.cardTitle}>
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
                        </span>
                      </span>
                      <span>{cardRule(card)}</span>
                      {pick && 'card' in pick && (
                        <span className={styles.passiveTaken}>Yours: {HEROES[pick.hero].name}</span>
                      )}
                      {theirs && <span className={styles.passiveTaken}>The rival’s</span>}
                      {discarded && <span className={styles.provisionNote}>Discarded</span>}
                    </button>
                  );
                })}
              </div>

              {canHeal && camel && (
                <button
                  type="button"
                  className={`${styles.provisionStat} ${styles.provisionHeal} ${healing ? styles.heroPicked : ''}`}
                  aria-pressed={healing}
                  disabled={props.busy}
                  data-testid="draft-heal"
                  onClick={() => setPending((p) => (p === 'heal' ? null : 'heal'))}
                >
                  <span className={styles.healHead}>
                    <Portrait unit={camel} className={styles.carrierPortrait} />
                    <span className={styles.healBody}>
                      <span className={styles.provisionLabel}>
                        Or, instead of a provision: heal {camelName} {RULES.camelHeal}
                      </span>
                      <span className={styles.provisionValue}>
                        {camelHp} → <b>{Math.min(camelHp + RULES.camelHeal, camel.maxHp)}</b>{' '}
                        <span className={styles.provisionNote}>of {camel.maxHp} health</span>
                      </span>
                    </span>
                  </span>
                  <HealthBar
                    hp={camelHp}
                    max={camel.maxHp}
                    to={Math.min(camelHp + RULES.camelHeal, camel.maxHp)}
                  />
                </button>
              )}

              {!done && (
                <Button
                  variant="subtle"
                  className={styles.draftSkip!}
                  aria-pressed={skipping}
                  disabled={props.busy}
                  data-testid="draft-skip"
                  onClick={() => setPending((p) => (p === 'skip' ? null : 'skip'))}
                >
                  Or skip this pick: take nothing
                </Button>
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
              {skipping && (
                <Button
                  className={styles.seal!}
                  fw="bold"
                  loading={props.busy}
                  data-testid="draft-lock"
                  onClick={() => lock({skip: true})}
                >
                  Lock in: skip this pick
                </Button>
              )}
            </section>
          )}

          <Stack gap={6} className={styles.setOutBar!}>
            <Text c="dimmed" fz="sm" ta="center">
              {!done
                ? `Still to choose: ${mine.length ? 'your next provision' : 'a provision'}.`
                : !draft || offer.length === 0
                  ? 'Nothing to choose this time: the caravan only rests.'
                  : 'Ready to set out.'}
            </Text>
            <div className={styles.confirmRow}>
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
              <RunMenu busy={props.busy} onReset={props.onReset} />
            </div>
            {props.error && <Text c="var(--c-madderLight)">{props.error}</Text>}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
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

/** One turn in the draft: the party's pick or the rival's, and the card it took once made. */
interface Turn {
  who: 'you' | 'rival';
  /** The card taken, 'heal' for the camel healed or 'skip' for nothing taken; null until made. */
  took: CardId | 'heal' | 'skip' | null;
  /** The party's extra pick, the camel unhurt in the stage. */
  extra: boolean;
}

/** The draft's turns in order: each of the party's picks, the rival's answer after it while it has picks left. */
function draftTurns(draft: DraftView, offer: CardId[]): Turn[] {
  const turns: Turn[] = [];
  for (let i = 0; i < draft.picks; i++) {
    const p = draft.mine[i];
    turns.push({
      who: 'you',
      took: p ? ('card' in p ? p.card : 'heal' in p ? 'heal' : 'skip') : null,
      extra: draft.extra && i === draft.picks - 1 && i >= draft.rivalPicks,
    });
    // The rival answers each pick while it has picks owed and a card is left for it.
    if (i < draft.rivalPicks && offer.length > 2 * i + 1)
      turns.push({who: 'rival', took: draft.rival[i] ?? null, extra: false});
  }
  return turns;
}

/**
 * How the draft goes, drawn rather than told: its turns in order, yours
 * and the rival's, each filled with what it took once made and the next
 * one lit; then the bin for the rest. A line under it says where each
 * side's picks go.
 */
function DraftOrder(props: {draft: DraftView; offer: CardId[]; camelName: string; done: boolean}) {
  const turns = draftTurns(props.draft, props.offer);
  const next = turns.findIndex((t) => t.took === null);
  const kept = new Set<CardId>([
    ...props.draft.rival,
    ...props.draft.mine.flatMap((p) => ('card' in p ? [p.card] : [])),
  ]);
  const gone = props.done ? props.offer.filter((c) => !kept.has(c)) : [];
  return (
    <div className={styles.draftOrder} data-testid="draft-order">
      <ol className={styles.draftTurns}>
        {turns.map((t, i) => (
          <li
            key={i}
            className={styles.draftTurn}
            data-who={t.who}
            data-now={i === next ? 'true' : undefined}
            data-made={t.took ? 'true' : undefined}
          >
            <span className={styles.draftSlot}>
              {t.took === 'heal' ? (
                <span className={styles.draftHeal}>+{RULES.camelHeal}</span>
              ) : t.took === 'skip' ? (
                <span title="Skipped">–</span>
              ) : t.took ? (
                <ProvisionIcon card={t.took} px={2} />
              ) : t.who === 'you' ? (
                '?'
              ) : (
                '…'
              )}
            </span>
            <span className={styles.draftWho}>{t.who === 'you' ? 'You' : 'Rival'}</span>
            {t.extra && (
              <span
                className={styles.draftExtra}
                data-testid="extra-provision"
                title={`${props.camelName} took no damage this stage: one more provision drawn, and one more pick for you.`}
              >
                Bonus
              </span>
            )}
          </li>
        ))}
        <li className={styles.draftTurn} data-who="bin">
          <span className={styles.draftSlot}>
            {gone.length ? gone.map((c) => <ProvisionIcon key={c} card={c} px={2} />) : '✕'}
          </span>
          <span className={styles.draftWho}>Rest discarded</span>
        </li>
      </ol>
      <div className={styles.draftLegend}>
        <span>
          <i className={styles.draftDot} data-who="you" /> Yours: a hero keeps it all run
        </span>
        <span>
          <i className={styles.draftDot} data-who="rival" /> Rival’s: the enemies ahead get it
        </span>
        {props.draft.extra && (
          <span>
            <b className={styles.draftExtra}>Bonus</b> {props.camelName} came through unhurt: one
            more pick
          </span>
        )}
      </div>
    </div>
  );
}
