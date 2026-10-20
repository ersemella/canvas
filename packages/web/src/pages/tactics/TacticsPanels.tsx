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
import type {FightState, TurnPreview, Unit} from '@canvas/games-silk-road-tactics';
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

/**
 * What's on a hex: its tile's rule, any hail, and the unit standing there (D11).
 * `compact` (the phone's tooltip): each rule in short and the unit's sheet
 * pared down to what changes during a fight.
 */
export function HexInspector({
  fight,
  hex,
  compact = false,
}: {
  fight: FightState;
  hex: Hex;
  compact?: boolean;
}) {
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
          <Text fw={600} fz={compact ? 'sm' : 'md'}>
            {info.name}
          </Text>
          <Text fz="xs" c="dimmed">
            {compact ? info.short : info.detail}
          </Text>
          {hail && (
            <Text fz="xs" c="cyan.3" mt={4}>
              <b>Hail.</b> {hailInfo(hail, fight.currentSlot)[compact ? 'short' : 'detail']}
            </Text>
          )}
          {fog && (
            <Text fz="xs" c="gray.4" mt={4}>
              <b>Fog.</b> {fogInfo(fog, fight.currentSlot)[compact ? 'short' : 'detail']}
            </Text>
          )}
        </Paper>
      )}
      {unit && <StatSheet fight={fight} unit={unit} compact={compact} />}
    </Stack>
  );
}

/** When a unit acts next, from now. */
function nextTurn(fight: FightState, unit: Unit): string {
  if (!unit.alive) return 'fallen';
  if (unit.slot === null) return 'not placed';
  return unit.slot === fight.currentSlot ? 'now' : `+${unit.slot - fight.currentSlot}`;
}

/** Whether a unit's ultimate is used, ready, or how many turns it has towards it. */
function ultimateState(unit: Unit): string {
  if (unit.ultimateUsed) return 'used';
  if (unit.turnsTaken >= RULES.ultimateUnlockTurns) return 'ready';
  return `${unit.turnsTaken}/${RULES.ultimateUnlockTurns} turns`;
}

/**
 * Every unit's stat sheet, enemies' included: its abilities, and for an enemy
 * what it could do (D11). `compact`: health, next turn and the ultimate on
 * one line, then statuses; no fixed stats or abilities.
 */
export function StatSheet({
  fight,
  unit,
  compact = false,
}: {
  fight: FightState;
  unit: Unit;
  compact?: boolean;
}) {
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
  const ult = HEROES[unit.hero].ultimate;
  return (
    <Paper bg="dark.7" p="sm" radius="md" data-testid="stat-sheet">
      <Group justify="space-between" mb={4}>
        {/* The name, in its side's colour: blue yours, red the enemy's, as on the board. */}
        <Badge
          color={sideColor(unit)}
          variant="light"
          size={compact ? 'md' : 'lg'}
          tt="none"
          data-side={unit.side}
        >
          {HEROES[unit.hero].name}
        </Badge>
      </Group>
      {compact ? (
        <Text fz="xs">
          Health{' '}
          <b>
            {unit.hp} / {unit.maxHp}
          </b>{' '}
          · Next turn <b>{nextTurn(fight, unit)}</b> · {ABILITIES[ult].name}{' '}
          <b>{ultimateState(unit)}</b>
        </Text>
      ) : (
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
          <b>{nextTurn(fight, unit)}</b>
          <span>Move</span>
          <b>{movementCap(unit)} hexes</b>
          <span>{ABILITIES[ult].name}</span>
          <b>{ultimateState(unit)}</b>
        </div>
      )}
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
      {!compact && (
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
                <b className={styles.abilityName}>{def.name}</b> · +
                {slotsForward(def.cost, unit.speed)}
                {def.charged
                  ? ` to charge, +${slotsForward(def.recoveryCost!, unit.speed)} to recover`
                  : ''}
                : {def.summary(unit)}
              </Text>
            ))}
        </Stack>
      )}
    </Paper>
  );
}
