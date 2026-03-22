// Core
export {SystemRegistry} from 'core/SystemRegistry';
export {World} from 'core/World';
export {Scene} from 'core/Scene';
export {Entity} from 'core/Entity';
export type {IEntity} from 'core/Entity';
export {BaseComponent, ComponentRegistry, DataComponent, registerDataComponent} from 'core/Component';
export type {IComponent} from 'core/Component';
export {BaseSystem} from 'core/System';
export type {SystemContext} from 'core/System';
export {Query} from 'core/Query';
export type {QueryDescriptor} from 'core/Query';
export {EventBus} from 'core/EventBus';

// Math
export {Vec2} from 'math/Vec2';
export {Rect} from 'math/Rect';
export {MathUtils} from 'math/MathUtils';

// Components
export {TransformComponent} from 'components/TransformComponent';
export {RenderableComponent} from 'components/RenderableComponent';
export {RigidBodyComponent} from 'components/RigidBodyComponent';
export {ColliderComponent} from 'components/ColliderComponent';
export {InputComponent} from 'components/InputComponent';
export {TagComponent} from 'components/TagComponent';
export type {CardData} from 'components/CardComponent';
export type {DraggableData} from 'components/DraggableComponent';
export type {DropTargetData} from 'components/DropTargetComponent';
export type {ChildOfData} from 'components/ChildOfComponent';
export type {RenderType} from 'components/RenderableComponent';

// Systems — core (flat)
export {InputSystem, inputService} from 'systems/InputSystem';
export {InputFlushSystem} from 'systems/InputFlushSystem';
export {RenderSystem} from 'systems/RenderSystem';
export {ChildTransformSystem} from 'systems/ChildTransformSystem';
export {TriggerSystem} from 'systems/TriggerSystem';
export type {TriggerData} from 'systems/TriggerSystem';
export {MouseSystem, mouseService} from 'systems/MouseSystem';
export {DragDropSystem} from 'systems/DragDropSystem';
export type {DragDropBeforePayload, DragDropDroppedPayload} from 'systems/DragDropSystem';
export {ClickSystem} from 'systems/ClickSystem';
export type {ClickPayload} from 'systems/ClickSystem';
export type {ClickableData} from 'components/ClickableComponent';

// Systems — physics (mutually exclusive with grid)
export {PhysicsSystem} from 'systems/physics/PhysicsSystem';
export {CollisionSystem} from 'systems/physics/CollisionSystem';

// Systems — grid (mutually exclusive with physics)
export {GridMovementSystem} from 'systems/grid/GridMovementSystem';
export type {GridMovementData} from 'systems/grid/GridMovementSystem';
export {CollectSystem} from 'systems/grid/CollectSystem';
export type {CollectibleData} from 'systems/grid/CollectSystem';
export {RespawnSystem} from 'systems/grid/RespawnSystem';
export type {RespawnData} from 'systems/grid/RespawnSystem';
export {BoundsTriggerSystem} from 'systems/grid/BoundsTriggerSystem';
export type {BoundsTriggerData} from 'systems/grid/BoundsTriggerSystem';
export {OverlapTriggerSystem} from 'systems/grid/OverlapTriggerSystem';
export type {OverlapTriggerData} from 'systems/grid/OverlapTriggerSystem';
export {TrailSystem} from 'systems/grid/TrailSystem';
export type {TrailData} from 'systems/grid/TrailSystem';

// Loaders
export {registerBuiltinComponents, loadComponents, registerBuiltinSystems} from 'loader/ComponentLoader';
export {createGameModule} from 'loader/GameLoader';
export type {GameModule, GameManifest} from 'loader/GameLoader';
export {loadEntity} from 'loader/EntityLoader';
export type {EntityData} from 'loader/EntityLoader';
export {loadScene, loadSceneFromURL} from 'loader/SceneLoader';
export type {SceneData} from 'loader/SceneLoader';
export {assetLoader} from 'loader/AssetLoader';
