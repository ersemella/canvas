import { BaseComponent } from '../core/Component';

export class AIAgentComponent extends BaseComponent {
  readonly componentType = 'AIAgent';
  static readonly componentType = 'AIAgent';

  behaviorTree: string;
  state: Record<string, unknown>;

  constructor(data: { behaviorTree?: string; state?: Record<string, unknown> } = {}) {
    super();
    this.behaviorTree = data.behaviorTree ?? '';
    this.state = data.state ?? {};
  }
}
