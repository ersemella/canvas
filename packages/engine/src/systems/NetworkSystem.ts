/**
 * Generic WebSocket communication system.
 *
 * Starts unconnected. The web app emits 'network:configure' on the EventBus
 * (after receiving room context from the lobby) to connect:
 *
 *   events.emit('network:configure', { wsUrl, roomId, playerName });
 *
 * Game systems send messages by emitting 'ws:send':
 *   events.emit('ws:send', { type: 'playerAction', payload: action });
 *
 * Incoming messages from the server are emitted as 'ws:message':
 *   events.on('ws:message', ({ type, payload }) => { ... });
 *
 * onmessage fires outside the ECS tick, so incoming messages are buffered
 * and drained in onUpdate to keep all game logic on the main thread.
 */

import {BaseSystem} from 'core/System';
import type {SystemContext} from 'core/System';

export interface NetworkConfigPayload {
  wsUrl: string;
  roomId: string;
  playerName: string;
}

export interface WsSendPayload {
  type: string;
  payload?: unknown;
}

export interface WsMessagePayload {
  type: string;
  payload?: unknown;
}

export class NetworkSystem extends BaseSystem {
  readonly priority = 10;

  private ws: WebSocket | null = null;
  private messageQueue: WsMessagePayload[] = [];
  private unsubConfigure: (() => void) | null = null;
  private unsubSend: (() => void) | null = null;

  onInit({events}: Omit<SystemContext, 'deltaTime'>): void {
    this.unsubConfigure = events.on<NetworkConfigPayload>('network:configure', (cfg) => {
      this.connect(cfg);
    });

    this.unsubSend = events.on<WsSendPayload>('ws:send', (msg) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    });
  }

  onUpdate({events}: SystemContext): void {
    if (this.messageQueue.length === 0) return;
    const msgs = this.messageQueue.splice(0);
    for (const msg of msgs) {
      events.emit<WsMessagePayload>('ws:message', msg);
    }
  }

  onDestroy(_context: Omit<SystemContext, 'deltaTime'>): void {
    this.unsubConfigure?.();
    this.unsubSend?.();
    this.ws?.close();
    this.ws = null;
  }

  private connect(cfg: NetworkConfigPayload): void {
    if (this.ws) {
      this.ws.close();
    }

    const url = `${cfg.wsUrl}?roomId=${encodeURIComponent(cfg.roomId)}&playerName=${encodeURIComponent(cfg.playerName)}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessagePayload;
        this.messageQueue.push(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onopen = () => {
      // Send a sync request so the server returns current state
      ws.send(JSON.stringify({type: 'sync'}));
    };

    ws.onerror = () => {
      // Connection errors are silent — game falls back to single-player
    };
  }
}
