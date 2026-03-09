import {HookRegistry} from 'hooks/HookRegistry';
import type {ScriptComponent} from 'components/ScriptComponent';

export function loadHooks(script: ScriptComponent): void {
  for (const entry of script.hooks) {
    if (!entry.instance) {
      entry.instance = HookRegistry.create(entry.name, entry.config);
    }
  }
}
