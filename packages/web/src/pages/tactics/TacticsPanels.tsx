import {Badge, Button, Group, Paper, Stack, Text} from '@mantine/core';
import {hexEquals} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {
  ABILITIES,
  HEROES,
  RULES,
  TILE_INFO,
  abilitiesOf,
  hailInfo,
  isFlanked,
  mapOf,
  movementCap,
  slotsForward,
  statusSlotsLeft,
  statusValue,
  tileAt,
} from '@canvas/games-silk-road-tactics';
import type {FightState, TurnPreview, Unit} from '@canvas/games-silk-road-tactics';
import styles from './TacticsPage.module.css';

const sideColor = (u: Unit) => (u.side === 'player' ? 'blue' : 'red');

/**
 * The turn's one button: Confirm with the chosen action, or End turn with
 * none (Hold), saying when the next turn comes in slots from now. The
 * outcome itself is drawn on the board (7.2).
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
  return (
    <Button color="yellow" c="dark.9" fw="bold" size="sm" loading={props.busy} disabled={!preview} onClick={props.onConfirm}>
      {preview
        ? `${props.endTurn ? 'End turn' : 'Confirm'} · next turn +${(preview.slot ?? fight.currentSlot) - fight.currentSlot}`
        : 'Can’t do that'}
    </Button>
  );
}

/** What's on a hex: its tile's rule, any hail, and the unit standing there (D11). */
export function HexInspector({fight, hex, positions}: {fight: FightState; hex: Hex; positions?: Record<string, Hex> | undefined}) {
  const tile = tileAt(mapOf(fight), hex);
  const info = TILE_INFO[tile];
  const hail = fight.effects.find((e) => hexEquals(e.hex, hex));
  const unit = fight.units.find((u) => {
    const at = positions?.[u.id] ?? u.hex;
    return u.alive && at && hexEquals(at, hex);
  });
  // Plain sand under a unit says nothing worth a card.
  const showTile = tile !== 'sand' || hail || !unit;
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
        </Paper>
      )}
      {unit && <StatSheet fight={fight} unit={unit} />}
    </Stack>
  );
}

/** Every unit's stat sheet, enemies' included: its abilities, and for an enemy what it could do (D11). */
export function StatSheet({fight, unit}: {fight: FightState; unit: Unit}) {
  const slot = fight.currentSlot;
  const statuses = [
    statusValue(unit, 'immobilized') ? `Immobilized (${statusSlotsLeft(unit, 'immobilized', slot)} slots)` : null,
    statusValue(unit, 'slowed') ? `Slowed ${statusValue(unit, 'slowed')} (${statusSlotsLeft(unit, 'slowed', slot)} slots)` : null,
    statusValue(unit, 'vulnerable')
      ? `Vulnerable ${statusValue(unit, 'vulnerable')}% (${statusSlotsLeft(unit, 'vulnerable', slot)} slots)`
      : null,
    unit.alive && isFlanked(fight, unit) ? `Flanked: Vulnerable ${RULES.flankVulnerable}%` : null,
  ].filter(Boolean);
  const ult = HEROES[unit.hero].ultimate;
  return (
    <Paper bg="dark.7" p="sm" radius="md" data-testid="stat-sheet">
      <Group justify="space-between" mb={4}>
        {/* The name, in its side's colour: blue yours, red the enemy's, as on the board. */}
        <Badge color={sideColor(unit)} variant="light" size="lg" tt="none" data-side={unit.side}>
          {HEROES[unit.hero].name}
        </Badge>
      </Group>
      <div className={styles.stats}>
        <span>Health</span>
        <b>
          {unit.hp} / {unit.maxHp}
        </b>
        <span>Speed</span>
        <b>{unit.speed}</b>
        <span>Defence</span>
        <b>{unit.defence}</b>
        <span>Power</span>
        <b>{unit.power}</b>
        <span>Next turn</span>
        <b>
          {!unit.alive
            ? 'fallen'
            : unit.slot === null
              ? 'not placed'
              : unit.slot === fight.currentSlot
                ? 'now'
                : `+${unit.slot - fight.currentSlot}`}
        </b>
        <span>Move</span>
        <b>{movementCap(unit)} hexes</b>
        <span>{ABILITIES[ult].name}</span>
        <b>
          {unit.ultimateUsed
            ? 'used'
            : unit.turnsTaken >= RULES.ultimateUnlockTurns
              ? 'ready'
              : `${unit.turnsTaken}/${RULES.ultimateUnlockTurns} turns`}
        </b>
      </div>
      {statuses.length > 0 && (
        <Text fz="xs" c="orange.3" mt={4}>
          {statuses.join(' · ')}
        </Text>
      )}
      {unit.charging && (
        <Text fz="xs" c="grape.3" mt={4}>
          Charging {ABILITIES[unit.charging.ability].name}: triggers at slot {unit.slot}.
        </Text>
      )}
      <Stack gap={2} mt={6}>
        <Text fz="xs" fw={600}>
          Abilities
        </Text>
        {abilitiesOf(unit)
          // Hold isn't offered as an action: End turn is.
          .filter((def) => def.id !== 'hold')
          .map((def) => (
            <Text key={def.id} fz="xs" c="dimmed">
              {/* In this unit's slots: the action alone, before any move or yielding. */}
              <b className={styles.abilityName}>{def.name}</b> · +{slotsForward(def.cost, unit.speed)}
              {def.charged ? ` to charge, +${slotsForward(def.recoveryCost!, unit.speed)} to recover` : ''}: {def.summary}
            </Text>
          ))}
      </Stack>
    </Paper>
  );
}
