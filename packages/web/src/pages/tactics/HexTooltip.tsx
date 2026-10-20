import {useState} from 'react';
import {Text} from '@mantine/core';
import type {Hex} from '@canvas/engine';
import {SCENE_SIZE, TRACK_AREA, hexOverlaySpan} from '@canvas/games-silk-road-tactics';
import type {FightState} from '@canvas/games-silk-road-tactics';
import {HexInspector} from './TacticsPanels';
import styles from './TacticsPage.module.css';

/** Pixels between the tooltip and what it keeps clear of, and from the board's sides. */
const GAP = 6;
/** Above the hex if there's this much room, else on whichever side has more. */
const MIN_ABOVE = 140;

/**
 * Phones: what's on the inspected hex, in a tooltip over the board beside
 * it, clear of the unit's health bar and statuses and of the track. Short
 * at first; a tap shows the full sheet, scrolling inside the tooltip.
 * `boardSize` is the canvas's size on screen; the tooltip sits in the
 * board's box, whose top left is the canvas's.
 */
export function HexTooltip(props: {
  fight: FightState;
  hex: Hex;
  boardSize: {width: number; height: number};
}) {
  const [full, setFull] = useState(false);
  const {width, height} = props.boardSize;
  const s = width / SCENE_SIZE.width;
  const span = hexOverlaySpan(props.fight, props.hex);
  const trackBottom = (TRACK_AREA.y + TRACK_AREA.height) * s;
  const roomAbove = span.top * s - trackBottom - 2 * GAP;
  const roomBelow = height - span.bottom * s - 2 * GAP;
  const above = roomAbove >= MIN_ABOVE || roomAbove >= roomBelow;
  const w = Math.min(320, width - 2 * GAP);
  const left = Math.min(width - w - GAP, Math.max(GAP, span.x * s - w / 2));
  return (
    <div
      className={styles.tooltip}
      data-testid="hex-tooltip"
      role="button"
      tabIndex={0}
      aria-expanded={full}
      onClick={() => setFull((f) => !f)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        setFull((f) => !f);
      }}
      style={{
        left,
        width: w,
        maxHeight: above ? roomAbove : roomBelow,
        ...(above ? {bottom: height - span.top * s + GAP} : {top: span.bottom * s + GAP}),
      }}
    >
      <HexInspector fight={props.fight} hex={props.hex} compact={!full} />
      <Text fz={10} c="dimmed" ta="center" mt={4}>
        {full ? 'Tap for less' : 'Tap for more'}
      </Text>
    </div>
  );
}
