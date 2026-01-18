export interface PublicRoom {
  roomCode: string;
  playerCount: number;
  maxPlayers: number;
  hostUsername: string;
}

export interface PaginatedPublicRooms {
  rooms: PublicRoom[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
