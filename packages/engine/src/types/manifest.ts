/**
 * Game Manifest Types
 *
 * A game is fully described by a {@link GameManifest} object. It can be
 * serialized to JSON and loaded from anywhere — local imports, a CDN, or a
 * database. The engine deserializes it, instantiates the requested systems,
 * and runs the scene without any additional code.
 *
 * Authoring flow:
 *   1. Define entities with components in {@link SceneData}
 *   2. List the built-in systems the game needs in {@link GameManifest.systems}
 *   3. Export the manifest (directly as JSON or via a generate script)
 *
 * @module
 */

// ─── Component data types imported from their definitions ────────────────────
import type {CardData} from 'components/CardComponent';
import type {DraggableData} from 'components/DraggableComponent';
import type {DropTargetData} from 'components/DropTargetComponent';
import type {DragGroupData} from 'components/DragGroupComponent';
import type {PileMemberData} from 'components/PileMemberComponent';
import type {PileLayoutData} from 'components/PileLayoutComponent';
import type {ClickableData} from 'components/ClickableComponent';
import type {ChildOfData} from 'components/ChildOfComponent';
import type {GridCursorData} from 'components/GridCursorComponent';
import type {CardPileConfigData} from 'components/CardPileConfigComponent';
import type {DeckConfigData} from 'components/DeckConfigComponent';
import type {GridPuzzleConfigData, GridPuzzleData} from 'components/GridPuzzleConfigComponent';
import type {BlackjackConfigData} from 'components/BlackjackConfigComponent';
import type {PokerConfigData} from 'components/PokerConfigComponent';

// ─── Primitives ──────────────────────────────────────────────────────────────

// ─── Transform ───────────────────────────────────────────────────────────────

/**
 * Position, rotation, and scale of an entity in world space.
 *
 * The canvas coordinate system has (0, 0) at the top-left, with x increasing
 * right and y increasing down. Entity positions are at the center of the entity.
 */
export interface TransformData {
  /** World-space center position of the entity. */
  position: {x: number; y: number};
  /** Rotation in radians, applied around the entity center. */
  rotation: number;
  /** Scale multiplier. Use `{x: 1, y: 1}` for normal size. */
  scale: {x: number; y: number};
}

// ─── Renderable ──────────────────────────────────────────────────────────────

/**
 * Renders a solid rectangle (default render type).
 *
 * @example
 * ```json
 * { "width": 70, "height": 96, "color": "#ffffff", "zIndex": 0 }
 * ```
 */
export interface RectRenderableData {
  renderType?: 'rect';
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** Draw order — higher values appear in front. */
  zIndex?: number;
  /** Whether the entity is visible. Defaults to `true`. */
  visible?: boolean;
  /** CSS color string for the fill. Defaults to `'#ffffff'`. */
  color?: string;
  /** CSS color string for the border. Omit to draw no border. */
  borderColor?: string;
  /** Border thickness in pixels. */
  borderWidth?: number;
  /** Corner radius in pixels. Omit for sharp corners. */
  radius?: number;
}

/**
 * Renders a text string at the entity's position.
 *
 * @example
 * ```json
 * { "renderType": "text", "width": 0, "height": 0, "text": "Hello", "fontSize": 16, "zIndex": 1 }
 * ```
 */
export interface TextRenderableData {
  renderType: 'text';
  /**
   * Set to `0` — unused for text entities. Required to satisfy the component
   * schema but has no visual effect.
   */
  width?: number;
  /**
   * Set to `0` — unused for text entities. Required to satisfy the component
   * schema but has no visual effect.
   */
  height?: number;
  /** Draw order — higher values appear in front. */
  zIndex?: number;
  /** Whether the text is visible. Defaults to `true`. */
  visible?: boolean;
  /** The string to render. */
  text: string;
  /** Font size in pixels. Defaults to `16`. */
  fontSize?: number;
  /** CSS font-family name. Defaults to `'Arial'`. */
  fontFamily?: string;
  /** Whether to render the text in bold. */
  bold?: boolean;
  /** CSS color string for the text. Defaults to `'#000000'`. */
  textColor?: string;
  /**
   * Text alignment relative to the entity's position.
   * - `'center'` — centered on the position (default)
   * - `'top-left'` — top-left corner at the position
   */
  textAnchor?: 'center' | 'top-left';
}

