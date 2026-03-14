import type {APIGatewayProxyWebsocketHandlerV2, APIGatewayProxyWebsocketEventV2} from 'aws-lambda';

// queryStringParameters are present on $connect but not included in the SDK type
type WsConnectEvent = APIGatewayProxyWebsocketEventV2 & {
  queryStringParameters?: Record<string, string | undefined>;
};
import {RoomService} from 'services/RoomService';
import {RoomRepository} from 'repositories/RoomRepository';
import {broadcastToRoom, sendToConnection} from 'lib/wsClient';
import {RoomNotFoundError, RoomFullError, GameInProgressError} from 'lib/errors';

const tableName = process.env['TABLE_NAME']!;
const wsEndpoint = process.env['WS_ENDPOINT']!;

const roomService = new RoomService(tableName);
const roomRepo = new RoomRepository(tableName);

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (rawEvent) => {
  const event = rawEvent as WsConnectEvent;
  const {connectionId} = event.requestContext;
  const params = event.queryStringParameters ?? {};
  const roomId = params['roomId'];
  const playerName = params['playerName'];

  if (!roomId || !playerName) return {statusCode: 400};

  try {
    // Check for existing player with the same name (reconnect after refresh)
    const existingRoom = await roomRepo.getRoom(roomId);
    if (existingRoom) {
      const existingPlayer = existingRoom.players.find((p) => p.name === playerName);
      if (existingPlayer) {
        const oldConnectionId = existingPlayer.connectionId;
        existingPlayer.connectionId = connectionId;
        if (existingRoom.hostConnectionId === oldConnectionId) {
          existingRoom.hostConnectionId = connectionId;
        }
        await roomRepo.saveRoom(existingRoom);
        await roomRepo.deleteConnection(roomId, oldConnectionId);
        await roomRepo.saveConnection({connectionId, roomId, playerName, joinedAt: Math.floor(Date.now() / 1000)});
        const players = existingRoom.players.map((p) => ({name: p.name, seatIndex: p.seatIndex}));
        // Broadcast to existing connections only — PostToConnection rejects the
        // connecting socket's own connectionId from within $connect
        const connections = await roomRepo.getConnectionsByRoom(roomId);
        const others = connections.filter((c) => c.connectionId !== connectionId);
        await broadcastToRoom(wsEndpoint, others, {type: 'playerJoined', players});
        // Include player list in connected so the joining player gets initial state
        await sendToConnection(wsEndpoint, connectionId, {type: 'connected', connectionId, players});
        return {statusCode: 200};
      }
    }

    const room = await roomService.joinRoom({roomId, playerName, connectionId});
    const players = room.players.map((p) => ({name: p.name, seatIndex: p.seatIndex}));
    const connections = await roomRepo.getConnectionsByRoom(roomId);
    const others = connections.filter((c) => c.connectionId !== connectionId);
    await broadcastToRoom(wsEndpoint, others, {type: 'playerJoined', players});
    await sendToConnection(wsEndpoint, connectionId, {type: 'connected', connectionId, players});
    return {statusCode: 200};
  } catch (err) {
    if (
      err instanceof RoomNotFoundError ||
      err instanceof RoomFullError ||
      err instanceof GameInProgressError
    ) {
      return {statusCode: 400};
    }
    throw err;
  }
};
