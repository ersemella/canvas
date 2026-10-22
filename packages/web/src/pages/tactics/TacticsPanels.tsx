import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {ActionIcon, Button, Group, Menu, Paper, Stack, Text} from '@mantine/core';
import {hexEquals} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {
  ABILITIES,
  CAMEL_RULE,
  EXIT_INFO,
  HEROES,
  HERO_PORTRAIT,
  PALETTE,
  RULES,
  TILE_INFO,
  abilitiesOf,
  atExit,
  hailInfo,
  isFlanked,
  mapOf,
  obscured,
  slotsForward,
  statusSlotsLeft,
  statusValue,
  taunterOf,
  tileAt,
  unitName,
} from '@canvas/games-silk-road-run';
import type {
  AbilityDef,
  FightState,
  HexInfo,
  KeywordId,
  TurnPreview,
  Unit,
} from '@canvas/games-silk-road-run';
import {abilityIcon, KIND_NAME} from './AbilityIcon';
import {AbilityName, Glossary, GlossaryBox, KeywordText, Term} from './Keywords';
import styles from './TacticsPage.module.css';

/** A unit's name, in its side's colour: lapis yours, carmine the enemy's, as on the board. */
const sideColor = (u: Unit) =>
  u.side === 'player' ? 'var(--c-lapisLight)' : 'var(--c-madderLight)';

/** The game's palette as CSS variables (`--c-ink`, `--c-dusk1`, …), for the page and its portaled menu. */
export const PALETTE_VARS = Object.fromEntries(
  Object.entries(PALETTE).map(([name, color]) => [`--c-${name}`, color])
) as React.CSSProperties;

/**
 * When the unit's next turn comes after a previewed turn, in slots from
 * now: "+3", or, when the slot the cost aims at is taken and the card
 * yields further on (3.3), "+3 → +5", the cost and then where the card
 * lands, as the track draws it. Null with no preview.
 */
export function nextTurn(
  fight: FightState,
  preview: TurnPreview | null
): {text: string; title?: string} | null {
  if (!preview) return null;
  const now = fight.currentSlot;
  const slot = preview.slot;
  const aim = preview.aimSlot ?? slot;
  if (slot === null) return {text: ''};
  if (aim === null || slot <= aim) return {text: `+${slot - now}`};
  return {
    text: `+${aim - now} → +${slot - now}`,
    title: `The cost reaches slot +${aim - now}, but cards hold the slots up to +${slot - now - 1}: yours yields to the first free one.`,
  };
}

/** How long an armed Skip turn waits for its second tap. */
const SKIP_ARMED_MS = 3000;

/**
 * Skip turn: ends the turn with Hold, whatever is picked, saying when the
 * next turn comes. A quiet tile: the turn's action is confirmed from its
 * own button (Move or the ability, once its hex or target is picked).
 * Like Reset run, the first tap only arms it ("Tap again to skip"), so a
 * stray tap doesn't throw a turn away (owner, 2026-10-21); it disarms after
 * `SKIP_ARMED_MS`, on a tap anywhere else (which still does what it does),
 * or when the turn changes (the page keys it by turn).
 */
export function SkipButton(props: {
  fight: FightState;
  /** The turn as a Hold. */
  preview: TurnPreview | null;
  busy: boolean;
  /** Phones: full height for a thumb. */
  size?: 'sm' | 'lg';
  onSkip: () => void;
  /** Desktop: a key that presses it (twice to skip, as with taps), shown on it. */
  hotkey?: string | undefined;
}) {
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const press = () => {
    if (!armed) return setArmed(true);
    setArmed(false);
    props.onSkip();
  };
  const pressRef = useRef(press);
  pressRef.current = press;
  const {hotkey} = props;
  const usable = Boolean(props.preview) && !props.busy;
  useEffect(() => {
    if (!hotkey || !usable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== hotkey) return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea')) return;
      pressRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hotkey, usable]);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), SKIP_ARMED_MS);
    // A press anywhere but the button (the board, another button) disarms it.
    const onPress = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setArmed(false);
    };
    document.addEventListener('pointerdown', onPress, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onPress, true);
    };
  }, [armed]);
  const next = nextTurn(props.fight, props.preview);
  return (
    <Button
      ref={ref}
      className={`${styles.skip} ${armed ? styles.skipArmed : ''}`}
      data-testid="skip-turn"
      fw="bold"
      size={props.size ?? 'sm'}
      loading={props.busy}
      disabled={!props.preview}
      data-key={hotkey?.toUpperCase()}
      onClick={press}
      title={
        armed
          ? `Tap again${hotkey ? ` (or press ${hotkey.toUpperCase()})` : ''} to end the turn without moving or using an ability`
          : (next?.title ?? 'End the turn without moving or using an ability')
      }
    >
      {armed ? 'Tap again to skip' : `Skip turn${next?.text ? ` · ${next.text}` : ''}`}
    </Button>
  );
}

