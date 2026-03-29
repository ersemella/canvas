import type {APIGatewayProxyHandlerV2} from 'aws-lambda';
import {RoomService} from 'services/RoomService';
import {ok, badRequest} from 'lib/response';

const roomService = new RoomService(process.env['TABLE_NAME']!);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const body = JSON.parse(event.body ?? '{}') as {
    hostName?: string;
    serverSystem?: string;
    maxPlayers?: number;
  };

  if (!body.hostName || !body.serverSystem) {
    return badRequest('Missing hostName or serverSystem');
  }

  const maxPlayers = body.maxPlayers ?? 6;
  const result = await roomService.createRoom({
    hostName: body.hostName,
    serverSystem: body.serverSystem,
    maxPlayers,
  });

  return ok({roomId: result.roomId, serverSystem: result.room.serverSystem});
};
