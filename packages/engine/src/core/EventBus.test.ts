import {describe, it, expect, vi} from 'vitest';
import {EventBus} from 'core/EventBus';

describe('EventBus', () => {
  it('calls handler on emit', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.emit('test', {value: 42});
    expect(handler).toHaveBeenCalledWith({value: 42});
  });

  it('unsubscribes via returned function', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.on('test', handler);
    off();
    bus.emit('test', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('clears all handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.clear();
    bus.emit('test', {});
    expect(handler).not.toHaveBeenCalled();
  });
});
