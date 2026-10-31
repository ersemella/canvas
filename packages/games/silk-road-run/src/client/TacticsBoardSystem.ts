import {assetLoader, BaseSystem, hexKey} from '@canvas/engine';
import type {EventBus, SystemContext} from '@canvas/engine';
import {CAMEL} from '../rules/config';
import {exitSealed, shotLane, unitAt} from '../rules/board';
import {pastExit, tileAt} from '../rules/map';
import {mapOf} from '../rules/fight';
import type {FightState} from '../rules/types';
import {trackCards} from './layout';
import type {TacticsHoverPayload} from './TacticsInputSystem';
import {Playback} from './playback';
import type {PlaybackPayload} from './playback';
import type {BoardScene} from './board/scene';
import {CARD_SLIDE_SECONDS, drawTrack, slideIndex, trackStart} from './board/track';
import type {CardSlide, TrackAdvance} from './board/track';
import {
  FLAME_FPS,
  HAIL_FPS,
  HAIL_STILL_SECONDS,
  SMOKE_FPS,
  burns,
  flies,
  drawExit,
  drawFallingHail,
  drawFan,
  drawFire,
  FIRE_FPS,
  drawGround,
  drawObstacle,
  drawObstacleSmoke,
  smokes,
  exitArrowPush,
} from './board/ground';
import {
  HIGHLIGHT,
  HOVER,
  drawCamelStep,
  drawLaneArrow,
  drawLanes,
  drawPath,
  drawRangeOutline,
} from './board/overlays';
import {
  MARK,
  drawDamage,
  drawGrappleFists,
  drawThrownAxes,
  drawHealthBar,
  drawRug,
  drawStatusMark,
  drawStatusMarks,
  drawTurnArrow,
  drawUnit,
  healthStack,
  idleFrame,
  statusMarks,
  turnArrowBob,
} from './board/units';
import {SIDE_LIGHT, center, fillHex} from './board/pixels';
import type {Point} from './board/pixels';
import {WALK_OUT_STEP_SECONDS, walkOutPlan, walkPosition} from './board/walkOut';
import type {Walk} from './board/walkOut';
import {drawPlaybackEvent, playbackScene, steppingAt} from './board/playbackDraw';
import {drawInvocationMark, drawVolleyMark} from './board/effects';
import {camelNextStep} from './board/camelStep';

/** Seconds a gone status's marker takes to rise off its unit and fade. */
const MARK_EXPIRE_SECONDS = 0.9;
/** How many pixels it rises meanwhile. */
const MARK_EXPIRE_RISE = 18;
/**
 * A status that just went (expired or cleansed): its marker rises off the unit and fades,
 * shown whether or not the unit is looked at, so it's plain it has gone.
 */
interface MarkExpiry {
  unitId: string;
  mark: [string, string];
  /** Its place in the unit's row of markers before it went, and how many there were. */
  index: number;
  count: number;
  elapsed: number;
}

/**
 * Draws the board: its ground (cached, see `drawGround`), the
 * track of cards along the top (3.1, as in Mana Khemia), tile markings,
 * highlights, arrow lanes, hail, charging areas, units (their health and
 * statuses only on their turn, or when hovered, tapped or in an aimed
 * attack's reach), and the
 * previewed outcome. Hovering a hex outlines it and shows its unit's health
 * and statuses; the side panel tells the rest. Plain shapes and text (brief section 9). The page drives it with
 * `tactics:board` events; taps come from `TacticsInputSystem`.
 */
