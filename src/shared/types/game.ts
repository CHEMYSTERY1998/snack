// 位置坐标
export interface Position {
  x: number;
  y: number;
}

// 方向
export type Direction = 'up' | 'down' | 'left' | 'right';

// 蛇的身体段
export interface SnakeSegment {
  position: Position;
}

// 蛇的完整状态
export interface SnakeState {
  id: string;
  playerId: string;
  playerName: string; // 玩家名称
  segments: SnakeSegment[];
  direction: Direction;
  speed: number;
  score: number;
  isAlive: boolean;
  isPaused: boolean; // 是否暂停
  effects: ActiveEffect[];
  color: string;
  respawnTime?: number; // 复活时间戳，undefined 表示存活
  spawnTime?: number; // 出生/复活时间戳，用于1秒保护期
  // 道具属性
  speedBoostCount: number;  // 加速层数（永久）
  speedSlowCount: number;   // 减速层数（永久）
  wallPassCount: number;    // 穿墙次数
  invincibleCount: number;  // 无敌次数
  maxLength: number; // 最长长度
}

// 食物类型
export type FoodType = 'normal' | 'super';

// 食物状态
export interface FoodState {
  id: string;
  position: Position;
  type: FoodType;
  value: number;
}

// 道具类型
export type PowerUpType =
  | 'speed_boost'    // 加速（永久）
  | 'speed_slow'     // 减速（永久）
  | 'wall_pass'      // 穿墙（次数）
  | 'invincible'     // 无敌（次数）
  | 'shrink_opponent'; // 缩短对手（即时效果）

// 道具状态
export interface PowerUpState {
  id: string;
  type: PowerUpType;
  position: Position; // 左上角位置
  duration: number;
  spawnTime: number;
  size: number; // 道具占据的格子数（2 = 2x2）
}

// 激活的效果
export interface ActiveEffect {
  type: PowerUpType;
  endTime: number;
}

// 游戏配置
export interface GameConfig {
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  gameSpeed: number; // 毫秒每帧
  maxPlayers: number;
  initialSnakeLength: number;
  foodSpawnRate: number;
  powerUpSpawnRate: number;
  respawnTime: number; // 复活等待时间（毫秒）
  powerUpDuration: {
    speed_boost: number;
    speed_slow: number;
    wall_pass: number;
    invincible: number;
    shrink_opponent: number;
  };
}

// 游戏状态
export interface GameState {
  tick: number;
  snakes: SnakeState[];
  foods: FoodState[];
  powerUps: PowerUpState[];
  isRunning: boolean;
  startTime: number;
  messages: string[]; // 公屏消息
}

// 玩家输入
export interface PlayerInput {
  direction: Direction;
  timestamp: number;
}

// 游戏结果
export interface GameResult {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
  killCount: number;
  survivalTime: number;
}
