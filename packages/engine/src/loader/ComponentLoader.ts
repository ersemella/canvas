import {ComponentRegistry, registerDataComponent, type IComponent} from 'core/Component';
import {SystemRegistry} from 'core/SystemRegistry';
import type {GridMovementData} from 'systems/GridMovementSystem';
import type {CollectibleData} from 'systems/CollectSystem';
import type {RespawnData} from 'systems/RespawnSystem';
import type {BoundsTriggerData} from 'systems/BoundsTriggerSystem';
import type {OverlapTriggerData} from 'systems/OverlapTriggerSystem';
import type {TrailData} from 'systems/TrailSystem';
import {GridMovementSystem} from 'systems/GridMovementSystem';
import {CollectSystem} from 'systems/CollectSystem';
import {RespawnSystem} from 'systems/RespawnSystem';
import {BoundsTriggerSystem} from 'systems/BoundsTriggerSystem';
import {OverlapTriggerSystem} from 'systems/OverlapTriggerSystem';
import {TrailSystem} from 'systems/TrailSystem';

// Register all built-in components
import {TransformComponent} from 'components/TransformComponent';
import {RenderableComponent} from 'components/RenderableComponent';
import {RigidBodyComponent} from 'components/RigidBodyComponent';
import {ColliderComponent} from 'components/ColliderComponent';
import {InputComponent} from 'components/InputComponent';
import {AnimatorComponent} from 'components/AnimatorComponent';
import {AIAgentComponent} from 'components/AIAgentComponent';
import {AudioSourceComponent} from 'components/AudioSourceComponent';
import {ScriptComponent} from 'components/ScriptComponent';
import {TagComponent} from 'components/TagComponent';

let systemsRegistered = false;

export function registerBuiltinSystems(): void {
  if (systemsRegistered) return;
  systemsRegistered = true;
  SystemRegistry.register('GridMovementSystem', GridMovementSystem);
  SystemRegistry.register('CollectSystem', CollectSystem);
  SystemRegistry.register('RespawnSystem', RespawnSystem);
  SystemRegistry.register('BoundsTriggerSystem', BoundsTriggerSystem);
  SystemRegistry.register('OverlapTriggerSystem', OverlapTriggerSystem);
  SystemRegistry.register('TrailSystem', TrailSystem);
}

export function registerBuiltinComponents(): void {
  ComponentRegistry.register(
    'Transform',
    (d) => new TransformComponent(d as ConstructorParameters<typeof TransformComponent>[0])
  );
  ComponentRegistry.register(
    'Renderable',
    (d) => new RenderableComponent(d as ConstructorParameters<typeof RenderableComponent>[0])
  );
  ComponentRegistry.register(
    'RigidBody',
    (d) => new RigidBodyComponent(d as ConstructorParameters<typeof RigidBodyComponent>[0])
  );
  ComponentRegistry.register(
    'Collider',
    (d) => new ColliderComponent(d as ConstructorParameters<typeof ColliderComponent>[0])
  );
  ComponentRegistry.register(
    'Input',
    (d) => new InputComponent(d as ConstructorParameters<typeof InputComponent>[0])
  );
  ComponentRegistry.register(
    'Animator',
    (d) => new AnimatorComponent(d as ConstructorParameters<typeof AnimatorComponent>[0])
  );
  ComponentRegistry.register(
    'AIAgent',
    (d) => new AIAgentComponent(d as ConstructorParameters<typeof AIAgentComponent>[0])
  );
  ComponentRegistry.register(
    'AudioSource',
    (d) => new AudioSourceComponent(d as ConstructorParameters<typeof AudioSourceComponent>[0])
  );
  ComponentRegistry.register(
    'Script',
    (d) => new ScriptComponent(d as ConstructorParameters<typeof ScriptComponent>[0])
  );
  ComponentRegistry.register(
    'Tag',
    (d) => new TagComponent(d as ConstructorParameters<typeof TagComponent>[0])
  );

  registerDataComponent<GridMovementData>('GridMovement');
  registerDataComponent<CollectibleData>('Collectible');
  registerDataComponent<RespawnData>('Respawn');
  registerDataComponent<BoundsTriggerData>('BoundsTrigger');
  registerDataComponent<OverlapTriggerData>('OverlapTrigger');
  registerDataComponent<TrailData>('Trail');
}

export function loadComponents(
  componentData: Record<string, Record<string, unknown>>
): IComponent[] {
  return Object.entries(componentData).map(([type, data]) => ComponentRegistry.create(type, data));
}
