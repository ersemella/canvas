export class RoomNotFoundError extends Error {
  constructor(roomId: string) {
    super(`Room not found: ${roomId}`);
    this.name = 'RoomNotFoundError';
  }
}

export class RoomFullError extends Error {
  constructor(roomId: string) {
    super(`Room is full: ${roomId}`);
    this.name = 'RoomFullError';
  }
}

export class GameInProgressError extends Error {
  constructor(roomId: string) {
    super(`Game already in progress: ${roomId}`);
    this.name = 'GameInProgressError';
  }
}

export class NotYourTurnError extends Error {
  constructor() {
    super('Not your turn');
    this.name = 'NotYourTurnError';
  }
}
