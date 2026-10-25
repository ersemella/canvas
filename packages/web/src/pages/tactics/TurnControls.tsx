import {Button, Stack} from '@mantine/core';
import {hexToPixel} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {
  BOARD_LAYOUT,
  HEROES,
  HERO_PORTRAIT,
  SCENE_SIZE,
  abilitiesOf,
  chargeOf,
  unusableReason,
} from '@canvas/games-silk-road-run';
import type {AbilityId, Reach, Unit} from '@canvas/games-silk-road-run';
import {AbilityIcon, abilityIcon} from './AbilityIcon';
import styles from './TacticsPage.module.css';

/** The abilities a unit's turn offers as buttons: no Hold, since Confirm reads End turn with no action picked. */
function choiceAbilities(unit: Unit) {
  return abilitiesOf(unit).filter((def) => def.id !== 'hold');
}

/**
 * Move and the abilities in rows of two, or three for a hero with more to
 * choose from; Move alone (the camel) fills the row.
 */
function choiceColumns(unit: Unit): number {
  const choices = choiceAbilities(unit).length + 1;
  return choices === 1 ? 1 : choices > 4 ? 3 : 2;
}

/** The rows a unit's choices take. */
export function choiceRows(unit: Unit): number {
  return Math.ceil((choiceAbilities(unit).length + 1) / choiceColumns(unit));
}

/**
 * The turn's choices, the same on phones and desktop: Move and the
 * abilities as big buttons (the name, then when the next turn comes), in rows of
 * two, or three for a hero with more to choose from; then Skip turn,
 * filling its row beside the run's menu. The picked one asks for its hex
 * or target, then, once it's picked, becomes its Cancel, saying when the
 * next turn comes: a second tap on the hex goes (owner, 2026-10-25).
 */
export function TurnControls(props: {
  /** Slots until the unit's next turn, whatever it does, before yielding (3.2). */
  slotsLater: number | null;
  /**
   * Abilities with nothing to target, and why: disabled (unless already
   * chosen, so they can be put down).
   */
  outOfReach: Map<AbilityId, {why: string}>;
  unit: Unit;
  ability: AbilityId | null;
  plannedMove: Reach | null;
  moving: boolean;
  canMove: boolean;
  /**
   * A turn is being sent or played back (the empty slots and the enemies'
   * turns before this unit's): every choice is disabled until it's this
   * unit's turn on the board too.
   */
  waiting: boolean;
  /**
   * Rows of choices to make room for: the party's most, so the camel's turn
   * (Move alone, and it acts first) doesn't shrink the section and move the board.
   */
  rows: number;
  /** What the picked choice still needs picked on the board, if anything: its button says so. */
  needsTarget: string | null;
  /**
   * The picked choice is ready: its button cancels it, saying when the
   * next turn comes (`blocked` when the rules refuse it).
   */
  confirm: {text: string; title?: string; blocked?: boolean} | null;
  onMove: () => void;
  onAbility: (id: AbilityId | null) => void;
  /** The run's menu, beside Skip turn. */
  menu: React.ReactNode;
  /**
   * The unit's portrait before Skip turn, to say whose turn it is (on a
   * phone, the board's arrow over it read as "tap here"); a tap on it looks at the unit.
   */
  onPortrait?: (() => void) | undefined;
  /** The unit's details are showing (its portrait reads as pressed). */
  portraitOpen?: boolean;
  /** Desktop: each choice shows its number key. */
  keys?: boolean;
  children?: React.ReactNode;
}) {
  const {unit, ability, plannedMove, moving, confirm} = props;
  const defs = choiceAbilities(unit);
  // The picked button: Cancel once it's ready, else what it still needs.
  const cancelLabel = confirm && (
    <span className={styles.bigButton}>
      <span className={styles.tileName}>Cancel</span>
      <span className={styles.bigButtonCost}>
        {confirm.blocked ? 'Can’t do that' : confirm.text}
      </span>
    </span>
  );
  const asking = (name: string, icon: React.ReactNode) => (
    <span className={styles.bigButton}>
      <span className={styles.tileName}>
        {icon}
        {name}
      </span>
      <span className={styles.bigButtonCost}>{props.needsTarget}</span>
    </span>
  );
  // A charged ability (Skirmish) sends the card its charge on instead, to land.
  const next = (charge = 0) =>
    charge > 0 ? `+${charge}` : props.slotsLater !== null ? `+${props.slotsLater}` : '';
  const label = (name: string, icon: React.ReactNode, charge = 0) => (
    <span className={styles.bigButton}>
      <span className={styles.tileName}>
        {icon}
        {name}
      </span>
      <span className={styles.bigButtonCost}>{next(charge)}</span>
    </span>
  );
  return (
    <Stack gap={8} data-testid="turn-controls">
      {/* One choice per turn: Move or an ability, picked like any other. */}
      <div
        className={styles.abilityGrid}
        style={
          {
            '--rows': props.rows,
            gridTemplateColumns: `repeat(${choiceColumns(unit)}, 1fr)`,
            minHeight: `calc(${props.rows} * var(--tile-height) + ${props.rows - 1} * var(--tile-gap))`,
          } as React.CSSProperties
        }
      >
        <Button
          size="lg"
          className={styles.tile!}
          disabled={!props.canMove || props.waiting}
          data-choice="move"
          data-key={props.keys ? 1 : undefined}
          aria-pressed={moving || plannedMove !== null}
          title={
            props.waiting
              ? 'Not this unit’s turn yet'
              : plannedMove
                ? (confirm?.title ?? 'Tap the hex again to move there, or tap here to cancel')
                : moving
                  ? 'Pick where to move, or tap to put Move down'
                  : props.canMove
                    ? 'Move instead of using an ability; units block the path'
                    : 'Can’t move now'
          }
          onClick={props.onMove}
        >
          {plannedMove && cancelLabel
            ? cancelLabel
            : moving && !plannedMove
              ? asking('Move', <AbilityIcon id="move" />)
              : label('Move', <AbilityIcon id="move" />)}
        </Button>
        {defs.map((def, i) => {
          const blocked = ability !== def.id ? props.outOfReach.get(def.id) : undefined;
          const reason = unusableReason(unit, def) ?? blocked?.why ?? null;
          const picked = ability === def.id;
          const ready = picked && confirm !== null;
          return (
            <Button
              key={def.id}
              size="lg"
              className={styles.tile!}
              disabled={reason !== null || props.waiting}
              data-choice={def.id}
              data-key={props.keys ? i + 2 : undefined}
              aria-pressed={picked}
              title={
                props.waiting
                  ? 'Not this unit’s turn yet'
                  : ready
                    ? (confirm?.title ??
                      `Tap the target again to use ${def.name}, or tap here to cancel`)
                    : picked
                      ? `Pick a target, or tap to put ${def.name} down`
                      : (reason ?? def.summary(unit))
              }
              onClick={() => props.onAbility(picked ? null : def.id)}
            >
              {/* When the next turn comes; once picked and aimed, Cancel, with any yielding. */}
              {ready && cancelLabel
                ? cancelLabel
                : picked
                  ? asking(def.name, abilityIcon(def))
                  : label(def.name, abilityIcon(def), chargeOf(unit, def.id))}
            </Button>
          );
        })}
      </div>
      <div className={styles.confirmRow}>
        {props.onPortrait && (
          <UnitPortrait unit={unit} open={Boolean(props.portraitOpen)} onTap={props.onPortrait} />
        )}
        {props.children}
        {props.menu}
      </div>
    </Stack>
  );
}

