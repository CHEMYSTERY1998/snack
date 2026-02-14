import type { GameState, PlayerInput, GameResult } from './game';
import type { RoomInfo, RoomState, RoomConfig } from './room';
import type { PlayerInfo, LeaderboardEntry } from './player';

// 客户端 -> 服务器事件
export interface ClientToServerEvents {
  // 玩家
  'player:join': (data: { name: string }) => void;
  'player:leave': () => void;

  // 房间
  'room:create': (data: { name: string; password?: string; config?: Partial<RoomConfig> }) => void;
  'room:join': (data: { roomId: string; password?: string }) => void;
  'room:leave': () => void;
  'room:list': () => void;
  'room:update_config': (data: Partial<RoomConfig>) => void;

  // 游戏
  'game:start': () => void;
  'game:input': (data: PlayerInput) => void;
  'game:ready': () => void;

  // 排行榜
  'leaderboard:get': (data?: { limit?: number }) => void;

  // 延时测量
  'ping': (data: { timestamp: number }) => void;
}

// 服务器 -> 客户端事件
export interface ServerToClientEvents {
  // 玩家
  'player:joined': (data: { player: PlayerInfo }) => void;
  'player:left': (data: { playerId: string }) => void;
  'player:error': (data: { message: string }) => void;

  // 房间
  'room:created': (data: { room: RoomInfo }) => void;
  'room:joined': (data: { room: RoomState; players: PlayerInfo[] }) => void;
  'room:left': () => void;
  'room:list': (data: { rooms: RoomInfo[] }) => void;
  'room:player_joined': (data: { player: PlayerInfo }) => void;
  'room:player_left': (data: { playerId: string }) => void;
  'room:updated': (data: { room: RoomState }) => void;
  'room:error': (data: { message: string }) => void;

  // 游戏
  'game:state': (data: { state: GameState; timestamp: number }) => void;
  'game:started': () => void;
  'game:ended': (data: { results: GameResult[] }) => void;
  'game:input_ack': (data: { tick: number; direction: string }) => void;

  // 排行榜
  'leaderboard:data': (data: { entries: LeaderboardEntry[] }) => void;

  // 延时测量
  'pong': (data: { timestamp: number }) => void;
}

// 类型导出
export type { GameState, PlayerInput, GameResult, RoomInfo, RoomState, RoomConfig, PlayerInfo, LeaderboardEntry };
