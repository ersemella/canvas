import type {APIGatewayProxyWebsocketHandlerV2} from 'aws-lambda';
import {RoomService} from 'services/RoomService';
import {RoomRepository} from 'repositories/RoomRepository';
import {broadcastToRoom} from 'lib/wsClient';

const tableName = process.env['TABLE_NAME']!;
const wsEndpoint = process.env['WS_ENDPOINT']!;

const roomService = new RoomService(tableName);
const roomRepo = new RoomRepository(tableName);

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const {connectionId} = event.requestContext;

  const conn = await roomRepo.getConnection(connectionId);
  if (!conn) return {statusCode: 200};

  const room = await roomService.removePlayer(conn.roomId, connectionId);
  if (!room) return {statusCode: 200};

  const connections = await roomRepo.getConnectionsByRoom(conn.roomId);
  await broadcastToRoom(wsEndpoint, connections, {
    type: 'playerLeft',
    connectionId,
    players: room.players.map((p) => ({name: p.name, seatIndex: p.seatIndex})),
  });

  return {statusCode: 200};
};
