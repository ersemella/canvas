import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type {RoomPlayer} from 'games/ServerGameModule';

export type {RoomPlayer};

export interface RoomRecord {
  roomId: string;
  gameType: string;
  hostConnectionId: string;
  players: RoomPlayer[];
  maxPlayers: number;
  status: 'waiting' | 'in_progress';
  gameState: unknown | null;
  createdAt: number;
  ttl: number;
}

export interface ConnectionRecord {
  connectionId: string;
  roomId: string;
  playerName: string;
  joinedAt: number;
}

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

function roomPk(roomId: string): string {
  return `ROOM#${roomId}`;
}

function connSk(connectionId: string): string {
  return `CONN#${connectionId}`;
}

export class RoomRepository {
  constructor(private readonly tableName: string) {}

  async saveRoom(room: RoomRecord): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {pk: roomPk(room.roomId), sk: 'METADATA', ...room},
      })
    );
  }

  async getRoom(roomId: string): Promise<RoomRecord | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {pk: roomPk(roomId), sk: 'METADATA'},
      })
    );
    if (!result.Item) return null;
    const {pk: _pk, sk: _sk, ...room} = result.Item as {pk: string; sk: string} & RoomRecord;
    return room;
  }

  async deleteRoom(roomId: string): Promise<void> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {':pk': roomPk(roomId)},
      })
    );
    if (!result.Items) return;
    await Promise.all(
      result.Items.map((item) =>
        docClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: {pk: item['pk'] as string, sk: item['sk'] as string},
          })
        )
      )
    );
  }

  async saveConnection(conn: ConnectionRecord): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: roomPk(conn.roomId),
          sk: connSk(conn.connectionId),
          gsi1pk: connSk(conn.connectionId),
          ...conn,
        },
      })
    );
  }

  async getConnection(connectionId: string): Promise<ConnectionRecord | null> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :gsi1pk',
        ExpressionAttributeValues: {':gsi1pk': connSk(connectionId)},
        Limit: 1,
      })
    );
    const item = result.Items?.[0];
    if (!item) return null;
    const {
      pk: _pk,
      sk: _sk,
      gsi1pk: _gsi1pk,
      ...conn
    } = item as {pk: string; sk: string; gsi1pk: string} & ConnectionRecord;
    return conn;
  }

  async deleteConnection(roomId: string, connectionId: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {pk: roomPk(roomId), sk: connSk(connectionId)},
      })
    );
  }

  async getConnectionsByRoom(roomId: string): Promise<ConnectionRecord[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': roomPk(roomId),
          ':prefix': 'CONN#',
        },
      })
    );
    if (!result.Items) return [];
    return result.Items.map((item) => {
      const {
        pk: _pk,
        sk: _sk,
        gsi1pk: _gsi1pk,
        ...conn
      } = item as {pk: string; sk: string; gsi1pk: string} & ConnectionRecord;
      return conn;
    });
  }

  async updateGameState(
    roomId: string,
    gameState: unknown,
    status?: 'waiting' | 'in_progress'
  ): Promise<void> {
    const updates: string[] = ['gameState = :gs'];
    const values: Record<string, unknown> = {':gs': gameState};
    if (status !== undefined) {
      updates.push('#st = :st');
      values[':st'] = status;
    }
    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {pk: roomPk(roomId), sk: 'METADATA'},
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeNames: status !== undefined ? {'#st': 'status'} : undefined,
        ExpressionAttributeValues: values,
      })
    );
  }
}