/**
 * A unit's portrait, framed like its track card (its hero's letter if it has
 * none): a tap looks at the unit, as its card does.
 */
function UnitPortrait(props: {unit: Unit; open: boolean; onTap: () => void}) {
  const src = HERO_PORTRAIT[props.unit.hero]?.src;
  const name = HEROES[props.unit.hero].name;
  return (
    <button
      type="button"
      className={styles.portrait}
      title={name}
      aria-label={`Look at ${name}`}
      aria-pressed={props.open}
      data-testid="turn-portrait"
      onClick={(e) => {
        // Not a tap away, which would close the details it opens.
        e.stopPropagation();
        props.onTap();
      }}
    >
      {src ? <img src={src} alt="" /> : HEROES[props.unit.hero].letter}
    </button>
  );
}

/** The chip's height, and its gap from the hex, in screen pixels. */
const CHIP_HEIGHT = 34;
const CHIP_GAP = 4;

/**
 * Desktop: Confirm on the board, under the hex picked last (over it on the
 * bottom row), saying when the next turn comes; "Can't do that" when the
 * rules refuse the turn.
 */
export function BoardConfirm(props: {
  hex: Hex;
  boardSize: {width: number; height: number};
  text: string | null;
  onConfirm: () => void;
}) {
  const k = props.boardSize.width / SCENE_SIZE.width;
  const p = hexToPixel(props.hex, BOARD_LAYOUT);
  // A flat-top hex's top and bottom edges, half its height from its centre.
  const half = (Math.sqrt(3) / 2) * BOARD_LAYOUT.size;
  const below = (p.y + half) * k + CHIP_GAP;
  const top =
    below + CHIP_HEIGHT <= props.boardSize.height
      ? below
      : (p.y - half) * k - CHIP_GAP - CHIP_HEIGHT;
  const left = Math.min(Math.max(p.x * k, 64), props.boardSize.width - 64);
  return (
    <Button
      className={`${styles.seal} ${styles.boardConfirm}`}
      data-testid="board-confirm"
      fw="bold"
      size="xs"
      style={{left, top, height: CHIP_HEIGHT}}
      disabled={props.text === null}
      title="Or click the hex again, or press Enter"
      onClick={(e) => {
        // Not a click away from the board.
        e.stopPropagation();
        props.onConfirm();
      }}
    >
      {props.text === null ? 'Can’t do that' : `Confirm ${props.text}`.trim()}
    </Button>
  );
}
