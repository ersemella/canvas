/**
 * Generic system that drives canvas-based panel UI from game systems.
 *
 * Any game system can update panel entities by emitting 'sidepanel:update'
 * on the EventBus. SidePanelSystem finds each named entity and mutates its
 * Renderable / Clickable components — no game logic lives here.
 */

import {BaseSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import type {Scene} from 'core/Scene';
import type {DataComponent} from 'core/Component';
import type {RenderableComponent} from 'components/RenderableComponent';
import type {ClickableData} from 'components/ClickableComponent';

export interface SidePanelButtonUpdate {
  id: string;
  enabled: boolean;
  color?: string;
  label?: string;
}

export interface SidePanelTextUpdate {
  id: string;
  text: string;
  color?: string;
}

export interface SidePanelUpdatePayload {
  buttons?: SidePanelButtonUpdate[];
  texts?: SidePanelTextUpdate[];
}

export class SidePanelSystem extends BaseSystem {
  readonly priority = 90;

  private scene: Scene | null = null;
  private unsub: (() => void) | null = null;

  onInit({scene, events}: Omit<SystemContext, 'deltaTime'>): void {
    this.scene = scene;
    this.unsub = events.on<SidePanelUpdatePayload>('sidepanel:update', this.onPanelUpdate);
  }

  onUpdate(_context: SystemContext): void {
    // All work done in event handler
  }

  onDestroy(_context: Omit<SystemContext, 'deltaTime'>): void {
    this.unsub?.();
  }

  private readonly onPanelUpdate = (payload: SidePanelUpdatePayload): void => {
    const scene = this.scene;
    if (!scene) return;

    for (const btn of payload.buttons ?? []) {
      const entity = scene.getEntity(btn.id);
      if (!entity) continue;
      const clickable = entity.getComponent<DataComponent<ClickableData>>('Clickable');
      if (clickable) clickable.data.enabled = btn.enabled;
      const renderable = entity.getComponent<RenderableComponent>('Renderable');
      if (renderable) {
        if (btn.color !== undefined) renderable.color = btn.color;
        if (btn.label !== undefined) renderable.text = btn.label;
      }
    }

    for (const txt of payload.texts ?? []) {
      const entity = scene.getEntity(txt.id);
      if (!entity) continue;
      const renderable = entity.getComponent<RenderableComponent>('Renderable');
      if (renderable) {
        renderable.text = txt.text;
        if (txt.color !== undefined) renderable.textColor = txt.color;
      }
    }
  };
}
