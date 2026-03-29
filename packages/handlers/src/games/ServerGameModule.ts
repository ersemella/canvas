export interface RoomPlayer {
  connectionId: string;
  name: string;
  chips: number;
  seatIndex: number;
}

export interface ServerSystem<TState = unknown, TAction = unknown> {
  systemName: string;
  createInitialState(players: RoomPlayer[]): TState;
  handleAction(state: TState, connectionId: string, action: TAction): TState;
  getPublicState(state: TState, viewerConnectionId: string): unknown;
  actingConnectionId(state: TState): string | null;
}
