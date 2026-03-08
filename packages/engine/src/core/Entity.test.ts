import { describe, it, expect } from 'vitest';
import { Entity } from './Entity';
import { BaseComponent } from './Component';

class TestComponent extends BaseComponent {
  readonly componentType = 'Test';
  static readonly componentType = 'Test';
  constructor(public value: number) {
    super();
  }
}

describe('Entity', () => {
  it('generates unique ids', () => {
    const a = new Entity();
    const b = new Entity();
    expect(a.id).not.toBe(b.id);
  });

  it('uses provided id', () => {
    const e = new Entity('my-id');
    expect(e.id).toBe('my-id');
  });

  it('manages components', () => {
    const e = new Entity();
    const c = new TestComponent(1);
    e.addComponent(c);
    expect(e.hasComponent('Test')).toBe(true);
    expect(e.getComponent<TestComponent>('Test')?.value).toBe(1);
    e.removeComponent('Test');
    expect(e.hasComponent('Test')).toBe(false);
  });

  it('manages tags', () => {
    const e = new Entity();
    e.addTag('player');
    expect(e.hasTag('player')).toBe(true);
    e.removeTag('player');
    expect(e.hasTag('player')).toBe(false);
  });

  it('marks as destroyed', () => {
    const e = new Entity();
    expect(e.isDestroyed).toBe(false);
    e.destroy();
    expect(e.isDestroyed).toBe(true);
  });
});