/**
 * Renders a circle at the entity's position.
 *
 * @example
 * ```json
 * { "renderType": "circle", "radius": 20, "color": "#ff0000", "zIndex": 0 }
 * ```
 */
export interface CircleRenderableData {
  renderType: 'circle';
  /** Circle radius in pixels. */
  radius: number;
  /** Draw order — higher values appear in front. */
  zIndex?: number;
  /** Whether the circle is visible. Defaults to `true`. */
  visible?: boolean;
  /** CSS color string for the fill. Defaults to `'#ffffff'`. */
  color?: string;
  /** CSS color string for the border. Omit to draw no border. */
  borderColor?: string;
  /** Border thickness in pixels. */
  borderWidth?: number;
}

/**
 * Visual rendering data for an entity. Discriminated by `renderType`.
 *
 * Omitting `renderType` (or setting it to `'rect'`) renders a rectangle.
 */
export type RenderableData = RectRenderableData | TextRenderableData | CircleRenderableData;

// ─── Input ───────────────────────────────────────────────────────────────────

/**
 * Maps logical action names to one or more browser
 * [`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code)
 * values. Place this on exactly one entity per game.
 *
 * Systems read actions via `inputService.isActionJustPressed(actionName)`.
 *
 * @example
 * ```json
 * {
 *   "actionMap": {
 *     "jump":  ["Space", "ArrowUp"],
 *     "left":  ["ArrowLeft", "KeyA"],
 *     "right": ["ArrowRight", "KeyD"]
 *   }
 * }
 * ```
 */
export interface InputData {
  /**
   * Keys are action names (arbitrary strings); values are arrays of
   * `KeyboardEvent.code` strings that trigger the action.
   */
  actionMap: Record<string, string[]>;
}

// ─── Entity components map ────────────────────────────────────────────────────

/**
 * All components that can be attached to an entity in a game manifest.
 *
 * Every field is optional — only include the components your entity needs.
 * The engine will attach each declared component when the scene is loaded.
 *
 * @example
 * ```json
 * {
 *   "id": "player",
 *   "components": {
 *     "Transform": { "position": { "x": 100, "y": 100 }, "rotation": 0, "scale": { "x": 1, "y": 1 } },
 *     "Renderable": { "width": 32, "height": 32, "color": "#00ff00", "zIndex": 1 }
 *   }
 * }
 * ```
 */
export interface EntityComponents {
  // ── Core ────────────────────────────────────────────────────────────────

  /**
   * Position, rotation, and scale in world space.
   * Required by almost every visible entity.
   */
  Transform?: TransformData;

  /**
   * Visual appearance — rectangle, text, or circle.
   * Entities without this component are not rendered.
   */
  Renderable?: RenderableData;

  /**
   * Keyboard input bindings. Place on exactly one entity per game.
   * Systems read from the shared `inputService` singleton.
   */
  Input?: InputData;

  // ── Drag and drop ───────────────────────────────────────────────────────

  /**
   * Marks this entity as draggable by the player.
   * Requires {@link DragDropSystem} in the system list.
   */
  Draggable?: DraggableData;

  /**
   * Marks this entity as a valid drop target.
   * `targetId` is the identifier passed to `dragdrop:dropped` events.
   * Requires {@link DragDropSystem} in the system list.
   */
  DropTarget?: DropTargetData;

  /**
   * Groups this entity with others for multi-entity drag operations.
   * Entities sharing a `groupId` are dragged as a unit, ordered by `groupOrder`.
   * Requires {@link DragDropSystem} in the system list.
   */
  DragGroup?: DragGroupData;

  // ── Click ───────────────────────────────────────────────────────────────

  /**
   * Marks this entity as clickable.
   * When clicked, emits a `click` event with this entity's id.
   * Requires {@link ClickSystem} in the system list.
   */
  Clickable?: ClickableData;

  // ── Scene graph ─────────────────────────────────────────────────────────

  /**
   * Attaches this entity to a parent entity.
   * The entity's `Transform` is kept at the specified offset from the parent.
   * Useful for labels, decorations, or compound entities.
   */
  ChildOf?: ChildOfData;