/**
 * The run's menu, behind a ⋯ button beside Confirm, so its rare actions take
 * no room: back to the games (the page has no top bar), and Reset run, which
 * arms on the first tap and gives up the fight for a new one on the second,
 * so a stray tap doesn't throw a fight away.
 */
export function RunMenu(props: {busy: boolean; onReset: () => void}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Menu
      position="top-end"
      withArrow
      classNames={{dropdown: styles.menu!}}
      styles={{dropdown: PALETTE_VARS}}
      onClose={() => setArmed(false)}
    >
      <Menu.Target>
        <ActionIcon className={styles.menuButton!} variant="default" size="lg" aria-label="Menu">
          ⋯
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item component={Link} to="/">
          All games
        </Menu.Item>
        <Menu.Item
          {...(armed ? {color: 'red'} : {})}
          disabled={props.busy}
          closeMenuOnClick={armed}
          onClick={() => {
            if (!armed) return setArmed(true);
            setArmed(false);
            props.onReset();
          }}
        >
          {armed ? 'Tap again to reset' : 'Reset run'}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/**
 * What's on a hex (D11), a card each: the unit standing there first (it's
 * what was tapped), then the ground under it: its tile unless that's sand
 * (which says nothing), and any hail, each on its own card. Every
 * card explains its own keywords inside itself. `dense`: the phone's
 * tooltip, everything in as little room as it takes.
 */
export function HexInspector({
  fight,
  hex,
  dense = false,
}: {
  fight: FightState;
  hex: Hex;
  dense?: boolean;
}) {
  const tile = tileAt(mapOf(fight), hex);
  const hail = fight.effects.find((e) => hexEquals(e.hex, hex));
  const unit = fight.units.find((u) => u.alive && u.hex && hexEquals(u.hex, hex));
  return (
    <Stack gap={dense ? 6 : 8} data-testid="hex-info">
      {unit && <StatSheet fight={fight} unit={unit} dense={dense} />}
      {tile !== 'sand' && <GroundCard info={TILE_INFO[tile]} dense={dense} />}
      {atExit(fight, hex) && (
        <GroundCard info={EXIT_INFO} color="var(--c-lapisLight)" dense={dense} />
      )}
      {hail && (
        <GroundCard
          info={hailInfo(hail, fight.currentSlot)}
          color="var(--c-skyLight)"
          dense={dense}
        />
      )}
    </Stack>
  );
}

/** One thing on the ground (a tile, hail): its name, then its rule, keywords explained inside the card. */
function GroundCard({
  info,
  color = 'var(--c-ivory)',
  dense,
}: {
  info: HexInfo;
  color?: string;
  dense: boolean;
}) {
  return (
    <Paper className={styles.plaque!} p={dense ? 'xs' : 'sm'}>
      <Glossary>
        <Text className={styles.display!} fw={700} fz={dense ? 'sm' : 'md'} c={color}>
          {info.name}
        </Text>
        <Text fz="xs" c="dimmed">
          <KeywordText text={info.detail} />
        </Text>
      </Glossary>
    </Paper>
  );
}

/** Whether a unit's ultimate is used, ready, or how much action cost it has spent towards it. */
function ultimateState(unit: Unit): string {
  if (unit.ultimateUsed) return 'Used';
  if (unit.ultimateCharge >= RULES.ultimateCharge) return 'Ready';
  return `${unit.ultimateCharge}/${RULES.ultimateCharge} charged`;
}

/** A unit's statuses, each led by its keyword, with what's left of it. */
function statusesOf(fight: FightState, unit: Unit): {id: KeywordId; label: string; rest: string}[] {
  const slot = fight.currentSlot;
  const left = (kind: Parameters<typeof statusSlotsLeft>[1]) =>
    `${statusSlotsLeft(unit, kind, slot)} slots`;
  const taunter = taunterOf(fight, unit);
  const out: {id: KeywordId; label: string; rest: string}[] = [];
  if (statusValue(unit, 'immobilized'))
    out.push({id: 'immobilized', label: 'Immobilized', rest: left('immobilized')});
  if (statusValue(unit, 'slowed'))
    out.push({id: 'slowed', label: `Slowed ${statusValue(unit, 'slowed')}`, rest: left('slowed')});
  if (statusValue(unit, 'vulnerable'))
    out.push({
      id: 'vulnerable',
      label: `Vulnerable ${statusValue(unit, 'vulnerable')}%`,
      rest: left('vulnerable'),
    });
  if (statusValue(unit, 'crushed'))
    out.push({
      id: 'crushed',
      label: `Crushed ${statusValue(unit, 'crushed')}`,
      rest: `a slot, ${left('crushed')}`,
    });
  if (taunter)
    out.push({
      id: 'taunted',
      label: 'Taunted',
      rest: `by ${unitName(taunter)}, ${left('taunted')}`,
    });
  if (unit.alive && isFlanked(fight, unit))
    out.push({id: 'flanked', label: 'Flanked', rest: `Vulnerable ${RULES.flankVulnerable}%`});
  if (unit.alive && unit.hex && obscured(fight, mapOf(fight), unit.hex))
    out.push({id: 'obscured', label: 'Obscured', rest: ''});
  return out;
}

/**
 * Every unit's stat sheet, enemies' included: its name and health, stats,
 * statuses and its abilities' names (D11), a tap explaining a keyword or an
 * ability. `dense` (the phone's tooltip): the stats on one line.
 */
export function StatSheet({
  fight,
  unit,
  dense = false,
}: {
  fight: FightState;
  unit: Unit;
  dense?: boolean;
}) {
  const statuses = statusesOf(fight, unit);
  const ultimate = HEROES[unit.hero].ultimate;
  const ult = ultimate && ABILITIES[ultimate];
  // Hold isn't offered as an action (End turn is), and the ultimate gets its own section.
  const abilities = abilitiesOf(unit).filter((def) => def.id !== 'hold' && !def.ultimate);
  // The camel has none; the wolf has abilities but no ultimate.
  const acts = abilities.length > 0 || Boolean(ult);
  const stats = [
    ['speed', 'Speed', unit.speed],
    ['power', 'Power', unit.power],
    ['defence', 'Defence', unit.defence],
  ] as const;
  const name = (
    <Text
      className={styles.display!}
      fw={700}
      fz={dense ? 'sm' : 'md'}
      c={sideColor(unit)}
      data-side={unit.side}
    >
      {HEROES[unit.hero].name}
    </Text>
  );
  const health = (
    <Text fz="xs">
      Health{' '}
      <b>
        {unit.hp} / {unit.maxHp}
      </b>
    </Text>
  );
  return (
    <Paper className={styles.plaque!} p={dense ? 'xs' : 'sm'} data-testid="stat-sheet">
      {/*
       * A keyword or ability tapped here is explained here, inside the unit's
       * card: on desktop beside the abilities' names (the room their column
       * leaves), so the sheet grows no taller than the board; below them in
       * the phone's tooltip.
       */}
      <Glossary slotted={!dense}>
        {dense ? (
          <>
            <Group justify="space-between" gap={6} mb={2}>
              {name}
              {health}
            </Group>
            <div className={styles.statLine}>
              {stats.map(([id, label, value]) => (
                <span key={id}>
                  <Term id={id}>{label}</Term> <b>{value}</b>
                </span>
              ))}
            </div>
          </>
        ) : (
          // Desktop: the unit's name, then its portrait with health and stats beside it.
          <>
            {name}
            <div className={styles.sheetHead}>
              <SheetPortrait unit={unit} />
              <div className={styles.coreStats}>
                <div>
                  <span>Health</span>
                  <b>
                    {unit.hp} / {unit.maxHp}
                  </b>
                </div>
                {stats.map(([id, label, value]) => (
                  <div key={id}>
                    <Term id={id}>{label}</Term>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {statuses.length > 0 && (
          <div className={styles.statuses}>
            {statuses.map((st) => (
              <span key={st.id}>
                <Term id={st.id}>{st.label}</Term>
                {st.rest && ` ${st.rest}`}
              </span>
            ))}
          </div>
        )}
        {unit.charging && (
          <Text fz="xs" c="var(--c-plumLight)" mt={4}>
            Charging {ABILITIES[unit.charging.ability].name}: triggers at slot {unit.slot}.
          </Text>
        )}
        {/* The camel has no abilities: its rule instead. */}
        {!acts && (
          <Text fz="xs" c="dimmed" mt={4}>
            {CAMEL_RULE}
          </Text>
        )}
        {/* Names only, to scan; a tap explains one below, or beside them on desktop. */}
        {acts && (
          <div className={styles.abilityRow}>
            <div className={styles.abilityList} data-dense={dense || undefined}>
              {/* The phone's tooltip leaves the label out, to stay narrow. */}
              {!dense && <span className={styles.abilityListLabel}>Abilities</span>}
              {abilities.map((def) => (
                <AbilityName
                  key={def.id}
                  id={def.id}
                  body={<AbilityDetail unit={unit} def={def} />}
                >
                  {abilityIcon(def)}
                  {def.name}
                </AbilityName>
              ))}
              {ult && (
                <AbilityName id={ult.id} ultimate body={<AbilityDetail unit={unit} def={ult} />}>
                  {abilityIcon(ult)}
                  {ult.name}
                  {ultimateState(unit) !== 'Used' && (
                    <span className={styles.abilityLinkNote}>
                      {ultimateState(unit) === 'Ready'
                        ? 'Ready'
                        : `${unit.ultimateCharge}/${RULES.ultimateCharge}`}
                    </span>
                  )}
                </AbilityName>
              )}
            </div>
            {!dense && <GlossaryBox className={styles.glossaryBeside!} />}
          </div>
        )}
        {/* The camel has no abilities' column to sit beside. */}
        {!dense && !acts && <GlossaryBox />}
      </Glossary>
    </Paper>
  );
}

/**
 * A unit's portrait, on its track card's ground (its side's two bands) and
 * facing as its card does: enemies to the left. Its hero's letter if it has none.
 */
function SheetPortrait({unit}: {unit: Unit}) {
  const src = HERO_PORTRAIT[unit.hero]?.src;
  return (
    <div
      className={`${styles.sheetPortrait} ${unit.side === 'enemy' ? styles.sheetPortraitEnemy : ''}`}
      data-testid="sheet-portrait"
    >
      {src ? <img src={src} alt="" /> : HEROES[unit.hero].letter}
    </div>
  );
}

/** An ability's cost in this unit's slots (the action alone, before any move or yielding). */
function costText(unit: Unit, def: AbilityDef): string {
  return def.charged
    ? `Charge +${slotsForward(def.cost, unit.speed)} · Recovery +${slotsForward(def.recoveryCost!, unit.speed)}`
    : `+${slotsForward(def.cost, unit.speed)}`;
}

/**
 * An ability explained: its cost (a Term, once) and duration, then what it
 * does, its keywords tappable in turn. An ultimate says so, with how far it
 * is from being ready. For a name tapped on a stat sheet, and on desktop
 * for the ability picked for the turn.
 */
export function AbilityDetail({unit, def}: {unit: Unit; def: AbilityDef}) {
  return (
    <Text fz="xs">
      {def.kind && (
        <>
          {abilityIcon(def)}
          <b>{def.name}</b> · {KIND_NAME[def.kind]}
        </>
      )}
      {!def.kind && <b>{def.name}</b>}
      {def.ultimate && (
        <>
          {' · '}
          <Term id="ultimate">Ultimate</Term> {ultimateState(unit)}
        </>
      )}
      {' · '}
      {def.charged ? (
        <Term id="charged">{costText(unit, def)}</Term>
      ) : (
        <Term id="slots">Cost {costText(unit, def)}</Term>
      )}
      {def.duration !== undefined && ` · Duration ${def.duration}`}
      <br />
      <span className={styles.abilitySummary}>
        <KeywordText text={def.summary(unit)} />
      </span>
    </Text>
  );
}
