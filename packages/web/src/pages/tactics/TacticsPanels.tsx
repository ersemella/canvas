import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {ActionIcon, Badge, Button, Group, Menu, Paper, Stack, Text} from '@mantine/core';
import {hexEquals} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {
  ABILITIES,
  HEROES,
  RULES,
  TILE_INFO,
  abilitiesOf,
  fogAt,
  fogInfo,
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
} from '@canvas/games-silk-road-tactics';
import type {
  AbilityDef,
  FightState,
  KeywordId,
  TurnPreview,
  Unit,
} from '@canvas/games-silk-road-tactics';
import {AbilityName, Glossary, KeywordText, Term} from './Keywords';
import styles from './TacticsPage.module.css';

const sideColor = (u: Unit) => (u.side === 'player' ? 'blue' : 'red');

/**
 * The turn's one button: Confirm with the chosen action, or End turn with
 * none (Hold), saying when the next turn comes in slots from now. While the
 * action still needs a target it stays, disabled, saying what to pick, so
 * the buttons around it don't move. When the
 * slot the cost aims at is taken, the card yields further on (3.3): it reads
 * "+3 → +5", the cost and then where the card lands, as the track draws it.
 * The outcome itself is drawn on the board (7.2).
 */
export function ConfirmButton(props: {
  /** No action ready (nothing picked, or no hex for it yet): the button ends the turn with Hold. */
  endTurn: boolean;
  fight: FightState;
  preview: TurnPreview | null;
  busy: boolean;
  /** Phones: full height for a thumb. */
  size?: 'sm' | 'lg';
  onConfirm: () => void;
}) {
  const {fight, preview} = props;
  const now = fight.currentSlot;
  const slot = preview?.slot ?? null;
  const aim = preview?.aimSlot ?? slot;
  const yields = slot !== null && aim !== null && slot > aim;
  const next = slot === null ? '' : yields ? `+${aim! - now} → +${slot - now}` : `+${slot - now}`;
  return (
    <Button
      color="yellow"
      c="dark.9"
      fw="bold"
      size={props.size ?? 'sm'}
      loading={props.busy}
      disabled={!preview}
      onClick={props.onConfirm}
      title={
        yields
          ? `The cost reaches slot +${aim! - now}, but cards hold the slots up to +${slot! - now - 1}: yours yields to the first free one.`
          : undefined
      }
    >
      {preview
        ? `${props.endTurn ? 'End turn' : 'Confirm'}${next ? ` · ${next}` : ''}`
        : 'Can’t do that'}
    </Button>
  );
}

/**
 * Gives up the fight and starts a new one. Two taps: the first arms it
 * for a few seconds, so a stray tap doesn't throw a fight away.
 */
export function ResetRunButton(props: {busy: boolean; onReset: () => void}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      size="xs"
      variant={armed ? 'filled' : 'subtle'}
      color={armed ? 'red' : 'gray'}
      disabled={props.busy}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        props.onReset();
      }}
    >
      {armed ? 'Tap again to reset' : 'Reset run'}
    </Button>
  );
}

/**
 * Phones: the run's menu, behind a ⋯ button in the action bar, so its rare
 * actions take no room: back to the games (the page has no top bar), and
 * Reset run, which as on desktop arms on the first tap and resets on the second.
 */
