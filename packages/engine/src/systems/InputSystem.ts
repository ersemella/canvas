import {BaseSystem, type SystemContext} from 'core/System';
import type {InputComponent} from 'components/InputComponent';

class InputServiceImpl {
  private pressed: Set<string> = new Set();
  private justPressed: Set<string> = new Set();
  private justReleased: Set<string> = new Set();
  private actionBindings: Map<string, string[]> = new Map();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.pressed.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.pressed.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.pressed.delete(e.code);
      this.justReleased.add(e.code);
    });
  }

  registerActionMap(actionMap: Record<string, string[]>): void {
    for (const [action, keys] of Object.entries(actionMap)) {
      this.actionBindings.set(action, keys);
    }
  }

  isActionPressed(action: string): boolean {
    const keys = this.actionBindings.get(action) ?? [];
    return keys.some((k) => this.pressed.has(k));
  }

  isActionJustPressed(action: string): boolean {
    const keys = this.actionBindings.get(action) ?? [];
    return keys.some((k) => this.justPressed.has(k));
  }

  isActionJustReleased(action: string): boolean {
    const keys = this.actionBindings.get(action) ?? [];
    return keys.some((k) => this.justReleased.has(k));
  }

  flush(): void {
    this.justPressed.clear();
    this.justReleased.clear();
  }
}

export const inputService = new InputServiceImpl();

export class InputSystem extends BaseSystem {
  readonly priority = 0;

  onInit(context: Omit<SystemContext, 'deltaTime'>): void {
    const entities = context.scene.query({all: ['Input']});
    for (const entity of entities) {
      const input = entity.getComponent<InputComponent>('Input');
      if (input) {
        inputService.registerActionMap(input.actionMap);
      }
    }
  }

  onUpdate(_context: SystemContext): void {
    // flush at END of frame — inputs are read by ScriptSystem first
  }

  flush(): void {
    inputService.flush();
  }
}
