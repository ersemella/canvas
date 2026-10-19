import {useMemo} from 'react';
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
  statusSlotsLeft,
  statusValue,
  tileAt,
  unitName,
  unitOptions,
} from '@canvas/games-silk-road-tactics';
import type {AbilityId, FightState, TurnPreview, Unit} from '@canvas/games-silk-road-tactics';
import styles from './TacticsPage.module.css';

const sideColor = (u: Unit) => (u.side === 'player' ? 'blue' : 'red');
const nameOf = (fight: FightState, id: string) => unitName(fight.units.find((u) => u.id === id)!);

/** The previewed outcome of the planned turn, with full numbers (7.2). */
export function TurnPreviewBox(props: {
  /** Phones: only the Confirm button; the board shows the outcome. */
  compact: boolean;
  /** No action picked: Confirm ends the turn with Hold. */
  endTurn?: boolean;
  fight: FightState;
  actingId: string;
  ability: AbilityId;
  preview: TurnPreview | null;
  /** The turn's total cost: movement plus the action. */
  cost: number;
  needsTarget: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const {fight, preview} = props;
  if (props.compact) {
    if (props.needsTarget) return null;
    return (
      <Button color="yellow" c="dark.9" fw="bold" size="sm" loading={props.busy} disabled={!preview} onClick={props.onConfirm}>
        {preview
          ? `${props.endTurn ? 'End turn' : 'Confirm'} · next turn +${(preview.slot ?? fight.currentSlot) - fight.currentSlot}`
          : 'Can’t do that'}
      </Button>
    );
  }
  if (props.needsTarget) {
    return (
      <Text fz="sm" c="yellow.3">
        {props.ability === 'throw' ? 'Tap a unit next to you, then where to throw it.' : 'Tap a highlighted target.'}
      </Text>
    );
  }
  if (!preview) return <Text c="red.4">That turn isn’t legal.</Text>;
  return (
    <Stack gap={4} className={styles.preview!}>
      {preview.charged && (
        <Text fz="xs" c="grape.3">
          Charged: triggers when your card is reached; this assumes no one moves.
        </Text>
      )}
      {preview.changes.length === 0 && <Text fz="sm">No effect on any unit.</Text>}
      {preview.changes.map((c) => (
        <Text key={c.unitId} fz="sm">
          {nameOf(fight, c.unitId)}:{' '}
          {c.hpAfter !== c.hpBefore && (
            <span className={c.hpAfter < c.hpBefore ? styles.damage : styles.heal}>
              {c.hpBefore} → {c.hpAfter}
            </span>
          )}
          {c.killed && <b> falls</b>}
          {c.from && c.to && (c.from.q !== c.to.q || c.from.r !== c.to.r) && ' moves'}
          {c.statuses.length > 0 && ` · ${c.statuses.join(', ')}`}
        </Text>
      ))}
      <Button color="yellow" c="dark.9" fw="bold" size="sm" loading={props.busy} onClick={props.onConfirm}>
        Confirm · cost {props.cost} → slot {preview.slot}
      </Button>
      <Text fz="xs" c="dimmed">
        Or tap the target again.
      </Text>
    </Stack>
  );
}

/** What's on a hex: its tile's rule, any hail, and the unit standing there (D11). */
export function HexInspector({
  fight,
  hex,
  positions,
  compact = false,
}: {
  fight: FightState;
  hex: Hex;
  positions?: Record<string, Hex> | undefined;
  compact?: boolean;
}) {
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
      {unit && <StatSheet fight={fight} unit={unit} compact={compact} />}
    </Stack>
  );
}

/** Every unit's stat sheet, enemies' included: its abilities, and for an enemy what it could do (D11). */
export function StatSheet({fight, unit, compact = false}: {fight: FightState; unit: Unit; compact?: boolean}) {
  // What an enemy could do next turn: desktop only (phones leave it out, owner 2026-10-19).
  const options = useMemo(
    () =>
      !compact && unit.side === 'enemy' && unit.alive && unit.hex && fight.phase === 'fight' ? unitOptions(fight, unit) : [],
    [fight, unit, compact]
  );
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
        <Text fw={600}>{HEROES[unit.hero].name}</Text>
        <Badge color={sideColor(unit)} variant="light">
          {unit.side === 'player' ? 'yours' : 'enemy'}
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
        <span>{compact ? 'Next turn' : 'Card'}</span>
        <b>
          {!unit.alive
            ? 'fallen'
            : unit.slot === null
              ? 'not placed'
              : compact
                ? unit.slot === fight.currentSlot
                  ? 'now'
                  : `+${unit.slot - fight.currentSlot}`
                : `slot ${unit.slot}`}
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
          {compact ? 'Abilities' : `Abilities (cost ÷ (speed ${unit.speed} + ${RULES.C}) = slots):`}
        </Text>
        {abilitiesOf(unit).map((def) => (
          <Text key={def.id} fz="xs" c="dimmed">
            <b className={styles.abilityName}>{def.name}</b> · {def.cost}
            {def.charged ? ` to charge, ${def.recoveryCost} to recover` : ''}: {def.summary}
          </Text>
        ))}
      </Stack>
      {options.length > 0 && (
        <Stack gap={2} mt={6}>
          <Text fz="xs" fw={600}>
            Could do next turn (not what it will choose):
          </Text>
          {options.map((o) => (
            <Text key={o.ability} fz="xs" c="dimmed">
              {ABILITIES[o.ability].name}:{' '}
              {o.effects
                .map(
                  (e) =>
                    `${nameOf(fight, e.unitId)}${e.damage > 0 ? ` −${e.damage}` : e.damage < 0 ? ` +${-e.damage}` : ''}${e.statuses.length ? ` (${e.statuses.join(', ')})` : ''}`
                )
                .join('; ') || 'moves only'}
            </Text>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
