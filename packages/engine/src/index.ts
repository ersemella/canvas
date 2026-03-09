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
export {AnimatorComponent} from 'components/AnimatorComponent';
export {AIAgentComponent} from 'components/AIAgentComponent';
export {AudioSourceComponent} from 'components/AudioSourceComponent';
export {ScriptComponent} from 'components/ScriptComponent';
export type {HookEntry} from 'components/ScriptComponent';
export {TagComponent} from 'components/TagComponent';
export type {CardData} from 'components/CardComponent';

// Systems — core (flat)
export {InputSystem, inputService} from 'systems/InputSystem';
export {InputFlushSystem} from 'systems/InputFlushSystem';
export {RendererSystem} from 'systems/RendererSystem';
export {TriggerSystem} from 'systems/TriggerSystem';
export type {TriggerData} from 'systems/TriggerSystem';
export {MouseSystem, mouseService} from 'systems/MouseSystem';

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

// Systems — animation
export {AnimationSystem} from 'systems/animation/AnimationSystem';

// Systems — script
export {ScriptSystem} from 'systems/script/ScriptSystem';

// Systems — stubs
export {AISystem} from 'systems/stubs/AISystem';
export {AudioSystem} from 'systems/stubs/AudioSystem';
export {UISystem} from 'systems/stubs/UISystem';

// Hooks
export {HookRegistry} from 'hooks/HookRegistry';
export type {LifecycleHook, HookContext, HookFactory} from 'hooks/types';

// Loaders
export {registerBuiltinComponents, loadComponents, registerBuiltinSystems} from 'loader/ComponentLoader';
export {createGameModule} from 'loader/GameLoader';
export type {GameModule, GameManifest} from 'loader/GameLoader';
export {loadEntity} from 'loader/EntityLoader';
export type {EntityData} from 'loader/EntityLoader';
export {loadHooks} from 'loader/HookLoader';
export {loadScene, loadSceneFromURL} from 'loader/SceneLoader';
export type {SceneData} from 'loader/SceneLoader';
export {assetLoader} from 'loader/AssetLoader';
