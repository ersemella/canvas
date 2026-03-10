export interface ApiResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

const JSON_HEADERS = {'Content-Type': 'application/json'};

export function ok(body: unknown): ApiResponse {
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

export function badRequest(message: string): ApiResponse {
  return {
    statusCode: 400,
    headers: JSON_HEADERS,
    body: JSON.stringify({error: message}),
  };
}

export function notFound(message = 'Not found'): ApiResponse {
  return {
    statusCode: 404,
    headers: JSON_HEADERS,
    body: JSON.stringify({error: message}),
  };
}
