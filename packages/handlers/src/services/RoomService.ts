import {randomUUID} from 'crypto';
import {RoomRepository} from 'repositories/RoomRepository';
import type {RoomRecord, ConnectionRecord} from 'repositories/RoomRepository';
import {RoomNotFoundError, RoomFullError, GameInProgressError} from 'lib/errors';

const TTL_HOURS = 24;
const DEFAULT_CHIPS = 1000;

export class RoomService {
  private readonly repo: RoomRepository;

  constructor(tableName: string) {
    this.repo = new RoomRepository(tableName);
  }

  async createRoom(input: {
    hostName: string;
    gameType: string;
    maxPlayers: number;
  }): Promise<{roomId: string; room: RoomRecord}> {
    const roomId = randomUUID().slice(0, 8).toUpperCase();
    const now = Math.floor(Date.now() / 1000);
    const room: RoomRecord = {
      roomId,
      gameType: input.gameType,
      hostConnectionId: '',
      players: [],
      maxPlayers: input.maxPlayers,
      status: 'waiting',
      gameState: null,
      createdAt: now,
      ttl: now + TTL_HOURS * 3600,
    };
    await this.repo.saveRoom(room);
    return {roomId, room};
  }

  async getRoom(roomId: string): Promise<RoomRecord | null> {
    return this.repo.getRoom(roomId);
  }

  async joinRoom(input: {
    roomId: string;
    playerName: string;
    connectionId: string;
  }): Promise<RoomRecord> {
    const room = await this.repo.getRoom(input.roomId);
    if (!room) throw new RoomNotFoundError(input.roomId);
    if (room.status === 'in_progress') throw new GameInProgressError(input.roomId);
    if (room.players.length >= room.maxPlayers) throw new RoomFullError(input.roomId);

    const seatIndex = room.players.length;
    room.players.push({
      connectionId: input.connectionId,
      name: input.playerName,
      chips: DEFAULT_CHIPS,
      seatIndex,
    });

    if (!room.hostConnectionId) {
      room.hostConnectionId = input.connectionId;
    }

    await this.repo.saveRoom(room);

    const conn: ConnectionRecord = {
      connectionId: input.connectionId,
      roomId: input.roomId,
      playerName: input.playerName,
      joinedAt: Math.floor(Date.now() / 1000),
    };
    await this.repo.saveConnection(conn);

    return room;
  }

  async removePlayer(roomId: string, connectionId: string): Promise<RoomRecord | null> {
    const room = await this.repo.getRoom(roomId);
    if (!room) return null;

    room.players = room.players.filter((p) => p.connectionId !== connectionId);
    await this.repo.deleteConnection(roomId, connectionId);

    if (room.players.length === 0) {
      await this.repo.deleteRoom(roomId);
      return null;
    }

    if (room.hostConnectionId === connectionId) {
      room.hostConnectionId = room.players[0]!.connectionId;
    }

    await this.repo.saveRoom(room);
    return room;
  }
}
