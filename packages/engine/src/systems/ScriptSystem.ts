import {BaseSystem, type SystemContext} from 'core/System';
import type {ScriptComponent} from 'components/ScriptComponent';
import {inputService} from 'systems/InputSystem';
import type {HookContext} from 'hooks/types';
import type {IEntity} from 'core/Entity';

function buildHookContext(
  entity: IEntity,
  context: SystemContext | Omit<SystemContext, 'deltaTime'>,
  state: Record<string, unknown>,
  config: Record<string, unknown>
): HookContext {
  const deltaTime = 'deltaTime' in context ? context.deltaTime : 0;
  return {
    entity,
    world: context.world,
    scene: context.scene,
    events: context.events,
    deltaTime,
    input: inputService,
    state,
    config,
    spawn: (setup) => context.world.spawn(context.scene, setup),
    destroy: (id) => context.world.destroy(context.scene, id),
  };
}

export class ScriptSystem extends BaseSystem {
  readonly priority = 500;
  private entityStates: Map<string, Map<string, Record<string, unknown>>> = new Map();

  onInit(context: Omit<SystemContext, 'deltaTime'>): void {
    const entities = context.scene.query({all: ['Script']});
    for (const entity of entities) {
      const script = entity.getComponent<ScriptComponent>('Script')!;
      const hookStates = new Map<string, Record<string, unknown>>();

      for (const entry of script.hooks) {
        const state: Record<string, unknown> = {};
        hookStates.set(entry.name, state);

        if (entry.instance?.onInit) {
          const ctx = buildHookContext(entity, context, state, entry.config);
          entry.instance.onInit(ctx);
        }
      }

      this.entityStates.set(entity.id, hookStates);
    }
  }

  onUpdate(context: SystemContext): void {
    const entities = context.scene.query({all: ['Script']});
    for (const entity of entities) {
      const script = entity.getComponent<ScriptComponent>('Script')!;
      const hookStates = this.entityStates.get(entity.id) ?? new Map();

      for (const entry of script.hooks) {
        if (!entry.instance?.onUpdate) continue;
        const state = hookStates.get(entry.name) ?? {};
        const ctx = buildHookContext(entity, context, state, entry.config);
        entry.instance.onUpdate(ctx);
      }
    }
  }

  onDestroy(context: Omit<SystemContext, 'deltaTime'>): void {
    const entities = context.scene.query({all: ['Script']});
    for (const entity of entities) {
      const script = entity.getComponent<ScriptComponent>('Script')!;
      const hookStates = this.entityStates.get(entity.id) ?? new Map();

      for (const entry of script.hooks) {
        if (entry.instance?.onDestroy) {
          const state = hookStates.get(entry.name) ?? {};
          const ctx = buildHookContext(entity, context, state, entry.config);
          entry.instance.onDestroy(ctx);
        }
      }
    }
    this.entityStates.clear();
  }
}
