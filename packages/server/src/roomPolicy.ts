/**
 * Room lifecycle rules, as pure functions of a game's `RoomPolicy`. GameRoom
 * does the I/O; everything about *when* (turn deadlines, expiry, the alarm)
 * is decided here so it can be unit-tested.
 */
import type {RoomPolicy, RoomRecord} from './types';

export type ResolvedRoomPolicy = Required<RoomPolicy>;

/** Real-time play. These are the values GameRoom hard-coded before policies existed. */
export const DEFAULT_ROOM_POLICY: ResolvedRoomPolicy = {
  turnTimeoutMs: 30_000,
  disconnectedTurnTimeoutMs: 10_000,
  emptyRoomGraceMs: 5 * 60 * 1000,
  ttlMs: 24 * 60 * 60 * 1000,
  ttlExtendsOn: 'connections',
  holdLobbySeats: false,
  newRoundSeats: 'connected',
  seatIdentity: 'name',
};

/** The game's policy with every unset field filled from the defaults. */
export function resolveRoomPolicy(policy: RoomPolicy | undefined): ResolvedRoomPolicy {
  const resolved = {...DEFAULT_ROOM_POLICY};
  for (const [key, value] of Object.entries(policy ?? {})) {
    if (value !== undefined) (resolved as Record<string, unknown>)[key] = value;
  }
  return resolved;
}

/** Deadline for the acting player's turn, or null if this game has no turn limit. */
export function turnDeadline(policy: ResolvedRoomPolicy, now: number, actingConnected: boolean): number | null {
  const limit =
    !actingConnected && policy.disconnectedTurnTimeoutMs !== null
      ? policy.disconnectedTurnTimeoutMs
      : policy.turnTimeoutMs;
  return limit === null ? null : now + limit;
}

/** The turn deadline after the acting player disconnects: shortened if the policy says so. */
export function deadlineAfterDisconnect(
  policy: ResolvedRoomPolicy,
  current: number | null,
  now: number,
): number | null {
  if (current === null || policy.disconnectedTurnTimeoutMs === null) return current;
  return Math.min(current, now + policy.disconnectedTurnTimeoutMs);
}

/** When an empty room gets deleted, or Infinity if it never is for being empty. */
export function emptyRoomDeletionAt(policy: ResolvedRoomPolicy, emptySince: number | null | undefined): number {
  if (!emptySince || policy.emptyRoomGraceMs === null) return Infinity;
  return emptySince + policy.emptyRoomGraceMs;
}

type AlarmFields = Pick<RoomRecord, 'expiresAt' | 'turnDeadline' | 'emptySince'>;

/** The one storage alarm points at whichever timer is due first. */
export function nextAlarmAt(policy: ResolvedRoomPolicy, meta: AlarmFields): number {
  return Math.min(meta.expiresAt, meta.turnDeadline ?? Infinity, emptyRoomDeletionAt(policy, meta.emptySince));
}

export type AlarmDecision =
  | {kind: 'delete'}
  | {kind: 'continue'; expiresAt: number; turnTimedOut: boolean};

/** What the alarm should do at `now`. */
export function decideAlarm(
  policy: ResolvedRoomPolicy,
  meta: AlarmFields,
  now: number,
  noSockets: boolean,
): AlarmDecision {
  if (noSockets && now >= emptyRoomDeletionAt(policy, meta.emptySince)) return {kind: 'delete'};
  let expiresAt = meta.expiresAt;
  if (now >= expiresAt) {
    if (noSockets) return {kind: 'delete'};
    // Still in use: keep it for another TTL period.
    expiresAt = now + policy.ttlMs;
  }
  const turnTimedOut = Boolean(meta.turnDeadline && now >= meta.turnDeadline);
  return {kind: 'continue', expiresAt, turnTimedOut};
}

/** Expiry after a join or a committed move: pushed back only for `ttlExtendsOn: 'activity'`. */
export function expiryAfterActivity(policy: ResolvedRoomPolicy, expiresAt: number, now: number): number {
  return policy.ttlExtendsOn === 'activity' ? Math.max(expiresAt, now + policy.ttlMs) : expiresAt;
}
