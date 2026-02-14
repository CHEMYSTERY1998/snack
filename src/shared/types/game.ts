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
  segments: SnakeSegment[];
  direction: Direction;
  speed: number;
  score: number;
  isAlive: boolean;
  effects: ActiveEffect[];
  color: string;
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
  | 'speed_boost'    // 加速
  | 'speed_slow'     // 减速
  | 'wall_pass'      // 穿墙
  | 'invincible'     // 无敌
  | 'double_score'   // 双倍积分
  | 'shrink_opponent'; // 缩短对手

// 道具状态
export interface PowerUpState {
  id: string;
  type: PowerUpType;
  position: Position;
  duration: number;
  spawnTime: number;
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
  powerUpDuration: {
    speed_boost: number;
    speed_slow: number;
    wall_pass: number;
    invincible: number;
    double_score: number;
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
