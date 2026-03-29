import type {APIGatewayProxyHandlerV2} from 'aws-lambda';
import {RoomService} from 'services/RoomService';
import {ok, notFound, badRequest} from 'lib/response';

const roomService = new RoomService(process.env['TABLE_NAME']!);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const roomId = event.pathParameters?.['roomId'];
  if (!roomId) return badRequest('Missing roomId');

  const room = await roomService.getRoom(roomId);
  if (!room) return notFound('Room not found');

  return ok({
    roomId: room.roomId,
    serverSystem: room.serverSystem,
    status: room.status,
    players: room.players.map((p) => ({name: p.name, seatIndex: p.seatIndex})),
    maxPlayers: room.maxPlayers,
  });
};
