import {BaseComponent} from 'core/Component';
import type {AnyLifecycleHook} from 'hooks/types';

export interface HookEntry {
  name: string;
  config: Record<string, unknown>;
  instance?: AnyLifecycleHook;
}

export class ScriptComponent extends BaseComponent {
  readonly componentType = 'Script';
  static readonly componentType = 'Script';

  hooks: HookEntry[];

  constructor(data: {hooks?: Array<{name: string; config?: Record<string, unknown>}>} = {}) {
    super();
    this.hooks = (data.hooks ?? []).map((h) => ({
      name: h.name,
      config: h.config ?? {},
    }));
  }
}
