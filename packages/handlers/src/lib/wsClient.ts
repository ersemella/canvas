import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import type {ConnectionRecord} from 'repositories/RoomRepository';

export async function sendToConnection(
  endpoint: string,
  connectionId: string,
  data: unknown
): Promise<boolean> {
  const client = new ApiGatewayManagementApiClient({endpoint});
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      })
    );
    return true;
  } catch (err) {
    if (err instanceof GoneException) {
      return false; // stale connection — caller should clean up
    }
    throw err;
  }
}

export async function broadcastToRoom(
  endpoint: string,
  connections: ConnectionRecord[],
  data: unknown
): Promise<string[]> {
  const stale: string[] = [];
  await Promise.all(
    connections.map(async (conn) => {
      const sent = await sendToConnection(endpoint, conn.connectionId, data);
      if (!sent) stale.push(conn.connectionId);
    })
  );
  return stale;
}