export function RunMenu(props: {busy: boolean; onReset: () => void}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Menu position="top-end" withArrow onClose={() => setArmed(false)}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Menu">
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
 * What's on a hex: its tile's rule, any hail, and the unit standing there
 * (D11), its keywords tappable. `dense`: the phone's tooltip, everything in
 * as little room as it takes.
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
  const info = TILE_INFO[tile];
  const hail = fight.effects.find((e) => hexEquals(e.hex, hex));
  const fog = fogAt(fight, hex);
  const unit = fight.units.find((u) => u.alive && u.hex && hexEquals(u.hex, hex));
  // Plain sand under a unit says nothing worth a card.
  const showTile = tile !== 'sand' || hail || fog || !unit;
  return (
    <Glossary>
      <Stack gap={dense ? 6 : 8} data-testid="hex-info">
        {showTile && (
          <Paper bg="dark.7" p={dense ? 'xs' : 'sm'} radius="md">
            <Text fw={600} fz={dense ? 'sm' : 'md'}>
              {info.name}
            </Text>
            <Text fz="xs" c="dimmed">
              <KeywordText text={info.detail} />
            </Text>
            {hail && (
              <Text fz="xs" c="cyan.3" mt={4}>
                <b>Hail.</b> <KeywordText text={hailInfo(hail, fight.currentSlot).detail} />
              </Text>
            )}
            {fog && (
              <Text fz="xs" c="gray.4" mt={4}>
                <b>Fog.</b> <KeywordText text={fogInfo(fog, fight.currentSlot).detail} />
              </Text>
            )}
          </Paper>
        )}
        {unit && <StatSheet fight={fight} unit={unit} dense={dense} />}
      </Stack>
    </Glossary>
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
 * statuses and abilities (D11), keywords tappable for their rules. `dense`
 * (the phone's tooltip): the same, the stats on one line and each ability
 * in one paragraph.
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
  const ult = ABILITIES[HEROES[unit.hero].ultimate];
  // Hold isn't offered as an action (End turn is), and the ultimate gets its own section.
  const abilities = abilitiesOf(unit).filter((def) => def.id !== 'hold' && !def.ultimate);
  const stats = [
    ['speed', 'Speed', unit.speed],
    ['power', 'Power', unit.power],
    ['defence', 'Defence', unit.defence],
  ] as const;
  return (
    <Paper bg="dark.7" p={dense ? 'xs' : 'sm'} radius="md" data-testid="stat-sheet">
      <Group justify="space-between" gap={6} mb={dense ? 2 : 0}>
        {/* The name, in its side's colour: blue yours, red the enemy's, as on the board. */}
        <Text fw={600} fz={dense ? 'sm' : 'md'} c={`${sideColor(unit)}.3`} data-side={unit.side}>
          {HEROES[unit.hero].name}
        </Text>
        <Text fz={dense ? 'xs' : 13}>
          Health{' '}
          <b>
            {unit.hp} / {unit.maxHp}
          </b>
        </Text>
      </Group>
      {dense ? (
        <div className={styles.statLine}>
          {stats.map(([id, label, value]) => (
            <span key={id}>
              <Term id={id}>{label}</Term> <b>{value}</b>
            </span>
          ))}
        </div>
      ) : (
        <>
          <div className={styles.coreStats}>
            {stats.map(([id, label, value]) => (
              <div key={id}>
                <Term id={id}>{label}</Term>
                <b>{value}</b>
              </div>
            ))}
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
        <Text fz="xs" c="grape.3" mt={4}>
          Charging {ABILITIES[unit.charging.ability].name}: triggers at slot {unit.slot}.
        </Text>
      )}
      {dense ? (
        // Names only, to scan; a tap explains one below.
        <div className={styles.abilityList}>
          {abilities.map((def) => (
            <AbilityName key={def.id} id={def.id} body={<AbilityDetail unit={unit} def={def} />}>
              {def.name}
            </AbilityName>
          ))}
          <AbilityName
            id={ult.id}
            ultimate
            body={<AbilityDetail unit={unit} def={ult} charge={ultimateState(unit)} />}
          >
            {ult.name}
            {ultimateState(unit) !== 'Used' && (
              <span className={styles.abilityChipNote}>
                {ultimateState(unit) === 'Ready'
                  ? 'Ready'
                  : `${unit.ultimateCharge}/${RULES.ultimateCharge}`}
              </span>
            )}
          </AbilityName>
        </div>
      ) : (
        <Stack gap={6} mt={8}>
          <Text fz="xs" fw={600}>
            Abilities
          </Text>
          {abilities.map((def) => (
            <AbilityLine key={def.id} unit={unit} def={def} />
          ))}
          <Text fz="xs" fw={600} mt={2}>
            <Term id="ultimate">Ultimate</Term>
          </Text>
          <AbilityLine unit={unit} def={ult} charge={ultimateState(unit)} />
        </Stack>
      )}
    </Paper>
  );
}

/** An ability's cost in this unit's slots (the action alone, before any move or yielding). */
function costText(unit: Unit, def: AbilityDef): string {
  return def.charged
    ? `Charge +${slotsForward(def.cost, unit.speed)} · Recovery +${slotsForward(def.recoveryCost!, unit.speed)}`
    : `+${slotsForward(def.cost, unit.speed)}`;
}

/**
 * The phone tooltip's explanation of a tapped ability: its cost (a Term,
 * once) and duration, then what it does, its keywords tappable in turn.
 * An ultimate says so, with how far it is from being ready.
 */
function AbilityDetail({unit, def, charge}: {unit: Unit; def: AbilityDef; charge?: string}) {
  return (
    <Text fz="xs">
      <b>{def.name}</b>
      {charge && (
        <>
          {' · '}
          <Term id="ultimate">Ultimate</Term> {charge}
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

/**
 * One ability on the stat sheet: its name and cost, in this unit's slots
 * (the action alone, before any move or yielding) and how long it lasts,
 * then what it does. An ultimate also shows how far it is from being ready.
 */
function AbilityLine({unit, def, charge}: {unit: Unit; def: AbilityDef; charge?: string}) {
  const slots = def.charged ? costText(unit, def) : `Action ${costText(unit, def)}`;
  const cost = def.duration === undefined ? slots : `Duration ${def.duration} · ${slots}`;
  return (
    <div>
      {/* The cost drops under the name when they don't fit side by side. */}
      <Group justify="space-between" gap={6}>
        <Group gap={6} wrap="nowrap">
          <Text fz="xs" fw={600} c="gray.3">
            {def.name}
          </Text>
          {charge && (
            <Badge
              size="xs"
              variant="light"
              color={charge === 'Ready' ? 'yellow' : 'gray'}
              tt="none"
            >
              {charge}
            </Badge>
          )}
        </Group>
        <Text fz={11} c="dimmed" style={{whiteSpace: 'nowrap'}}>
          {cost}
        </Text>
      </Group>
      <Text fz="xs" c="dimmed">
        <KeywordText text={def.summary(unit)} />
      </Text>
    </div>
  );
}
