import { BaseComponent } from '../core/Component';

export class InputComponent extends BaseComponent {
  readonly componentType = 'Input';
  static readonly componentType = 'Input';

  actionMap: Record<string, string[]>;

  constructor(data: { actionMap?: Record<string, string[]> } = {}) {
    super();
    this.actionMap = data.actionMap ?? {};
  }
}
