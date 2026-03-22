import {ComponentRegistry, registerDataComponent, type IComponent} from 'core/Component';
import {SystemRegistry} from 'core/SystemRegistry';
import type {GridMovementData} from 'systems/grid/GridMovementSystem';
import type {CollectibleData} from 'systems/grid/CollectSystem';
import type {RespawnData} from 'systems/grid/RespawnSystem';
import type {BoundsTriggerData} from 'systems/grid/BoundsTriggerSystem';
import type {OverlapTriggerData} from 'systems/grid/OverlapTriggerSystem';
import type {TrailData} from 'systems/grid/TrailSystem';
import {GridMovementSystem} from 'systems/grid/GridMovementSystem';
import {CollectSystem} from 'systems/grid/CollectSystem';
import {RespawnSystem} from 'systems/grid/RespawnSystem';
import {BoundsTriggerSystem} from 'systems/grid/BoundsTriggerSystem';
import {OverlapTriggerSystem} from 'systems/grid/OverlapTriggerSystem';
import {TrailSystem} from 'systems/grid/TrailSystem';
import {MouseSystem} from 'systems/MouseSystem';
import {DragDropSystem} from 'systems/DragDropSystem';
import {ChildTransformSystem} from 'systems/ChildTransformSystem';
import {ClickSystem} from 'systems/ClickSystem';
import type {CardData} from 'components/CardComponent';
import type {DraggableData} from 'components/DraggableComponent';
import type {DropTargetData} from 'components/DropTargetComponent';
import type {ChildOfData} from 'components/ChildOfComponent';
import type {ClickableData} from 'components/ClickableComponent';

// Register all built-in components
import {TransformComponent} from 'components/TransformComponent';
import {RenderableComponent} from 'components/RenderableComponent';
import {RigidBodyComponent} from 'components/RigidBodyComponent';
import {ColliderComponent} from 'components/ColliderComponent';
import {InputComponent} from 'components/InputComponent';
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
  SystemRegistry.register('MouseSystem', MouseSystem);
  SystemRegistry.register('DragDropSystem', DragDropSystem);
  SystemRegistry.register('ChildTransformSystem', ChildTransformSystem);
  SystemRegistry.register('ClickSystem', ClickSystem);
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
    'Tag',
    (d) => new TagComponent(d as ConstructorParameters<typeof TagComponent>[0])
  );

  registerDataComponent<GridMovementData>('GridMovement');
  registerDataComponent<CollectibleData>('Collectible');
  registerDataComponent<RespawnData>('Respawn');
  registerDataComponent<BoundsTriggerData>('BoundsTrigger');
  registerDataComponent<OverlapTriggerData>('OverlapTrigger');
  registerDataComponent<TrailData>('Trail');
  registerDataComponent<CardData>('Card');
  registerDataComponent<DraggableData>('Draggable');
  registerDataComponent<DropTargetData>('DropTarget');
  registerDataComponent<ChildOfData>('ChildOf');
  registerDataComponent<ClickableData>('Clickable');
}

export function loadComponents(
  componentData: Record<string, Record<string, unknown>>
): IComponent[] {
  return Object.entries(componentData).map(([type, data]) => ComponentRegistry.create(type, data));
}
