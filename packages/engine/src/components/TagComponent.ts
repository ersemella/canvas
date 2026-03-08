import { BaseComponent } from '../core/Component';

export class TagComponent extends BaseComponent {
  readonly componentType = 'Tag';
  static readonly componentType = 'Tag';

  value: string;

  constructor(data: { value?: string } = {}) {
    super();
    this.value = data.value ?? '';
  }
}