export class TacticsBoardSystem extends BaseSystem {
  // After RenderSystem (995) has cleared the canvas.
  readonly priority = 996;
  private scene: BoardScene = {fight: null, highlights: [], selectedUnitId: null, preview: []};
  private hover: TacticsHoverPayload = {hex: null, unitId: null};
  private advance: TrackAdvance | null = null;
  /** Cards sliding to their units' new slots, by unit. */
  private slides = new Map<string, CardSlide>();
  /** Gone statuses' markers fading away. */
  private expiries: MarkExpiry[] = [];
  /** The fight drawn last frame, to see which statuses went since. */
  private shown: FightState | null = null;
  /** Seconds since the board started, for the units' idle animations. */
  private time = 0;
  /** The player's device asks for reduced motion: units hold still. */
  private still = false;
  /** A turn's events playing back; the page's scene waits until it ends. */
  private play: Playback | null = null;
  /** A won fight's party walking out, once the result shows (see `walkOutPlan`). */
  private walkOut: {key: string; start: number; walks: Map<string, Walk>} | null = null;
  private bus: EventBus | null = null;
  private cleanup: (() => void)[] = [];
  /** Bumped by whatever changes the board from outside a frame: the page's scene, the hover, a font loading. */
  private version = 0;
  /** What this frame would show (`frameKey`), worked out in `holdsFrame`. */
  private key: string | null = null;
  /** What the last frame drawn showed; null if it was mid-motion, so the next must draw. */
  private drawnKey: string | null = null;

  onInit({events}: Omit<SystemContext, 'deltaTime'>): void {
    const bus: EventBus = events;
    this.bus = bus;
    this.still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.cleanup.push(
      bus.on<BoardScene>('tactics:board', (scene) => {
        // During a playback the track follows the events instead.
        if (!this.play) this.startTrackMotion(this.scene.fight, scene.fight);
        this.scene = scene;
        this.version++;
      })
    );
    this.cleanup.push(
      bus.on<PlaybackPayload>('tactics:playback', (payload) => {
        this.play = new Playback(payload);
        // Reduced motion, or nothing to show: straight to the result.
        if (this.still || this.play.events.length === 0) this.endPlayback();
      })
    );
    this.cleanup.push(bus.on('tactics:playback-skip', () => this.endPlayback()));
    this.cleanup.push(
      bus.on<TacticsHoverPayload>('tactics:hover', (hover) => {
        this.hover = hover;
        this.version++;
      })
    );
    // Labels drawn before the pixel font loaded were drawn in a fallback.
    if (typeof document !== 'undefined' && document.fonts) {
      const fontsLoaded = () => this.version++;
      document.fonts.addEventListener('loadingdone', fontsLoaded);
      this.cleanup.push(() => document.fonts.removeEventListener('loadingdone', fontsLoaded));
    }
  }

  /**
   * True when this frame would draw what the last one did, so the canvas is
   * left as it is: the board is pixel art, which steps a few times a second
   * (idle frames, quicksand, weather, hail, the turn arrow's bob, the
   * exit's chevrons), so most frames have nothing new unless something is
   * moving.
   */
  holdsFrame({deltaTime, canvas}: SystemContext): boolean {
    this.key = this.frameKey(this.time + deltaTime, canvas);
    return this.key !== null && this.key === this.drawnKey;
  }

  /**
   * Everything a still frame depends on at `time`: what the page and the
   * hover last sent, which images have loaded, the canvas's size, and the
   * step each stepped animation is on. Null while something moves smoothly
   * (a playback, the track running on, cards sliding, statuses fading), when
   * every frame differs.
   */
  private frameKey(time: number, canvas: HTMLCanvasElement): string | null {
    const {fight} = this.scene;
    if (!fight || this.play || this.advance || this.slides.size > 0 || this.expiries.length > 0)
      return null;
    const parts: number[] = [this.version, assetLoader.settled, canvas.width, canvas.height];
    if (!this.still) {
      for (const u of fight.units) if (u.alive && u.hex) parts.push(idleFrame(u.id, time));
      if (fight.effects.length > 0) parts.push(Math.floor(time * HAIL_FPS));
      if (fight.fires?.length) parts.push(Math.floor(time * FIRE_FPS));
      if (this.scene.turnArrow !== false) parts.push(turnArrowBob(time));
      if (mapOf(fight).exits.length > 0 && !exitSealed(fight)) parts.push(exitArrowPush(time));
      if (smokes(mapOf(fight)) && Object.values(fight.tiles).includes('obstacle'))
        parts.push(Math.floor(time * SMOKE_FPS));
      if (burns(mapOf(fight)) && Object.values(fight.tiles).includes('mountain'))
        parts.push(Math.floor(time * FLAME_FPS));
      else if (flies(mapOf(fight)) && Object.values(fight.tiles).includes('obstacle'))
        parts.push(Math.floor(time * FLAME_FPS));
    }
    return parts.join(' ');
  }

