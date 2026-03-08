import { BaseComponent } from '../core/Component';
import type { LifecycleHook } from '../hooks/types';

export interface HookEntry {
  name: string;
  config: Record<string, unknown>;
  instance?: LifecycleHook;
}

export class ScriptComponent extends BaseComponent {
  readonly componentType = 'Script';
  static readonly componentType = 'Script';

  hooks: HookEntry[];

  constructor(data: { hooks?: Array<{ name: string; config?: Record<string, unknown> }> } = {}) {
    super();
    this.hooks = (data.hooks ?? []).map((h) => ({
      name: h.name,
      config: h.config ?? {},
    }));
  }
}
