import type { GameState, SnakeState, FoodState, PowerUpState } from '../types/game';
import type { CompressedSnake, CompressedGameState } from '../types/delta';
import type { ActiveEffect } from '../types/game';

// 压缩蛇状态
export function compressSnake(snake: SnakeState): CompressedSnake {
  const head = snake.segments[0]?.position || { x: 0, y: 0 };

  return {
    id: snake.id,
    playerId: snake.playerId,
    playerName: snake.playerName,
    color: snake.color,
    headX: head.x,
    headY: head.y,
    direction: snake.direction,
    length: snake.segments.length,
    score: snake.score,
    isAlive: snake.isAlive,
    effects: snake.effects.map((e: ActiveEffect) => JSON.stringify(e)),
    speedBoostCount: snake.speedBoostCount,
    speedSlowCount: snake.speedSlowCount,
    wallPassCount: snake.wallPassCount,
    invincibleCount: snake.invincibleCount,
    maxLength: snake.maxLength,
    respawnTime: snake.respawnTime,
    spawnTime: snake.spawnTime,
  };
}

// 解压蛇状态（需要上一帧的状态来重建身体）
export function decompressSnake(
  compressed: CompressedSnake,
  previousSnake?: SnakeState
): SnakeState {
  // 如果有之前的蛇状态，尝试重建身体
  let segments: { position: { x: number; y: number } }[];

  if (previousSnake && previousSnake.playerId === compressed.playerId) {
    // 从上一帧重建身体：移除尾巴，添加新头部
    segments = [...previousSnake.segments];
    segments.unshift({
      position: { x: compressed.headX, y: compressed.headY }
    });

    // 调整长度
    while (segments.length > compressed.length) {
      segments.pop();
    }
  } else {
    // 没有上一帧状态，创建最小表示
    segments = [];
    const headPos = { x: compressed.headX, y: compressed.headY };
    segments.push({ position: headPos });

    // 根据方向和长度生成身体
    const dirOffsets: Record<string, { x: number; y: number }> = {
      up: { x: 0, y: 1 },
      down: { x: 0, y: -1 },
      left: { x: 1, y: 0 },
      right: { x: -1, y: 0 },
    };
    const offset = dirOffsets[compressed.direction] || { x: 0, y: 1 };

    for (let i = 1; i < compressed.length; i++) {
      segments.push({
        position: {
          x: headPos.x + offset.x * i,
          y: headPos.y + offset.y * i,
        }
      });
    }
  }

  return {
    id: compressed.id,
    playerId: compressed.playerId,
    playerName: compressed.playerName,
    color: compressed.color,
    segments,
    direction: compressed.direction,
    speed: 1,
    score: compressed.score,
    isAlive: compressed.isAlive,
    effects: compressed.effects.map((e: string) => JSON.parse(e) as ActiveEffect),
    respawnTime: compressed.respawnTime,
    spawnTime: compressed.spawnTime,
    speedBoostCount: compressed.speedBoostCount,
    speedSlowCount: compressed.speedSlowCount,
    wallPassCount: compressed.wallPassCount,
    invincibleCount: compressed.invincibleCount,
    maxLength: compressed.maxLength,
  };
}

// 压缩游戏状态
export function compressGameState(state: GameState, timestamp: number): CompressedGameState {
  return {
    t: state.tick,
    ts: timestamp,
    s: state.snakes.map(compressSnake),
    f: state.foods.map((f: FoodState) => [f.id, f.position.x, f.position.y, f.type === 'super' ? 1 : 0, f.value]),
    p: state.powerUps.map((p: PowerUpState) => [p.id, p.type, p.position.x, p.position.y, p.duration, p.spawnTime, p.size || 1]),
    r: state.isRunning,
    m: state.messages.length > 0 ? state.messages : undefined,
  };
}

// 解压游戏状态
export function decompressGameState(
  compressed: CompressedGameState,
  previousState?: GameState
): GameState {
  const previousSnakes = previousState?.snakes || [];

  const snakes = compressed.s.map((cs: CompressedSnake) => {
    const prevSnake = previousSnakes.find((s: SnakeState) => s.playerId === cs.playerId);
    return decompressSnake(cs, prevSnake);
  });

  type CompressedFood = [string, number, number, number, number];

  const foods: FoodState[] = compressed.f.map((f: CompressedFood) => ({
    id: f[0],
    position: { x: f[1], y: f[2] },
    type: f[3] === 1 ? 'super' : 'normal',
    value: f[4],
  }));

  const powerUps: PowerUpState[] = compressed.p.map(p => ({
    id: p[0] as string,
    type: p[1] as PowerUpState['type'],
    position: { x: p[2] as number, y: p[3] as number },
    duration: p[4] as number,
    spawnTime: p[5] as number,
    size: p[6] as number,
  }));

  return {
    tick: compressed.t,
    snakes,
    foods,
    powerUps,
    isRunning: compressed.r,
    startTime: previousState?.startTime || Date.now(),
    messages: compressed.m || previousState?.messages || [],
  };
}

// 计算压缩后的大小（估算）
export function estimateCompressedSize(state: GameState): number {
  // 蛇：每条约 150-200 字节（压缩后约 100 字节）
  const snakeSize = state.snakes.length * 100;
  // 食物：每个约 30 字节（压缩后约 20 字节）
  const foodSize = state.foods.length * 20;
  // 道具：每个约 50 字节（压缩后约 30 字节）
  const powerUpSize = state.powerUps.length * 30;
  // 基础数据
  const baseSize = 50;

  return snakeSize + foodSize + powerUpSize + baseSize;
}

// 计算完整状态的大小（估算）
export function estimateFullStateSize(state: GameState): number {
  // 蛇：每条约 300-500 字节（取决于长度）
  const avgSnakeLength = state.snakes.reduce((sum: number, s: SnakeState) => sum + s.segments.length, 0) / Math.max(state.snakes.length, 1);
  const snakeSize = state.snakes.length * (200 + avgSnakeLength * 20);
  // 食物：每个约 50 字节
  const foodSize = state.foods.length * 50;
  // 道具：每个约 80 字节
  const powerUpSize = state.powerUps.length * 80;
  // 基础数据
  const baseSize = 100;

  return snakeSize + foodSize + powerUpSize + baseSize;
}
