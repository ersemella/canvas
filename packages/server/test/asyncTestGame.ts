/**
 * A tiny turn-based game used only by the local e2e suite
 * (scripts/e2e/rooms-async.e2e.mjs) to exercise async room policies. It is
 * registered by test/e2e-worker.ts and never ships in the production Worker.
 *
 * Players take turns adding 1 or 2 to a running total; a round ends at 10.
 */
import type {RoomPlayer, ServerSystem} from '../src/types';

const DAY = 24 * 60 * 60 * 1000;

interface CountState {
  round: number;
  players: Array<{connectionId: string; name: string}>;
  acting: number;
  total: number;
}

interface CountAction {
  add: number;
}

export const asyncTestGame: ServerSystem<CountState, CountAction> = {
  systemName: 'E2EAsyncCountSystem',
  createInitialState(players: RoomPlayer[], previous) {
    if (players.length < 2) throw new Error('Need two players');
    return {
      round: (previous?.round ?? 0) + 1,
      players: [...players]
        .sort((a, b) => a.seatIndex - b.seatIndex)
        .map((p) => ({connectionId: p.connectionId, name: p.name})),
      acting: 0,
      total: 0,
    };
  },
  handleAction(state, connectionId, action) {
    if (state.total >= 10) throw new Error('The round is over');
    if (state.players[state.acting]?.connectionId !== connectionId) throw new Error('Not your turn');
    if (action.add !== 1 && action.add !== 2) throw new Error('Add 1 or 2');
    return {
      ...state,
      total: state.total + action.add,
      acting: (state.acting + 1) % state.players.length,
    };
  },
  getPublicState: (state) => state,
  actingConnectionId: (state) => (state.total >= 10 ? null : (state.players[state.acting]?.connectionId ?? null)),
  isHandOver: (state) => state.total >= 10,
  timeoutAction: () => ({add: 1}),
  room: {
    turnTimeoutMs: null,
    disconnectedTurnTimeoutMs: null,
    emptyRoomGraceMs: null,
    ttlMs: 14 * DAY,
    ttlExtendsOn: 'activity',
    holdLobbySeats: true,
    newRoundSeats: 'all',
    seatIdentity: 'token',
  },
};
