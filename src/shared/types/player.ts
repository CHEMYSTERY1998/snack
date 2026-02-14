// 玩家状态
export type PlayerStatus = 'connected' | 'inRoom' | 'playing' | 'disconnected';

// 玩家信息
export interface PlayerInfo {
  id: string;
  name: string;
  status: PlayerStatus;
  currentRoomId: string | null;
  color: string;
  connectedAt: number;
}

// 排行榜条目
export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  score: number;
  killCount: number;
  survivalTime: number;
  playedAt: number;
}
