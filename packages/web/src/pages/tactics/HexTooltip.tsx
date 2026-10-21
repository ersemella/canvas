import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import type {Hex} from '@canvas/engine';
import {SCENE_SIZE, hexOverlaySpan} from '@canvas/games-silk-road-tactics';
import type {FightState} from '@canvas/games-silk-road-tactics';
import {HexInspector} from './TacticsPanels';
import styles from './TacticsPage.module.css';

/** Pixels between the tooltip and what it keeps clear of, and from the screen's edges. */
const GAP = 6;
/** The widest the tooltip grows (the board's width on a phone); short content (plain sand) keeps it narrower. */
const MAX_WIDTH = 420;

interface Placement {
  left: number;
  top: number;
  maxHeight: number;
  /** The most room it could have had (the roomier side), for the e2e suite. */
  room: number;
}

/**
 * Phones: everything on the inspected hex, in a tooltip beside it, clear of
 * the hex and its unit's health bar and statuses, its keywords tappable for
 * their rules. It may leave the board: up over the track to the top of the
 * screen, and down to `floor` (the pinned action bar), or past it over the
 * action bar to the screen's bottom when it needs the room. It goes above
 * the hex if it fits there, else below above the action bar, else below
 * over it; failing all three, it takes the roomier side and scrolls (its
 * open rule kept in view): it never covers the hex or the unit's health
 * bar and statuses. It's placed again whenever its size changes
 * (a keyword's rule shown, a turn played). A tap on it closes it, unless
 * it lands on something tappable inside (a keyword, an ability's name, ×).
 *
 * `boardSize` is the canvas's size on screen; the tooltip sits in the
 * board's box, whose top left is the canvas's.
 */
export function HexTooltip(props: {
  fight: FightState;
  hex: Hex;
  boardSize: {width: number; height: number};
  /** Where the tooltip would rather stop above (the action bar's top), in viewport pixels. */
  floor: () => number | undefined;
  /** A tap on the tooltip, anywhere but a keyword, an ability's name or a button: close it. */
  onDismiss: () => void;
}) {
  const [place, setPlace] = useState<Placement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const {width} = props.boardSize;
  const s = width / SCENE_SIZE.width;
  const span = hexOverlaySpan(props.fight, props.hex);
  const {floor} = props;

  const measure = useCallback(() => {
    const el = ref.current;
    const board = el?.offsetParent;
    if (!el || !board) return;
    // The room above and below the hex, in the board's pixels.
    const b = board.getBoundingClientRect();
    const areaTop = -b.top + GAP;
    const screenBottom = window.innerHeight - b.top - GAP;
    const floorBottom = Math.min(screenBottom, (floor() ?? window.innerHeight) - b.top - GAP);
    // Its whole height, borders included, however much shows now.
    const h = el.scrollHeight + el.offsetHeight - el.clientHeight;
    // Clear of the hex, its health bar and statuses: above first, then
    // below (above the action bar, then over it, to the screen's bottom).
    const above = span.top * s - GAP;
    const below = span.bottom * s + GAP;
    const sides = [
      {above: true, edge: above, room: above - areaTop},
      {above: false, edge: below, room: floorBottom - below},
      {above: false, edge: below, room: screenBottom - below},
    ];
    // Nowhere it fits: the roomier side, scrolling.
    const side =
      sides.find((x) => h <= x.room) ?? (sides[0]!.room >= sides[2]!.room ? sides[0]! : sides[2]!);
    const w = el.offsetWidth;
    const left = Math.round(Math.min(width - w - GAP, Math.max(GAP, span.x * s - w / 2)));
    const next = {
      left,
      top: Math.round(side.above ? side.edge - Math.min(h, side.room) : side.edge),
      maxHeight: Math.floor(side.room),
      room: Math.floor(Math.max(sides[0]!.room, sides[2]!.room)),
    };
    setPlace((p) =>
      p && p.left === next.left && p.top === next.top && p.maxHeight === next.maxHeight ? p : next
    );
  }, [span.x, span.top, span.bottom, s, width, floor]);

  useLayoutEffect(measure, [measure, props.fight]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The content's size (a keyword's rule opening or closing), and its own.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      ref={ref}
      className={styles.tooltip}
      data-testid="hex-tooltip"
      data-room={place?.room}
      onClick={(e) => {
        // Keywords and ability names explain themselves on a tap; the rest closes it.
        if (!(e.target as Element).closest('button')) props.onDismiss();
      }}
      style={{
        maxWidth: Math.min(MAX_WIDTH, width - 2 * GAP),
        // Measured where it can't be seen, then placed.
        ...(place
          ? {left: place.left, top: place.top, maxHeight: place.maxHeight}
          : {left: 0, top: 0, visibility: 'hidden'}),
      }}
    >
      <div>
        <HexInspector fight={props.fight} hex={props.hex} dense />
      </div>
    </div>
  );
}
