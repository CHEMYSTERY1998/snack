import type { GameConfig } from '../types/game';

// 默认游戏配置
export const DEFAULT_GAME_CONFIG: GameConfig = {
  gridWidth: 80,
  gridHeight: 50,
  cellSize: 15,
  gameSpeed: 50,
  maxPlayers: 8,
  initialSnakeLength: 3,
  foodSpawnRate: 0.1, // 每帧生成食物的概率
  powerUpSpawnRate: 0.02, // 每帧生成道具的概率
  respawnTime: 3000, // 复活等待时间 3秒
  powerUpDuration: {
    speed_boost: 0, // 永久效果
    speed_slow: 0, // 永久效果
    wall_pass: 0, // 次数制
    invincible: 0, // 次数制
    shrink_opponent: 0, // 即时效果
  },
};

// 道具图标映射
export const POWER_UP_ICONS: Record<string, string> = {
  speed_boost: '⚡',
  speed_slow: '🐌',
  wall_pass: '👻',
  invincible: '🛡️',
  shrink_opponent: '✂️',
};

// 道具名称映射
export const POWER_UP_NAMES: Record<string, string> = {
  speed_boost: '加速',
  speed_slow: '减速',
  wall_pass: '穿墙',
  invincible: '无敌',
  shrink_opponent: '缩短对手',
};

// 方向向量
export const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// 相反方向
export const OPPOSITE_DIRECTIONS = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

// 玩家颜色列表
export const PLAYER_COLORS = [
  '#FF6B6B', // 红色
  '#4ECDC4', // 青色
  '#45B7D1', // 蓝色
  '#96CEB4', // 绿色
  '#FFEAA7', // 黄色
  '#DDA0DD', // 紫色
  '#98D8C8', // 薄荷绿
  '#F7DC6F', // 金色
];

// 食物分数
export const FOOD_SCORES = {
  normal: 10,
  super: 30,
};

// 食物颜色（与玩家颜色区分）
export const FOOD_COLORS = {
  normal: '#FF8C42',  // 橙色
  super: '#FF69B4',   // 亮粉色（与玩家颜色完全不同）
};

// 道具分数
export const POWER_UP_SCORE = 5;

// 网络配置
export const NETWORK_CONFIG = {
  tickRate: 20, // 服务器每秒广播次数
  inputBufferSize: 60, // 客户端输入缓冲大小
  reconciliationThreshold: 2, // 状态调和阈值
};

// 服务器端口
export const SERVER_PORT = 8080;