  // ── Card games ──────────────────────────────────────────────────────────

  /**
   * Card identity — rank (1–13), suit, face direction, and current pile.
   * Managed at runtime by {@link CardPileSystem}.
   */
  Card?: CardData;

  /**
   * Tracks which pile this entity belongs to and its position within it.
   * Read by {@link PileLayoutSystem} to compute visual positions.
   * Managed at runtime by {@link CardPileSystem}.
   */
  PileMember?: PileMemberData;

  /**
   * Declares a pile slot — an anchor point that {@link PileLayoutSystem}
   * uses to position all `PileMember` entities in the named pile.
   */
  PileLayout?: PileLayoutData;

  /**
   * Card game rules engine. Place on a dedicated config entity.
   * Declares drop rules, deal behaviors, and win conditions.
   * Requires {@link CardPileSystem} in the system list.
   *
   * @see CardPileConfigData for full documentation of all options.
   */
  CardPileConfig?: CardPileConfigData;

  /**
   * Deck definition — suits, ranks, card dimensions, and deal pattern.
   * When present, {@link CardPileSystem} shuffles and deals the deck on init
   * instead of reading pre-placed card entities from the scene.
   * Place on a dedicated config entity alongside {@link CardPileConfig}.
   */
  DeckConfig?: DeckConfigData;

  // ── Grid puzzles ─────────────────────────────────────────────────────────

  /**
   * Grid cursor — tracks the selected cell and routes keyboard navigation.
   * Place on the same entity as {@link Input}.
   * Requires {@link GridCursorSystem} in the system list.
   */
  GridCursor?: GridCursorData;

  /**
   * Grid puzzle rules engine. Place on a dedicated config entity.
   * Declares grid dimensions, constraints, win condition, and optional
   * built-in puzzle generator.
   * Requires {@link GridPuzzleSystem} in the system list.
   *
   * @see GridPuzzleConfigData for full documentation of all options.
   */
  GridPuzzleConfig?: GridPuzzleConfigData;

  /**
   * Mutable puzzle state — the given digits, the player's current board,
   * selection, and completion flag. Place on the same entity as
   * {@link GridCursor} and {@link Input}.
   * Populated at runtime by {@link GridPuzzleSystem} when `generator` is set.
   */
  GridPuzzle?: GridPuzzleData;

  // ── Blackjack ────────────────────────────────────────────────────────────

  /**
   * Blackjack game rules and layout configuration. Place on a dedicated config entity.
   * Requires {@link BlackjackSystem} in the system list.
   */
  BlackjackConfig?: BlackjackConfigData;

  // ── Poker ─────────────────────────────────────────────────────────────────

  /**
   * Poker game rules and panel entity IDs. Place on a dedicated config entity.
   * Requires {@link PokerSystem} and {@link PokerRendererSystem} in the system list.
   */
  PokerConfig?: PokerConfigData;
}

// ─── Systems ─────────────────────────────────────────────────────────────────

/**
 * All built-in system names that can be referenced in a game manifest.
 *
 * Systems are instantiated in the order listed and run every frame in
 * ascending priority order (each system class declares its own priority).
 *
 * | System | Priority | Purpose |
 * |---|---|---|
 * | `InputSystem` | 0 | Captures raw keyboard state each frame |
 * | `DragDropSystem` | 49 | Detects drag gestures and emits drop events |
 * | `ClickSystem` | 55 | Detects clicks and emits click events (skipped if drag consumed the release) |
 * | `GridCursorSystem` | 50 | Routes keyboard input to grid cell selection |
 * | `CardPileSystem` | 100 | Evaluates card game rules from `CardPileConfig` |
 * | `GridPuzzleSystem` | 100 | Evaluates grid puzzle rules from `GridPuzzleConfig` |
 * | `PileLayoutSystem` | 120 | Positions `PileMember` entities within their pile |
 * | `ChildTransformSystem` | 150 | Syncs child entity positions to their parent |
 * | `MouseSystem` | 950 | Captures mouse/touch state, flushes at end of frame |
 * | `InputFlushSystem` | 951 | Clears just-pressed state at end of frame |
 */
