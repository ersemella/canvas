import {useEffect, useState} from 'react';
import {Badge, Button, Group, Paper, Stack, Text} from '@mantine/core';
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
  movementCap,
  slotsForward,
  statusSlotsLeft,
  statusValue,
  taunterOf,
  tileAt,
  unitName,
} from '@canvas/games-silk-road-tactics';
import type {AbilityDef, FightState, TurnPreview, Unit} from '@canvas/games-silk-road-tactics';
import styles from './TacticsPage.module.css';

const sideColor = (u: Unit) => (u.side === 'player' ? 'blue' : 'red');

/**
 * The turn's one button: Confirm with the chosen action, or End turn with
 * none (Hold), saying when the next turn comes in slots from now. When the
 * slot the cost aims at is taken, the card yields further on (3.3): it reads
 * "+3 → +5", the cost and then where the card lands, as the track draws it.
 * The outcome itself is drawn on the board (7.2).
 */
export function ConfirmButton(props: {
  /** No action picked: the button ends the turn with Hold. */
  endTurn: boolean;
  fight: FightState;
  preview: TurnPreview | null;
  needsTarget: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const {fight, preview} = props;
  if (props.needsTarget) return null;
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
      size="sm"
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
        ? `${props.endTurn ? 'End turn' : 'Confirm'}${next ? ` · next turn ${next}` : ''}`
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

/** What's on a hex: its tile's rule, any hail, and the unit standing there (D11). */
export function HexInspector({fight, hex}: {fight: FightState; hex: Hex}) {
  const tile = tileAt(mapOf(fight), hex);
  const info = TILE_INFO[tile];
  const hail = fight.effects.find((e) => hexEquals(e.hex, hex));
  const fog = fogAt(fight, hex);
  const unit = fight.units.find((u) => u.alive && u.hex && hexEquals(u.hex, hex));
  // Plain sand under a unit says nothing worth a card.
  const showTile = tile !== 'sand' || hail || fog || !unit;
  return (
    <Stack gap={8} data-testid="hex-info">
      {showTile && (
        <Paper bg="dark.7" p="sm" radius="md">
          <Text fw={600}>{info.name}</Text>
          <Text fz="xs" c="dimmed">
            {info.detail}
          </Text>
          {hail && (
            <Text fz="xs" c="cyan.3" mt={4}>
              <b>Hail.</b> {hailInfo(hail, fight.currentSlot).detail}
            </Text>
          )}
          {fog && (
            <Text fz="xs" c="gray.4" mt={4}>
              <b>Fog.</b> {fogInfo(fog, fight.currentSlot).detail}
            </Text>
          )}
        </Paper>
      )}
      {unit && <StatSheet fight={fight} unit={unit} />}
    </Stack>
  );
}

/** Every unit's stat sheet, enemies' included: its abilities, and for an enemy what it could do (D11). */
export function StatSheet({fight, unit}: {fight: FightState; unit: Unit}) {
  const slot = fight.currentSlot;
  const taunter = taunterOf(fight, unit);
  const statuses = [
    statusValue(unit, 'immobilized')
      ? `Immobilized (${statusSlotsLeft(unit, 'immobilized', slot)} slots)`
      : null,
    statusValue(unit, 'slowed')
      ? `Slowed ${statusValue(unit, 'slowed')} (${statusSlotsLeft(unit, 'slowed', slot)} slots)`
      : null,
    statusValue(unit, 'vulnerable')
      ? `Vulnerable ${statusValue(unit, 'vulnerable')}% (${statusSlotsLeft(unit, 'vulnerable', slot)} slots)`
      : null,
    statusValue(unit, 'crushed')
      ? `Crushed: ${statusValue(unit, 'crushed')} damage a slot before defence (${statusSlotsLeft(unit, 'crushed', slot)} slots)`
      : null,
    taunter
      ? `Taunted by ${unitName(taunter)}: must attack it or end its turn while it can reach it (${statusSlotsLeft(unit, 'taunted', slot)} slots)`
      : null,
    unit.alive && isFlanked(fight, unit) ? `Flanked: Vulnerable ${RULES.flankVulnerable}%` : null,
  ].filter(Boolean);
  const ult = ABILITIES[HEROES[unit.hero].ultimate];
  // Hold isn't offered as an action (End turn is), and the ultimate gets its own section.
  const abilities = abilitiesOf(unit).filter((def) => def.id !== 'hold' && !def.ultimate);
  return (
    <Paper bg="dark.7" p="sm" radius="md" data-testid="stat-sheet">
      <Group justify="space-between" mb={6}>
        {/* The name, in its side's colour: blue yours, red the enemy's, as on the board. */}
        <Badge color={sideColor(unit)} variant="light" size="lg" tt="none" data-side={unit.side}>
          {HEROES[unit.hero].name}
        </Badge>
      </Group>
      <div className={styles.vitals}>
        <span>
          Health{' '}
          <b>
            {unit.hp} / {unit.maxHp}
          </b>
        </span>
        <span>
          Move <b>{movementCap(unit)} spaces</b>
        </span>
      </div>
      <div className={styles.coreStats}>
        <div>
          <span>Speed</span>
          <b>{unit.speed}</b>
        </div>
        <div>
          <span>Power</span>
          <b>{unit.power}</b>
        </div>
        <div>
          <span>Defence</span>
          <b>{unit.defence}</b>
        </div>
      </div>
      {statuses.length > 0 && (
        <Text fz="xs" c="orange.3" mt={6}>
          {statuses.join(' · ')}
        </Text>
      )}
      {unit.charging && (
        <Text fz="xs" c="grape.3" mt={4}>
          Charging {ABILITIES[unit.charging.ability].name}: triggers at slot {unit.slot}.
        </Text>
      )}
      <Stack gap={6} mt={8}>
        <Text fz="xs" fw={600}>
          Abilities
        </Text>
        {abilities.map((def) => (
          <AbilityLine key={def.id} unit={unit} def={def} />
        ))}
        <Text fz="xs" fw={600} mt={2}>
          Ultimate
        </Text>
        <AbilityLine
          unit={unit}
          def={ult}
          charge={
            unit.ultimateUsed
              ? 'Used'
              : unit.turnsTaken >= RULES.ultimateUnlockTurns
                ? 'Ready'
                : `${unit.turnsTaken}/${RULES.ultimateUnlockTurns} turns`
          }
        />
      </Stack>
    </Paper>
  );
}

/**
 * One ability on the stat sheet: its name and cost, in this unit's slots
 * (the action alone, before any move or yielding), then what it does. An
 * ultimate also shows how far it is from being ready.
 */
function AbilityLine({unit, def, charge}: {unit: Unit; def: AbilityDef; charge?: string}) {
  const cost = def.charged
    ? `Charge +${slotsForward(def.cost, unit.speed)} · Recovery +${slotsForward(def.recoveryCost!, unit.speed)}`
    : `Action +${slotsForward(def.cost, unit.speed)}`;
  return (
    <div>
      <Group justify="space-between" gap={6} wrap="nowrap">
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
        {def.summary(unit)}
      </Text>
    </div>
  );
}
