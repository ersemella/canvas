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

// Systems
export {InputSystem, inputService} from 'systems/InputSystem';
export {InputFlushSystem} from 'systems/InputFlushSystem';
export {PhysicsSystem} from 'systems/PhysicsSystem';
export {CollisionSystem} from 'systems/CollisionSystem';
export {AnimationSystem} from 'systems/AnimationSystem';
export {AISystem} from 'systems/AISystem';
export {ScriptSystem} from 'systems/ScriptSystem';
export {AudioSystem} from 'systems/AudioSystem';
export {UISystem} from 'systems/UISystem';
export {RendererSystem} from 'systems/RendererSystem';
export {GridMovementSystem} from 'systems/GridMovementSystem';
export type {GridMovementData} from 'systems/GridMovementSystem';
export {CollectSystem} from 'systems/CollectSystem';
export type {CollectibleData} from 'systems/CollectSystem';
export {RespawnSystem} from 'systems/RespawnSystem';
export type {RespawnData} from 'systems/RespawnSystem';
export {BoundsTriggerSystem} from 'systems/BoundsTriggerSystem';
export type {BoundsTriggerData} from 'systems/BoundsTriggerSystem';
export {OverlapTriggerSystem} from 'systems/OverlapTriggerSystem';
export type {OverlapTriggerData} from 'systems/OverlapTriggerSystem';
export {TrailSystem} from 'systems/TrailSystem';
export type {TrailData} from 'systems/TrailSystem';

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
