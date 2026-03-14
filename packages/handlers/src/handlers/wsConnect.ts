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
    const room = await roomService.joinRoom({roomId, playerName, connectionId});
    const connections = await roomRepo.getConnectionsByRoom(roomId);
    await broadcastToRoom(wsEndpoint, connections, {
      type: 'playerJoined',
      players: room.players.map((p) => ({name: p.name, seatIndex: p.seatIndex})),
    });
    await sendToConnection(wsEndpoint, connectionId, {type: 'connected', connectionId});
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