  /**
   * Where each of a won fight's party is on its walk out (see
   * `walkOutPlan`), timed from when the result first showed; a unit gone
   * past the board's edge is 'gone'. Null when no one walks: the fight isn't
   * won, it has no living camel, or the device asks for reduced motion
   * (everyone stays put).
   */
  private walkingParty(fight: FightState): Map<string, {at: Point; alpha: number} | 'gone'> | null {
    const camel = fight.phase === 'won' ? fight.units.find((u) => u.hero === CAMEL) : undefined;
    if (this.still || !camel?.alive || !camel.hex) {
      this.walkOut = null;
      return null;
    }
    const key = `${fight.mapId} ${fight.currentSlot} ${hexKey(camel.hex)}`;
    if (this.walkOut?.key !== key) {
      const walks = walkOutPlan(fight);
      this.walkOut = walks && {key, start: this.time, walks};
    }
    if (!this.walkOut) return null;
    const out = new Map<string, {at: Point; alpha: number} | 'gone'>();
    for (const [id, walk] of this.walkOut.walks)
      out.set(id, walkPosition(walk, this.time - this.walkOut.start));
    return out;
  }

  /** Ends a playback (finished or skipped): the page's scene shows again. */
  private endPlayback(): void {
    if (!this.play) return;
    this.play = null;
    this.bus?.emit('tactics:playback-done', {});
  }

  onDestroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
  }

  /**
   * The fight shown changed: slide the cards whose units' slots moved (a
   * finished turn's card going back along the deck), and run the track on
   * when the turn moved it.
   */
  private startTrackMotion(before: FightState | null, after: FightState | null): void {
    if (!before || !after || before.mapId !== after.mapId) return;
    if (this.still) return;
    this.startSlides(before, after);
    this.startAdvance(before, after);
  }

  /** Each card whose unit's slot changed slides there from wherever it shows now. */
  private startSlides(before: FightState, after: FightState): void {
    const start = this.advance ? trackStart(this.advance) : before.currentSlot;
    for (const u of after.units) {
      const was = before.units.find((v) => v.id === u.id);
      if (!u.alive || u.slot === null || !was?.alive || was.slot === null) continue;
      if (was.slot === u.slot) continue;
      const slide = this.slides.get(u.id);
      const from = slide ? slideIndex(slide, was.slot, start) : Math.max(0, was.slot - start);
      this.slides.set(u.id, {from, elapsed: 0});
    }
  }

  /** A turn moved the track on: animate the cards it passed, from wherever the deck shows now. */
  private startAdvance(before: FightState, after: FightState): void {
    if (after.currentSlot <= before.currentSlot) return;
    const prev = this.advance;
    const from = prev ? Math.floor(trackStart(prev)) : before.currentSlot;
    const spent = new Map(prev?.spent);
    for (const u of before.units) {
      if (!u.alive || u.slot === null || u.slot < before.currentSlot || u.slot >= after.currentSlot)
        continue;
      // A card still on the track slides to its new slot instead.
      const now = after.units.find((v) => v.id === u.id);
      if (now?.alive && now.slot !== null && now.slot >= after.currentSlot) continue;
      spent.set(u.slot, u);
    }
    this.advance = {from, to: after.currentSlot, spent, elapsed: 0};
  }

  /** Each status that went (expired or cleansed) from `before` to `after` starts fading off its unit. */
  private startExpiries(before: FightState | null, after: FightState): void {
    // Not across fights, nor back in time.
    if (!before || before.mapId !== after.mapId || after.currentSlot < before.currentSlot) return;
    for (const u of after.units) {
      const was = before.units.find((v) => v.id === u.id);
      if (!u.alive || !was?.alive) continue;
      const marks = statusMarks(was);
      const now = new Set(statusMarks(u).map(([m]) => m));
      marks.forEach((mark, index) => {
        if (!now.has(mark[0]))
          this.expiries.push({unitId: u.id, mark, index, count: marks.length, elapsed: 0});
      });
    }
  }

  onUpdate({ctx, deltaTime, world}: SystemContext): void {
    if (world.frameHeld) {
      this.time += deltaTime;
      return;
    }
    let playing: Playback | null = null;
    if (this.play) {
      const before = this.play.display;
      const going = this.play.step(deltaTime);
      // Even on the frame it ends: the last event (the player's turn coming
      // up) shows for no time, but the card that acted before it still slides.
      if (this.play.display !== before) this.startTrackMotion(before, this.play.display);
      if (going) playing = this.play;
      else this.endPlayback();
    }
    // While playing back, the board shows the events' fight, without the page's highlights.
    const scene: BoardScene = playing ? playbackScene(playing) : this.scene;
    const {fight} = scene;
    if (!fight) return;
    if (fight !== this.shown) {
      this.startExpiries(this.shown, fight);
      this.shown = fight;
    }
    this.time += deltaTime;
    for (const e of this.expiries) e.elapsed += deltaTime;
    this.expiries = this.expiries.filter((e) => e.elapsed < MARK_EXPIRE_SECONDS);
    if (this.advance) {
      this.advance.elapsed += deltaTime;
      if (trackStart(this.advance) >= this.advance.to) this.advance = null;
    }
    for (const [id, slide] of this.slides) {
      slide.elapsed += deltaTime;
      if (slide.elapsed >= CARD_SLIDE_SECONDS) this.slides.delete(id);
    }
    const map = mapOf(fight);
    // Hail, the turn arrow, the exit's chevrons, the yurts' smoke and the mountains' fire move with time, unless the device asks for reduced motion.
    const t = this.still ? null : this.time;
    drawGround(ctx, map);
    // Sealed while a boss stands: a cross, still.
    const sealed = exitSealed(fight);
    for (const h of map.exits) drawExit(ctx, h, pastExit(map, h), t, sealed);
    // Princess Iron Fan's fires and the fan she drops, on the ground under the units.
    for (const f of fight.fires ?? []) drawFire(ctx, f.hex, t);
    if (fight.fan) drawFan(ctx, fight.fan);
    // A won fight: the party walks out, off their hexes (no rugs), once the playback ends.
    const walking = playing ? null : this.walkingParty(fight);
    // A frame mid-motion: the next draws again whatever the key says.
    const moving =
      playing !== null ||
      this.advance !== null ||
      this.slides.size > 0 ||
      this.expiries.length > 0 ||
      [...(walking?.values() ?? [])].some((w) => w !== 'gone');
    this.drawnKey = moving ? null : this.key;
    // Each unit stands on a rug in its side's colour, under the highlights so moves and targets still show.
    const previewed = new Map(scene.preview.map((p) => [p.unitId, p]));
    for (const u of fight.units) {
      const hex = u.hex;
      if (!u.alive || !hex || walking?.has(u.id)) continue;
      const p = previewed.get(u.id);
      const moved = Boolean(p?.to && hexKey(p.to) !== hexKey(hex));
      drawRug(ctx, hex, u.side, moved || p?.killed ? 0.4 : 1);
      if (p?.to && moved && !p.killed) drawRug(ctx, p.to, u.side, 0.7);
    }
    for (const h of scene.highlights) fillHex(ctx, h.hex, HIGHLIGHT[h.kind]);
    // The hovered hex's outline goes under the units, so it never crosses a sprite.
    if (this.hover.hex) fillHex(ctx, this.hover.hex, HOVER);
    if (scene.path && scene.path.length > 1) drawPath(ctx, scene.path);

    const acting = fight.awaiting;
    // A unit's border covers its hex's outline, so a targeted unit rings
    // itself; so does the Grappler, as Throw's swap landing.
    const targeted = new Map<string, 'target' | 'chosen'>();
    for (const h of scene.highlights)
      if (h.kind === 'chosen') targeted.set(hexKey(h.hex), 'chosen');
      else if ((h.kind === 'target' || h.kind === 'landing') && !targeted.has(hexKey(h.hex)))
        targeted.set(hexKey(h.hex), 'target');
    for (const u of fight.units) {
      const hex = u.hex;
      if (!u.alive || !hex) continue;
      const walk = walking?.get(u.id);
      if (walk) {
        if (walk !== 'gone')
          drawUnit(ctx, u, hex, {
            acting: false,
            selected: false,
            faded: false,
            frame: Math.floor(this.time / WALK_OUT_STEP_SECONDS),
            at: walk.at,
            alpha: walk.alpha,
          });
        continue;
      }
      const p = previewed.get(u.id);
      const moved = p && p.to && hexKey(p.to) !== hexKey(hex);
      drawUnit(ctx, u, hex, {
        acting: u.id === acting,
        selected: u.id === scene.selectedUnitId || u.id === this.hover.unitId,
        faded: Boolean(moved || p?.killed),
        frame: this.still ? 0 : idleFrame(u.id, this.time),
        targeted: targeted.get(hexKey(hex)),
        ...(playing ? {at: steppingAt(playing, u.id)} : {}),
      });
      if (p && moved && !p.killed)
        drawUnit(ctx, u, p.to!, {
          acting: false,
          selected: false,
          faded: false,
          ghost: true,
          frame: 0,
        });
    }

    // Yurts, ruins, beacon towers (and their smoke) and mountains in front
    // of the units (owner, 2026-10-24; obstacles under them until a beacon
    // tower's top was drawn under the unit behind it, 2026-10-26): each
    // rises into the space above it, in front of whoever stands there, as
    // nearer things are in a three-quarter view, and stays inside its own
    // space below, so never covers the unit in front; never in front of
    // health, statuses or damage.
    for (const h of map.hexes)
      if (tileAt(map, h) === 'obstacle') {
        drawObstacle(ctx, h, map, false, t);
        drawObstacleSmoke(ctx, h, map, t);
      }
    for (const h of map.hexes)
      if (tileAt(map, h) === 'mountain') drawObstacle(ctx, h, map, true, t);

    // The damage a planned turn would deal, over everything standing.
    for (const u of fight.units) {
      const p = previewed.get(u.id);
      if (!u.alive || !u.hex || !p || p.hpAfter === p.hpBefore || walking?.has(u.id)) continue;
      const at = center(p.to ?? u.hex);
      drawDamage(ctx, at.x, at.y - 22, p.hpBefore - p.hpAfter, p.killed);
    }

    // Not on a party walking out, off their hexes.
    drawGrappleFists(ctx, fight, (u) => (walking?.has(u.id) ? null : u.hex));
    drawThrownAxes(ctx, fight);

    // Where Temee walks next, as things stand (and as the planned turn would leave them).
    const camelStep = playing || walking ? undefined : camelNextStep(fight, scene.preview);
    if (camelStep) drawCamelStep(ctx, camelStep.from, camelStep.to);

    if (scene.range) drawRangeOutline(ctx, scene.range);
    if (scene.lanes) drawLanes(ctx, scene.lanes.from, scene.lanes.lanes);
    if (scene.step) drawPath(ctx, scene.step);
    for (const d of scene.displaced ?? []) drawPath(ctx, d);

    // Hail falls in front of whoever stands in it; with reduced motion, held mid-fall.
    for (const effect of fight.effects) drawFallingHail(ctx, effect.hex, t ?? HAIL_STILL_SECONDS);
    // Drawn arrows in the air: a dotted arrow, as Snap Shot aims, from the
    // shooter to where it would hit now, in its side's light colour.
    // A Volley also marks the space it will land on.
    // An Invocation marks its whole area instead.
    for (const v of fight.shots ?? []) {
      const archer = fight.units.find((u) => u.id === v.source);
      if (v.ability === 'invocation') {
        if (archer?.alive && v.hex)
          drawInvocationMark(ctx, v.hex, shotLane(fight, map, v), SIDE_LIGHT[archer.side]);
        continue;
      }
      const last = shotLane(fight, map, v).at(-1);
      if (archer?.hex && last) drawLaneArrow(ctx, archer.hex, last, SIDE_LIGHT[archer.side], true);
      if (archer && v.hex) drawVolleyMark(ctx, v.hex, SIDE_LIGHT[archer.side]);
    }

    if (playing) drawPlaybackEvent(ctx, playing);

    // Health and statuses show only on the unit whose turn it is, the unit
    // being looked at (hovered on the board or the track, or tapped), and
    // whoever an attack being aimed could hit, where the turn would move it.
    const looked = new Set<string>();
    if (fight.awaiting) looked.add(fight.awaiting);
    if (scene.inspectedUnitId) looked.add(scene.inspectedUnitId);
    for (const id of scene.healthUnitIds ?? []) looked.add(id);
    if (this.hover.unitId) looked.add(this.hover.unitId);
    const hovered = this.hover.hex && unitAt(fight, this.hover.hex);
    if (hovered) looked.add(hovered.id);
    for (const u of fight.units) {
      const hex = u.hex;
      if (!u.alive || !hex || !looked.has(u.id)) continue;
      const p = previewed.get(u.id);
      const at = p?.to && !p.killed ? p.to : hex;
      const marks = statusMarks(u);
      const stack = healthStack(at, marks.length);
      drawHealthBar(ctx, u, at, stack.barY, p?.hpBefore ?? u.hp, p?.hpAfter);
      drawStatusMarks(ctx, marks, at, stack.marksY);
    }
    // The unit you're controlling: an arrow over it, so it never needs finding.
    // Not while a turn plays back, when whoever the events move is acting.
    const yours = fight.units.find((u) => u.id === fight.awaiting);
    if (
      this.scene.turnArrow !== false &&
      !playing &&
      fight.phase === 'fight' &&
      yours?.alive &&
      yours.hex &&
      yours.side === 'player'
    ) {
      const p = previewed.get(yours.id);
      const at = p?.to && !p.killed ? p.to : yours.hex;
      drawTurnArrow(ctx, at, statusMarks(yours).length, t);
    }
    for (const e of this.expiries) {
      const u = fight.units.find((v) => v.id === e.unitId);
      const hex = u?.hex;
      if (!u?.alive || !hex) continue;
      const k = e.elapsed / MARK_EXPIRE_SECONDS;
      const c = center(hex);
      const x = c.x + (e.index - (e.count - 1) / 2) * MARK.step;
      // Reduced motion: it fades where it was.
      const rise = this.still ? 0 : MARK_EXPIRE_RISE * (1 - (1 - k) ** 2);
      const y = healthStack(hex, e.count).marksY - rise;
      drawStatusMark(ctx, e.mark, x, y, 1 - k * k);
    }

    drawTrack(
      ctx,
      fight,
      trackCards(fight, scene.previewSlot ?? null, scene.previewBumps),
      scene.previewSlot ?? null,
      scene.previewBumps ?? {},
      this.advance,
      this.slides,
      {
        selected: scene.selectedUnitId,
        hovered: this.hover.unitId,
        arrange: scene.arrange ?? null,
      }
    );
  }
}
