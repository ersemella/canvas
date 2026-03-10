import type {APIGatewayProxyHandlerV2} from 'aws-lambda';
import {RoomService} from 'services/RoomService';
import {ok, badRequest} from 'lib/response';

const roomService = new RoomService(process.env['TABLE_NAME']!);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const body = JSON.parse(event.body ?? '{}') as {
    hostName?: string;
    gameType?: string;
    maxPlayers?: number;
  };

  if (!body.hostName || !body.gameType) {
    return badRequest('Missing hostName or gameType');
  }

  const maxPlayers = body.maxPlayers ?? 6;
  const result = await roomService.createRoom({
    hostName: body.hostName,
    gameType: body.gameType,
    maxPlayers,
  });

  return ok({roomId: result.roomId, gameType: result.room.gameType});
};
