import {describe, it, expect, beforeAll} from 'vitest';
import {loadScene} from 'loader/SceneLoader';
import {registerBuiltinComponents} from 'loader/ComponentLoader';

beforeAll(() => {
  registerBuiltinComponents();
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
});
