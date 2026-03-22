import {registerDataComponent} from 'core/Component';

export interface PileMemberData {
  pileId: string;
  posInPile: number;
  expanded: boolean;  // true = use expandedStep, false = use collapsedStep
}

registerDataComponent<PileMemberData>('PileMember');
