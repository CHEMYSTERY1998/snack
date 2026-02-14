import type { Position, Direction, ActiveEffect, FoodState, PowerUpState, GameState } from './game';

// 蛇的增量更新
export interface SnakeDelta {
  id: string;
  playerId: string;

  // 位置更新：只发送头部位置变化
  head?: Position;           // 新头部位置
  tailRemoved?: boolean;     // 是否移除了尾巴
  newTailPositions?: Position[]; // 如果蛇变长了，需要额外添加的位置

  // 状态更新
  direction?: Direction;
  score?: number;
  isAlive?: boolean;
  respawnTime?: number | null;  // null 表示清除复活时间
  spawnTime?: number;
  effects?: ActiveEffect[];

  // 道具属性
  speedBoostCount?: number;
  speedSlowCount?: number;
  wallPassCount?: number;
  invincibleCount?: number;
  maxLength?: number;
}

// 游戏增量状态
export interface GameDelta {
  tick: number;
  timestamp: number;

  // 完整同步标记
  fullSync: boolean;
  fullState?: GameState;  // 仅在 fullSync=true 时使用

  // 增量数据（fullSync=false 时使用）
  snakes?: SnakeDelta[];
  newFoods?: FoodState[];
  removedFoodIds?: string[];
  newPowerUps?: PowerUpState[];
  removedPowerUpIds?: string[];
  messages?: string[];     // 新消息（追加）
  isRunning?: boolean;     // 游戏运行状态变化
}

// 压缩的位置格式（用于网络传输）
export type CompressedPosition = number; // x * 256 + y

// 压缩的蛇数据
export interface CompressedSnake {
  id: string;
  playerId: string;
  playerName: string;
  color: string;
  // 头部位置 + 方向 + 长度，客户端可以重建
  headX: number;
  headY: number;
  direction: Direction;
  length: number;
  // 其他状态
  score: number;
  isAlive: boolean;
  effects: string[]; // ActiveEffect JSON 字符串数组
  speedBoostCount: number;
  speedSlowCount: number;
  wallPassCount: number;
  invincibleCount: number;
  maxLength: number;
  respawnTime?: number;
  spawnTime?: number;
}

// 压缩的游戏状态
export interface CompressedGameState {
  t: number;           // tick
  ts: number;          // timestamp
  s: CompressedSnake[]; // snakes
  f: Array<[string, number, number, number, number]>; // foods: [id, x, y, type, value]
  p: Array<[string, string, number, number, number, number, number]>; // powerUps: [id, type, x, y, duration, spawnTime, size]
  r: boolean;          // isRunning
  m?: string[];        // messages
}
