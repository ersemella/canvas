/**
 * A turn's events playing back on the board: whose turn it is, the
 * ability and where it strikes, hits, falls.
 */
import {hexDistance} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {HEROES} from '../../rules/config';
import {ABILITIES} from '../../rules/abilities';
import {isStunned} from '../../rules/board';
import {mapOf} from '../../rules/fight';
import {chargeOf} from '../../rules/track';
import {Playback, eventSeconds} from '../playback';
import {PALETTE, paletteAlpha, pixelFont} from '../palette';
import {ABILITY_EFFECT, EFFECT_FPS, drawPixelArrow} from './effects';
import type {BoardScene} from './scene';
import {HEALTH_BAR, drawDamage, drawUnit} from './units';
import {HIGHLIGHT} from './overlays';
import {SIDE_LIGHT, center, fillHex, label, lerp, tintHex} from './pixels';

/** The page's scene during a playback: the events' fight, health on whoever the event is about. */
export function playbackScene(play: Playback): BoardScene {
  const e = play.current;
  return {
    fight: play.display,
    highlights: [],
    selectedUnitId: null,
    preview: [],
    healthUnitIds: e && e.kind !== 'death' ? [e.unitId] : [],
  };
}

/** Where a unit is drawn while a playback moves it (between two hexes), or undefined. */
export function steppingAt(play: Playback, unitId: string): {x: number; y: number} | undefined {
  const e = play.current;
  if (e?.kind !== 'step' || e.unitId !== unitId) return undefined;
  const k = play.progress;
  const a = center(e.from);
  const b = center(e.to);
  // A thrown unit arcs through the air.
  const lift = e.how === 'throw' ? Math.sin(Math.PI * k) * 26 : 0;
  return {x: Math.round(lerp(a.x, b.x, k)), y: Math.round(lerp(a.y, b.y, k) - lift)};
}

/**
 * What the event showing now adds over the board: the name of whoever's
 * turn it is, an ability's name and the area or line it strikes, a hit's
 * number rising with a red flash, a fallen unit fading.
 */
export function drawPlaybackEvent(ctx: CanvasRenderingContext2D, play: Playback): void {
  const e = play.current;
  if (!e) return;
  const k = play.progress;
  const fight = play.display;
  const map = mapOf(fight);
  const u = fight.units.find((v) => v.id === e.unitId);
  if (!u) return;
  const titleY = (h: Hex) => center(h).y - (HEALTH_BAR.y + HEALTH_BAR.h + 12);
  const title = (h: Hex, text: string, color: string) => {
    ctx.save();
    ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) * 4;
    const c = center(h);
    ctx.font = pixelFont(12);
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = PALETTE.dusk0;
    ctx.fillRect(c.x - w / 2, titleY(h) - 9, w, 18);
    label(ctx, text, c.x, titleY(h), color, 12, true);
    ctx.restore();
  };
  switch (e.kind) {
    case 'turn':
      if (u.hex)
        title(
          u.hex,
          `${u.side === 'player' ? 'Your' : 'Enemy'} ${HEROES[u.hero].name}`,
          SIDE_LIGHT[u.side]
        );
      return;
    case 'action':
    case 'land': {
      const def = ABILITIES[e.ability];
      // A charged ability is only aimed now: its flourish plays as it lands.
      const charged = e.kind === 'action' && chargeOf(u, e.ability) > 0;
      const name = e.kind === 'land' ? `${def.name} lands` : def.name;
      // The area the playback lights up when it lands; the target hex alone for the rest.
      const radius = def.radius ?? 0;
      const area = e.target ? map.hexes.filter((h) => hexDistance(h, e.target!) <= radius) : [];
      const effect = charged ? undefined : ABILITY_EFFECT[e.ability];
      // Effects move in steps, as pixel art does.
      const steps = eventSeconds(e, false) * EFFECT_FPS;
      const stepped = steps > 0 ? Math.floor(k * steps) / steps : k;
      if (e.target && effect) {
        effect(ctx, {from: u.hex, target: e.target, area, k: stepped});
      } else if (e.target) {
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.6;
        for (const h of area) fillHex(ctx, h, HIGHLIGHT.area);
        ctx.restore();
      }
      // An arrow flying from the bow to its mark, or a drawn one down its lane.
      const shot =
        e.ability === 'longshot' ||
        e.ability === 'feignedRetreat' ||
        (e.ability === 'skirmish' && !charged);
      if (shot && e.target && u.hex && stepped < 0.7) {
        const a = center(u.hex);
        const b = center(e.target);
        const t = stepped / 0.7;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        drawPixelArrow(
          ctx,
          lerp(a.x, b.x, t),
          lerp(a.y, b.y, t) - 18,
          (b.x - a.x) / len,
          (b.y - a.y) / len,
          7
        );
      }
      // The name last, over the effect.
      if (u.hex) title(u.hex, name, PALETTE.lapisLight);
      return;
    }
    case 'damage': {
      if (!u.hex) return;
      const c = center(u.hex);
      tintHex(ctx, u.hex, paletteAlpha('madder', 0.55), 1 - k);
      drawDamage(ctx, c.x, c.y - 22 - k * 16, e.amount, u.hp === 0);
      return;
    }
    case 'death':
      drawUnit(ctx, u, e.hex, {
        acting: false,
        selected: false,
        faded: false,
        frame: 0,
        alpha: 1 - k,
      });
      return;
    case 'skip':
      if (u.hex)
        title(
          u.hex,
          isStunned(u) ? 'Stunned: turn skipped' : 'Turn skipped: can only hold',
          PALETTE.dusk4
        );
      return;
    case 'step':
      return;
  }
}
