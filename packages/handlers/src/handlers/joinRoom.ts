import type {APIGatewayProxyHandlerV2} from 'aws-lambda';
import {RoomService} from 'services/RoomService';
import {ok, badRequest, notFound} from 'lib/response';
import {RoomNotFoundError, RoomFullError, GameInProgressError} from 'lib/errors';

const roomService = new RoomService(process.env['TABLE_NAME']!);
// WS_ENDPOINT is the callback URL (https://…/prod); strip trailing path for the
// client-facing wss:// URL that the frontend passes to new WebSocket().
const WS_URL = (process.env['WS_ENDPOINT'] ?? '').replace(/^https/, 'wss');

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const roomId = event.pathParameters?.['roomId'];
  const body = JSON.parse(event.body ?? '{}') as {playerName?: string};

  if (!roomId || !body.playerName) {
    return badRequest('Missing roomId or playerName');
  }

  try {
    const room = await roomService.getRoom(roomId);
    if (!room) return notFound('Room not found');
    if (room.status === 'in_progress') return badRequest('Game already in progress');
    if (room.players.length >= room.maxPlayers) return badRequest('Room is full');

    return ok({roomId, wsUrl: WS_URL, serverSystem: room.serverSystem});
  } catch (err) {
    if (err instanceof RoomNotFoundError) return notFound(err.message);
    if (err instanceof RoomFullError || err instanceof GameInProgressError)
      return badRequest(err.message);
    throw err;
  }
};
