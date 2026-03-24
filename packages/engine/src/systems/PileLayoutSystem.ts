import {ReactiveSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import type {Scene} from 'core/Scene';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';
import type {RenderableComponent} from 'components/RenderableComponent';
import type {PileLayoutData} from 'components/PileLayoutComponent';
import type {PileMemberData} from 'components/PileMemberComponent';

export class PileLayoutSystem extends ReactiveSystem {
  readonly priority = 120;

  private scene: Scene | null = null;

  onInit({scene, events}: Omit<SystemContext, 'deltaTime'>): void {
    this.scene = scene;
    events.on('pile:layout_dirty', () => this.markDirty());
    this.markDirty();
  }

  onUpdate(context: SystemContext): void {
    super.onUpdate(context);
    this.updateTrackTopSlots();
  }

  private updateTrackTopSlots(): void {
    if (!this.scene) return;

    const layoutEntities = this.scene.query({all: ['PileLayout', 'Transform']});
    const memberEntities = this.scene.query({all: ['PileMember', 'Transform', 'Renderable']});

    type MemberEntry = {transform: TransformComponent; renderable: RenderableComponent; data: PileMemberData};
    const piles = new Map<string, MemberEntry[]>();
    for (const entity of memberEntities) {
      const member = entity.getComponent<DataComponent<PileMemberData>>('PileMember')!;
      const transform = entity.getComponent<TransformComponent>('Transform')!;
      const renderable = entity.getComponent<RenderableComponent>('Renderable')!;
      const {pileId} = member.data;
      if (!piles.has(pileId)) piles.set(pileId, []);
      piles.get(pileId)!.push({transform, renderable, data: member.data});
    }

    for (const entity of layoutEntities) {
      const layout = entity.getComponent<DataComponent<PileLayoutData>>('PileLayout')!;
      if (!layout.data.trackTop) continue;
      const transform = entity.getComponent<TransformComponent>('Transform')!;
      const members = (piles.get(layout.data.pileId) ?? [])
        .filter((m) => m.renderable.zIndex < 900)
        .sort((a, b) => a.data.posInPile - b.data.posInPile);
      if (members.length > 0) {
        const top = members[members.length - 1]!;
        transform.position.x = top.transform.position.x;
        transform.position.y = top.transform.position.y;
      } else {
        transform.position.x = layout.data.anchorX;
        transform.position.y = layout.data.anchorY;
      }
    }
  }

  onDirty(_context: SystemContext): void {
    if (!this.scene) return;

    // Build config map from PileLayout entities
    const layoutEntities = this.scene.query({all: ['PileLayout', 'Transform']});
    type LayoutEntry = PileLayoutData & {transform: TransformComponent};
    const layouts = new Map<string, LayoutEntry>();

    for (const entity of layoutEntities) {
      const layout = entity.getComponent<DataComponent<PileLayoutData>>('PileLayout')!;
      const transform = entity.getComponent<TransformComponent>('Transform')!;
      layouts.set(layout.data.pileId, {...layout.data, transform});
    }

    // Group PileMember entities by pileId
    const memberEntities = this.scene.query({all: ['PileMember', 'Transform', 'Renderable']});
    type MemberEntry = {transform: TransformComponent; renderable: RenderableComponent; data: PileMemberData};
    const piles = new Map<string, MemberEntry[]>();

    for (const entity of memberEntities) {
      const member = entity.getComponent<DataComponent<PileMemberData>>('PileMember')!;
      const transform = entity.getComponent<TransformComponent>('Transform')!;
      const renderable = entity.getComponent<RenderableComponent>('Renderable')!;
      const {pileId} = member.data;
      if (!piles.has(pileId)) piles.set(pileId, []);
      piles.get(pileId)!.push({transform, renderable, data: member.data});
    }

    // Position members in each pile
    for (const [pileId, members] of piles) {
      const config = layouts.get(pileId);
      if (!config) continue;

      members.sort((a, b) => a.data.posInPile - b.data.posInPile);

      let y = config.anchorY;
      for (let i = 0; i < members.length; i++) {
        const {transform, renderable, data} = members[i]!;
        transform.position.x = config.anchorX;
        transform.position.y = y;
        renderable.zIndex = i * 2;
        y += data.expanded ? config.expandedStep : config.collapsedStep;
      }

      // Move slot entity to follow top member
      if (config.trackTop) {
        if (members.length > 0) {
          const top = members[members.length - 1]!;
          config.transform.position.x = top.transform.position.x;
          config.transform.position.y = top.transform.position.y;
        } else {
          config.transform.position.x = config.anchorX;
          config.transform.position.y = config.anchorY;
        }
      }
    }

    // Reset trackTop slots for empty piles
    for (const [pileId, config] of layouts) {
      if (config.trackTop && !piles.has(pileId)) {
        config.transform.position.x = config.anchorX;
        config.transform.position.y = config.anchorY;
      }
    }
  }
}
