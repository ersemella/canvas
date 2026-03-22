import {registerDataComponent} from 'core/Component';

export interface PileLayoutData {
  pileId: string;
  anchorX: number;
  anchorY: number;
  expandedStep: number;   // y offset between cards when expanded (face-up)
  collapsedStep: number;  // y offset between cards when collapsed (face-down)
  trackTop: boolean;      // move this entity's transform to follow the top member
}

registerDataComponent<PileLayoutData>('PileLayout');
