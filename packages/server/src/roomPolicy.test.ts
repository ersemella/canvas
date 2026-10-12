import {describe, expect, it} from 'vitest';
import {
  DEFAULT_ROOM_POLICY,
  resolveRoomPolicy,
  turnDeadline,
  deadlineAfterDisconnect,
  nextAlarmAt,
  decideAlarm,
  expiryAfterActivity,
} from './roomPolicy';

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = 1_700_000_000_000;

const realtime = resolveRoomPolicy(undefined);
const async = resolveRoomPolicy({
  turnTimeoutMs: null,
  disconnectedTurnTimeoutMs: null,
  emptyRoomGraceMs: null,
  ttlMs: 14 * DAY,
  ttlExtendsOn: 'activity',
  holdLobbySeats: true,
  newRoundSeats: 'all',
  seatIdentity: 'token',
});

describe('defaults (real-time play, what poker gets)', () => {
  it('are the values GameRoom hard-coded before policies existed', () => {
    expect(DEFAULT_ROOM_POLICY).toEqual({
      turnTimeoutMs: 30 * SEC,
      disconnectedTurnTimeoutMs: 10 * SEC,
      emptyRoomGraceMs: 5 * MIN,
      ttlMs: DAY,
      ttlExtendsOn: 'connections',
      holdLobbySeats: false,
      newRoundSeats: 'connected',
      seatIdentity: 'name',
    });
    expect(resolveRoomPolicy({})).toEqual(DEFAULT_ROOM_POLICY);
  });

  it('fill only the fields a game leaves unset (null means off)', () => {
    const p = resolveRoomPolicy({turnTimeoutMs: null});
    expect(p.turnTimeoutMs).toBeNull();
    expect(p.ttlMs).toBe(DAY);
    expect(p.disconnectedTurnTimeoutMs).toBe(10 * SEC);
  });

  it('give 30s to a connected player and 10s to a disconnected one', () => {
    expect(turnDeadline(realtime, now, true)).toBe(now + 30 * SEC);
    expect(turnDeadline(realtime, now, false)).toBe(now + 10 * SEC);
  });

  it('cut a running turn to 10s when the acting player disconnects, never lengthen it', () => {
    expect(deadlineAfterDisconnect(realtime, now + 25 * SEC, now)).toBe(now + 10 * SEC);
    expect(deadlineAfterDisconnect(realtime, now + 3 * SEC, now)).toBe(now + 3 * SEC);
    expect(deadlineAfterDisconnect(realtime, null, now)).toBeNull();
  });

  it('delete an empty room after 5 minutes', () => {
    const meta = {expiresAt: now + DAY, turnDeadline: null, emptySince: now};
    expect(nextAlarmAt(realtime, meta)).toBe(now + 5 * MIN);
    expect(decideAlarm(realtime, meta, now + 5 * MIN, true)).toEqual({kind: 'delete'});
    // Someone came back in time: no deletion.
    expect(decideAlarm(realtime, meta, now + 5 * MIN, false).kind).toBe('continue');
  });

  it('expire after 24h unless someone is connected, then extend by 24h', () => {
    const meta = {expiresAt: now, turnDeadline: null, emptySince: null};
    expect(decideAlarm(realtime, meta, now, true)).toEqual({kind: 'delete'});
    expect(decideAlarm(realtime, meta, now, false)).toEqual({
      kind: 'continue',
      expiresAt: now + DAY,
      turnTimedOut: false,
    });
  });

  it('do not extend the expiry on activity', () => {
    expect(expiryAfterActivity(realtime, now + HOUR, now)).toBe(now + HOUR);
  });

  it('time out a turn whose deadline has passed', () => {
    const meta = {expiresAt: now + DAY, turnDeadline: now + 30 * SEC, emptySince: null};
    expect(nextAlarmAt(realtime, meta)).toBe(now + 30 * SEC);
    expect(decideAlarm(realtime, meta, now + 30 * SEC, false)).toMatchObject({turnTimedOut: true});
    expect(decideAlarm(realtime, meta, now + 29 * SEC, false)).toMatchObject({turnTimedOut: false});
  });
});

describe('an async policy', () => {
  it('has no turn deadline, connected or not', () => {
    expect(turnDeadline(async, now, true)).toBeNull();
    expect(turnDeadline(async, now, false)).toBeNull();
  });

  it('can keep a turn limit without shortening it for disconnected players', () => {
    const p = resolveRoomPolicy({turnTimeoutMs: DAY, disconnectedTurnTimeoutMs: null});
    expect(turnDeadline(p, now, false)).toBe(now + DAY);
    expect(deadlineAfterDisconnect(p, now + DAY, now)).toBe(now + DAY);
  });

  it('never deletes a room for being empty', () => {
    const meta = {expiresAt: now + 14 * DAY, turnDeadline: null, emptySince: now};
    expect(nextAlarmAt(async, meta)).toBe(now + 14 * DAY);
    expect(decideAlarm(async, meta, now + 13 * DAY, true).kind).toBe('continue');
  });

  it('pushes the expiry back on every join and move', () => {
    expect(expiryAfterActivity(async, now + HOUR, now)).toBe(now + 14 * DAY);
    // Never shortens one already further out.
    expect(expiryAfterActivity(async, now + 20 * DAY, now)).toBe(now + 20 * DAY);
  });

  it('still deletes a room nobody has touched for the whole TTL', () => {
    const meta = {expiresAt: now + 14 * DAY, turnDeadline: null, emptySince: now};
    expect(decideAlarm(async, meta, now + 14 * DAY, true)).toEqual({kind: 'delete'});
  });
});
