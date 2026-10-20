import {useLayoutEffect, useRef, useState} from 'react';
import {Text} from '@mantine/core';
import type {Hex} from '@canvas/engine';
import {SCENE_SIZE, hexOverlaySpan} from '@canvas/games-silk-road-tactics';
import type {FightState} from '@canvas/games-silk-road-tactics';
import {HexInspector} from './TacticsPanels';
import type {Detail} from './TacticsPanels';
import styles from './TacticsPage.module.css';

/** Pixels between the tooltip and what it keeps clear of, and from the screen's edges. */
const GAP = 6;
/** The widest the tooltip grows; short content (plain sand) keeps it narrower. */
const MAX_WIDTH = 340;
/** Most detail first: the tooltip opens with the first that fits. */
const DETAILS: Detail[] = ['full', 'stats', 'short'];

interface Placement {
  left: number;
  top: number;
  maxHeight: number;
}

/**
 * Phones: what's on the inspected hex, in a tooltip beside it, clear of the
 * hex and its unit's health bar and statuses. It may leave the board: up
 * over the track to the top of the screen, and down to `floor` (the pinned
 * action bar), on whichever side has room. It opens with as much detail as
 * fits there; when that isn't everything, a tap shows the full sheet
 * (scrolling inside the tooltip) and another goes back.
 *
 * `boardSize` is the canvas's size on screen; the tooltip sits in the
 * board's box, whose top left is the canvas's.
 */
export function HexTooltip(props: {
  fight: FightState;
  hex: Hex;
  boardSize: {width: number; height: number};
  /** Where the tooltip must stop above, in viewport pixels; the screen's bottom without one. */
  floor: () => number | undefined;
}) {
  /** The detail it opened with, once found; null while trying each in turn. */
  const [fitted, setFitted] = useState<Detail | null>(null);
  const [detail, setDetail] = useState<Detail>(DETAILS[0]!);
  const [place, setPlace] = useState<Placement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const {width} = props.boardSize;
  const s = width / SCENE_SIZE.width;
  const span = hexOverlaySpan(props.fight, props.hex);
  const {floor} = props;

  useLayoutEffect(() => {
    const el = ref.current;
    const board = el?.offsetParent;
    if (!el || !board) return;
    // The room above and below the hex, in the board's pixels.
    const b = board.getBoundingClientRect();
    const areaTop = -b.top + GAP;
    const areaBottom = (floor() ?? window.innerHeight) - b.top - GAP;
    const aboveEdge = span.top * s - GAP;
    const belowEdge = span.bottom * s + GAP;
    const roomAbove = aboveEdge - areaTop;
    const roomBelow = areaBottom - belowEdge;
    const h = el.scrollHeight;
    if (fitted === null) {
      const next = DETAILS[DETAILS.indexOf(detail) + 1];
      if (h > Math.max(roomAbove, roomBelow) && next) return setDetail(next);
      return setFitted(detail);
    }
    const above = h <= roomAbove || (h > roomBelow && roomAbove >= roomBelow);
    const w = el.offsetWidth;
    const left = Math.min(width - w - GAP, Math.max(GAP, span.x * s - w / 2));
    setPlace(
      above
        ? {left, top: aboveEdge - Math.min(h, roomAbove), maxHeight: roomAbove}
        : {left, top: belowEdge, maxHeight: roomBelow}
    );
  }, [fitted, detail, props.fight, span.x, span.top, span.bottom, s, width, floor]);

  const more = fitted !== null && fitted !== 'full';
  const toggle = () => {
    if (more) setDetail((d) => (d === 'full' ? fitted : 'full'));
  };
  return (
    <div
      ref={ref}
      className={styles.tooltip}
      data-testid="hex-tooltip"
      data-detail={detail}
      role={more ? 'button' : undefined}
      tabIndex={more ? 0 : undefined}
      aria-expanded={more ? detail === 'full' : undefined}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        toggle();
      }}
      style={{
        maxWidth: Math.min(MAX_WIDTH, width - 2 * GAP),
        // Measured where it can't be seen, then placed.
        ...(place ?? {left: 0, top: 0, visibility: 'hidden'}),
      }}
    >
      <HexInspector fight={props.fight} hex={props.hex} detail={detail} />
      {more && (
        <Text fz={10} c="dimmed" ta="center" mt={4}>
          {detail === 'full' ? 'Tap for less' : 'Tap for more'}
        </Text>
      )}
    </div>
  );
}
