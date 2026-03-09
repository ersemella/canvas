import {describe, it, expect, beforeAll} from 'vitest';
import {loadScene} from 'loader/SceneLoader';
import {registerBuiltinComponents} from 'loader/ComponentLoader';
import {HookRegistry} from 'hooks/HookRegistry';
import type {HookContext} from 'hooks/types';
import type {ScriptComponent} from 'components/ScriptComponent';

beforeAll(() => {
  registerBuiltinComponents();
  HookRegistry.register('testHook', (_config) => ({
    onUpdate(_ctx: HookContext) {},
  }));
});

describe('loadScene', () => {
  it('loads a scene with entities', () => {
    const scene = loadScene({
      name: 'test',
      entities: [
        {
          id: 'e1',
          tags: ['player'],
          components: {
            Transform: {
              position: {x: 10, y: 20},
              rotation: 0,
              scale: {x: 1, y: 1},
            },
          },
        },
      ],
    });

    expect(scene.name).toBe('test');
    const entity = scene.getEntity('e1');
    expect(entity).toBeDefined();
    expect(entity?.hasTag('player')).toBe(true);
    expect(entity?.hasComponent('Transform')).toBe(true);
  });

  it('loads hooks into ScriptComponent', () => {
    const scene = loadScene({
      name: 'hook-test',
      entities: [
        {
          id: 'e2',
          components: {
            Script: {hooks: [{name: 'testHook', config: {}}]},
          },
        },
      ],
    });

    const entity = scene.getEntity('e2');
    const script = entity?.getComponent<ScriptComponent>('Script');
    expect(script?.hooks[0]?.instance).toBeDefined();
  });
});
