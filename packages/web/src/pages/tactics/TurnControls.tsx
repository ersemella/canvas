import {Button, Stack} from '@mantine/core';
import {hexToPixel} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {
  BOARD_LAYOUT,
  HEROES,
  HERO_PORTRAIT,
  RULES,
  SCENE_SIZE,
  abilitiesOf,
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
 * abilities as big buttons (the name, then the cost in slots), in rows of
 * two, or three for a hero with more to choose from; then Skip turn,
 * filling its row beside the run's menu. The picked one asks for its hex
 * or target, then, once it's picked, becomes its Confirm: players tap the
 * button they picked again to go (owner, 2026-10-21).
 */
export function TurnControls(props: {
  /** What an ability of this cost takes in slots, before yielding. */
  slotsLater: (actionCost: number) => number;
  /** The move action's cost in slots (a range until a hex is picked), shown in the Move button. */
  moveSlots: string | null;
  /**
   * Abilities with nothing to target, and why: disabled (unless already
   * chosen, so they can be put down). A `note` (Taunted, Obscured) shows
   * on the button in place of its cost.
   */
  outOfReach: Map<AbilityId, {why: string; note?: string}>;
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
   * The picked choice is ready: its button confirms it, saying when the
   * next turn comes (`blocked` when the rules refuse it).
   */
  confirm: {text: string; title?: string; blocked?: boolean} | null;
  onMove: () => void;
  onAbility: (id: AbilityId | null) => void;
  onConfirm: () => void;
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
  // The picked button: Confirm once it's ready, else what it still needs.
  const confirmLabel = confirm && (
    <span className={styles.bigButton}>
      <span className={styles.tileName}>{confirm.blocked ? 'Can’t do that' : 'Confirm'}</span>
      <span className={styles.bigButtonCost}>{confirm.text}</span>
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
  // A locked ultimate's charge goes on the cost's line, so a narrow tile
  // (three to a row) keeps its name on one line.
  const label = (name: string, cost: string, icon: React.ReactNode, note?: string) => (
    <span className={styles.bigButton}>
      <span className={styles.tileName}>
        {icon}
        {name}
      </span>
      <span className={styles.bigButtonCost}>
        {note && `${note} · `}
        {cost}
      </span>
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
          className={`${styles.tile} ${plannedMove && confirm ? styles.tileConfirm : ''}`}
          disabled={!props.canMove || props.waiting || Boolean(plannedMove && confirm?.blocked)}
          data-choice="move"
          data-key={props.keys ? 1 : undefined}
          aria-pressed={moving || plannedMove !== null}
          title={
            props.waiting
              ? 'Not this unit’s turn yet'
              : plannedMove
                ? (confirm?.title ?? 'Move there; tap the hex again to pick another')
                : moving
                  ? 'Pick where to move, or tap to put Move down'
                  : props.canMove
                    ? 'Move instead of using an ability; units block the path'
                    : 'Can’t move now'
          }
          onClick={plannedMove && confirm ? props.onConfirm : props.onMove}
        >
          {plannedMove && confirmLabel
            ? confirmLabel
            : moving && !plannedMove
              ? asking('Move', <AbilityIcon id="move" />)
              : label(
                  'Move',
                  props.moveSlots !== null ? `+${props.moveSlots}` : '',
                  <AbilityIcon id="move" />
                )}
        </Button>
        {defs.map((def, i) => {
          const blocked = ability !== def.id ? props.outOfReach.get(def.id) : undefined;
          const reason = unusableReason(unit, def) ?? blocked?.why ?? null;
          const lockedUlt =
            def.ultimate && !unit.ultimateUsed && unit.ultimateCharge < RULES.ultimateCharge;
          const picked = ability === def.id;
          const ready = picked && confirm !== null;
          return (
            <Button
              key={def.id}
              size="lg"
              className={`${styles.tile} ${def.ultimate ? styles.tileUltimate : ''} ${ready ? styles.tileConfirm : ''}`}
              disabled={reason !== null || props.waiting || Boolean(ready && confirm?.blocked)}
              data-choice={def.id}
              data-key={props.keys ? i + 2 : undefined}
              aria-pressed={picked}
              title={
                props.waiting
                  ? 'Not this unit’s turn yet'
                  : ready
                    ? (confirm?.title ?? `${def.name} there; tap the target again to pick another`)
                    : picked
                      ? `Pick a target, or tap to put ${def.name} down`
                      : (reason ?? def.summary(unit))
              }
              onClick={ready ? props.onConfirm : () => props.onAbility(picked ? null : def.id)}
            >
              {/* Its own cost in slots; once picked and aimed, Confirm, with any yielding. */}
              {ready && confirmLabel
                ? confirmLabel
                : picked
                  ? asking(def.name, abilityIcon(def))
                  : blocked?.note && !unusableReason(unit, def)
                    ? label(def.name, blocked.note, abilityIcon(def))
                    : label(
                        def.name,
                        `+${props.slotsLater(def.cost)}`,
                        abilityIcon(def),
                        lockedUlt ? `${unit.ultimateCharge}/${RULES.ultimateCharge}` : undefined
                      )}
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
  const below = (p.y + BOARD_LAYOUT.size) * k + CHIP_GAP;
  const top =
    below + CHIP_HEIGHT <= props.boardSize.height
      ? below
      : (p.y - BOARD_LAYOUT.size) * k - CHIP_GAP - CHIP_HEIGHT;
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