export type SystemName =
  | 'InputSystem'
  | 'InputFlushSystem'
  | 'MouseSystem'
  | 'DragDropSystem'
  | 'ClickSystem'
  | 'PileLayoutSystem'
  | 'CardPileSystem'
  | 'GridCursorSystem'
  | 'GridPuzzleSystem'
  | 'BlackjackSystem'
  | 'SidePanelSystem'
  | 'NetworkSystem'
  | 'PokerSystem'
  | 'PokerRendererSystem';

// ─── Scene ───────────────────────────────────────────────────────────────────

/**
 * A single entity in the scene. Every entity is a bag of components;
 * the combination of components determines what the entity is and does.
 */
export interface EntityData {
  /**
   * Unique identifier for this entity within the scene.
   * Required if other entities reference this one (e.g., via `ChildOf`,
   * `DropTarget.targetId`, or system configs like `CardPileConfig.pileIds`).
   * If omitted, the engine generates a random id.
   */
  id?: string;
  /**
   * Arbitrary string labels for the entity.
   * Currently informational — not used for runtime queries.
   */
  tags?: string[];
  /**
   * The components attached to this entity.
   * Each key is a component type name; each value is the component's data.
   */
  components?: EntityComponents;
}

/**
 * The full set of entities that make up a game world.
 */
export interface SceneData {
  /** Human-readable name for the scene. Used in debugging and tooling. */
  name: string;
  /** All entities in the scene, in declaration order. */
  entities: EntityData[];
}

// ─── Manifest ────────────────────────────────────────────────────────────────

/**
 * A complete game definition. This is the top-level structure that a game
 * author produces — either as a `.json` file or via a generate script.
 *
 * The manifest is intentionally plain JSON-serializable data: no functions,
 * no class instances, no imports from the engine at runtime. This means
 * games can be stored in a database, served from a CDN, or edited in a
 * visual editor.
 *
 * @example Minimal game manifest
 * ```json
 * {
 *   "canvas": { "width": 500, "height": 500 },
 *   "systems": ["MouseSystem", "DragDropSystem"],
 *   "scene": {
 *     "name": "my-game",
 *     "entities": [
 *       {
 *         "id": "box",
 *         "components": {
 *           "Transform": { "position": { "x": 250, "y": 250 }, "rotation": 0, "scale": { "x": 1, "y": 1 } },
 *           "Renderable": { "width": 50, "height": 50, "color": "#3498db", "zIndex": 0 },
 *           "Draggable": { "enabled": true }
 *         }
 *       }
 *     ]
 *   }
 * }
 * ```
 */
export interface GameManifest {
  /**
   * Display metadata for the game — used by loaders and the game browser.
   * Required when the manifest is hosted remotely (e.g. on S3), so the
   * game list can be built without loading every manifest up front.
   */
  meta?: {
    /** Human-readable game title shown in the game browser. */
    title: string;
    /** One-sentence description shown on the game card. */
    description: string;
  };

  /**
   * Canvas dimensions in pixels.
   * If omitted, the canvas fills its container.
   */
  canvas?: {
    /** Canvas width in pixels. */
    width: number;
    /** Canvas height in pixels. */
    height: number;
  };

  /**
   * Ordered list of built-in systems to run each frame.
   * Systems execute in ascending priority order regardless of list order.
   * All names must be registered engine built-ins — manifests cannot
   * reference custom systems.
   *
   * @see {@link SystemName} for all available systems and their priorities.
   */
  systems: SystemName[];

  /**
   * Engine-level event bindings.
   * Currently supports `onDeath` — the event name that signals game over.
   * When this event is emitted from any system, the engine stops the game
   * and navigates back to the game list.
   *
   * @example
   * ```json
   * { "onDeath": "my-game:complete" }
   * ```
   */
  events?: {
    /** The event name that ends the game. Must match the event emitted by the win-condition system. */
    onDeath?: string;
  };

  /**
   * Name of the Lambda-side server system that handles this game's actions.
   * When present, the room creation request sends this value to the server
   * so the Lambda can dispatch WS messages to the correct handler.
   * Example: `"PokerServerSystem"`
   */
  serverSystem?: string;

  /** The initial world state — all entities and their starting components. */
  scene: SceneData;
}
