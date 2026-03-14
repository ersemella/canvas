import type {APIGatewayProxyWebsocketHandlerV2} from 'aws-lambda';
import {RoomRepository} from 'repositories/RoomRepository';
import {gameRegistry} from 'games/registry';
import {sendToConnection} from 'lib/wsClient';

const tableName = process.env['TABLE_NAME']!;
const wsEndpoint = process.env['WS_ENDPOINT']!;

const roomRepo = new RoomRepository(tableName);

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const {connectionId} = event.requestContext;
  const body = JSON.parse(event.body ?? '{}') as {action?: string; payload?: unknown};

  const conn = await roomRepo.getConnection(connectionId);
  if (!conn) return {statusCode: 200};

  const room = await roomRepo.getRoom(conn.roomId);
  if (!room) return {statusCode: 200};

  const gameModule = gameRegistry.get(room.gameType);
  if (!gameModule) {
    await sendToConnection(wsEndpoint, connectionId, {
      type: 'error',
      message: 'Unknown game type',
    });
    return {statusCode: 200};
  }

  switch (body.action) {
    case 'startGame': {
      if (room.status === 'in_progress') break;
      const newState = gameModule.createInitialState(room.players);
      await roomRepo.updateGameState(conn.roomId, newState, 'in_progress');
      const connections = await roomRepo.getConnectionsByRoom(conn.roomId);
      await Promise.all(
        connections.map((c) =>
          sendToConnection(wsEndpoint, c.connectionId, {
            type: 'gameStarted',
            state: gameModule.getPublicState(newState, c.connectionId),
          })
        )
      );
      break;
    }

    case 'playerAction': {
      if (!room.gameState) break;
      const actingId = gameModule.actingConnectionId(room.gameState);
      if (actingId !== connectionId) {
        await sendToConnection(wsEndpoint, connectionId, {
          type: 'error',
          message: 'Not your turn',
        });
        break;
      }
      const newState = gameModule.handleAction(room.gameState, connectionId, body.payload);
      await roomRepo.updateGameState(conn.roomId, newState);
      const connections = await roomRepo.getConnectionsByRoom(conn.roomId);
      await Promise.all(
        connections.map((c) =>
          sendToConnection(wsEndpoint, c.connectionId, {
            type: 'stateUpdate',
            state: gameModule.getPublicState(newState, c.connectionId),
          })
        )
      );
      break;
    }

    case 'nextHand': {
      if (room.status !== 'in_progress' || !room.gameState) break;
      const gs = room.gameState as {players: Array<{connectionId: string; chips: number}>};
      const updatedPlayers = room.players.map((rp) => {
        const sp = gs.players.find((p) => p.connectionId === rp.connectionId);
        return {...rp, chips: sp?.chips ?? rp.chips};
      });
      const newState = gameModule.createInitialState(updatedPlayers);
      await roomRepo.updateGameState(conn.roomId, newState);
      const connections = await roomRepo.getConnectionsByRoom(conn.roomId);
      await Promise.all(
        connections.map((c) =>
          sendToConnection(wsEndpoint, c.connectionId, {
            type: 'gameStarted',
            state: gameModule.getPublicState(newState, c.connectionId),
          })
        )
      );
      break;
    }

    default:
      await sendToConnection(wsEndpoint, connectionId, {
        type: 'error',
        message: `Unknown action: ${body.action ?? ''}`,
      });
  }

  return {statusCode: 200};
};
