// 房间状态
export type RoomStatus = 'waiting' | 'playing' | 'finished';

// 房间配置
export interface RoomConfig {
  maxPlayers: number;
  gameSpeed: number;
  hasPassword: boolean;
  mapWidth: number;
  mapHeight: number;
}

// 房间信息
export interface RoomInfo {
  id: string;
  name: string;
  hostId: string;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  hasPassword: boolean;
  createdAt: number;
}

// 房间完整状态
export interface RoomState {
  info: RoomInfo;
  config: RoomConfig;
  playerIds: string[];
  gameTick: number;
}
