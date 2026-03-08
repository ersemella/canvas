type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers: Map<string, Set<Handler<unknown>>> = new Map();

  on<T>(event: string, handler: Handler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  off<T>(event: string, handler: Handler<T>): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<T>(event: string, payload: T): void {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }

  clear(): void {
    this.handlers.clear();
  }
}
