import type { RoomInfo, RoomState, RoomConfig } from '@shared/types/room';
import type { GameState, SnakeState, FoodState, PowerUpState, Position, Direction, PlayerInput, PowerUpType, GameResult } from '@shared/types/game';
import { generateId, randomUnoccupiedPosition, isSamePosition, isWithinBounds, getOppositeDirection } from '@shared/utils';
import { DEFAULT_GAME_CONFIG, FOOD_SCORES, POWER_UP_SCORE } from '@shared/constants';

export class GameRoom {
  info: RoomInfo;
  config: RoomConfig;
  password?: string;
  playerIds: string[] = [];
  state: RoomState;
  gameState: GameState | null = null;
  gameLoop: NodeJS.Timeout | null = null;

  private playerColors: Map<string, string> = new Map();
  private _playerInputs: Map<string, Direction> = new Map();
  private playerKillCounts: Map<string, number> = new Map();
  private playerStartTimes: Map<string, number> = new Map();

  private colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

  constructor(info: RoomInfo, config: RoomConfig, password?: string) {
    this.info = info;
    this.config = config;
    this.password = password;
    this.state = {
      info,
      config,
      playerIds: [],
      gameTick: 0,
    };
  }

  addPlayer(playerId: string): void {
    if (!this.playerIds.includes(playerId)) {
      this.playerIds.push(playerId);
      this.info.playerCount = this.playerIds.length;
      this.state.playerIds = this.playerIds;

      // 分配颜色
      const colorIndex = this.playerIds.length - 1;
      this.playerColors.set(playerId, this.colors[colorIndex % this.colors.length]);
    }
  }

  removePlayer(playerId: string): void {
    const index = this.playerIds.indexOf(playerId);
    if (index !== -1) {
      this.playerIds.splice(index, 1);
      this.info.playerCount = this.playerIds.length;
      this.state.playerIds = this.playerIds;
      this.playerColors.delete(playerId);
    }
  }

  startGame(): void {
    if (this.playerIds.length < 1) return;

    this.info.status = 'playing';
    this.gameState = this.createInitialState();
    this.gameLoop = setInterval(() => this.tick(), this.config.gameSpeed);

    // 记录开始时间
    const now = Date.now();
    this.playerIds.forEach(id => {
      this.playerStartTimes.set(id, now);
      this.playerKillCounts.set(id, 0);
    });
  }

  stopGame(): void {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    this.info.status = 'waiting';
  }

  handleInput(playerId: string, input: PlayerInput): void {
    if (!this.gameState) return;

    const snake = this.gameState.snakes.find(s => s.playerId === playerId);
    if (!snake || !snake.isAlive) return;

    // 防止 180° 转向
    if (getOppositeDirection(snake.direction) !== input.direction) {
      snake.direction = input.direction;
    }
  }

  private createInitialState(): GameState {
    const snakes: SnakeState[] = [];
    const gridWidth = this.config.mapWidth;
    const gridHeight = this.config.mapHeight;

    // 为每个玩家创建蛇
    this.playerIds.forEach((playerId, index) => {
      const startPositions = this.getStartPositions(index, this.playerIds.length, gridWidth, gridHeight);
      const direction = this.getStartDirection(index);

      const snake: SnakeState = {
        id: generateId(),
        playerId,
        segments: startPositions.map(pos => ({ position: pos })),
        direction,
        speed: 1,
        score: 0,
        isAlive: true,
        effects: [],
        color: this.playerColors.get(playerId) || '#FF6B6B',
      };

      snakes.push(snake);
    });

    // 生成初始食物
    const foods: FoodState[] = [];
    const occupiedPositions = snakes.flatMap(s => s.segments.map(seg => seg.position));

    for (let i = 0; i < 5; i++) {
      const pos = randomUnoccupiedPosition(gridWidth, gridHeight, occupiedPositions);
      if (pos) {
        foods.push({
          id: generateId(),
          position: pos,
          type: 'normal',
          value: FOOD_SCORES.normal,
        });
      }
    }

    return {
      tick: 0,
      snakes,
      foods,
      powerUps: [],
      isRunning: true,
      startTime: Date.now(),
    };
  }

  private getStartPositions(playerIndex: number, totalPlayers: number, width: number, height: number): Position[] {
    const margin = 10;
    const length = DEFAULT_GAME_CONFIG.initialSnakeLength;

    // 在四个角落附近生成起始位置，面向中心
    const corners = [
      { x: margin + length, y: margin + length },           // 左上角，向右下
      { x: width - margin - length, y: margin + length },   // 右上角，向左下
      { x: width - margin - length, y: height - margin - length }, // 右下角，向左上
      { x: margin + length, y: height - margin - length },  // 左下角，向右上
    ];

    const corner = corners[playerIndex % 4];
    const positions: Position[] = [];

    // 根据角落位置决定身体排列方向（尾巴在后面）
    if (playerIndex % 4 === 0) {
      // 左上：蛇头在右下，身体向左上延伸，向右下移动
      for (let i = 0; i < length; i++) {
        positions.push({ x: corner.x - i, y: corner.y });
      }
    } else if (playerIndex % 4 === 1) {
      // 右上：蛇头在左，身体向右延伸，向左移动
      for (let i = 0; i < length; i++) {
        positions.push({ x: corner.x + i, y: corner.y });
      }
    } else if (playerIndex % 4 === 2) {
      // 右下：蛇头在左，身体向右延伸，向左移动
      for (let i = 0; i < length; i++) {
        positions.push({ x: corner.x + i, y: corner.y });
      }
    } else {
      // 左下：蛇头在右，身体向左延伸，向右移动
      for (let i = 0; i < length; i++) {
        positions.push({ x: corner.x - i, y: corner.y });
      }
    }

    return positions;
  }

  private getStartDirection(playerIndex: number): Direction {
    // 方向与起始位置对应，面向中心
    const directions: Direction[] = ['right', 'left', 'left', 'right'];
    return directions[playerIndex % 4];
  }

  private tick(): void {
    if (!this.gameState || !this.gameState.isRunning) return;

    this.gameState.tick++;

    // 检查并复活死亡的蛇
    this.checkRespawns();

    // 更新所有蛇
    this.updateSnakes();

    // 生成食物
    this.spawnFood();

    // 生成道具
    if (Math.random() < DEFAULT_GAME_CONFIG.powerUpSpawnRate) {
      this.spawnPowerUp();
    }
  }

  private checkRespawns(): void {
    if (!this.gameState) return;

    const now = Date.now();
    for (const snake of this.gameState.snakes) {
      // 如果蛇死亡且到达复活时间
      if (!snake.isAlive && snake.respawnTime && now >= snake.respawnTime) {
        this.respawnSnake(snake);
      }
    }
  }

  private updateSnakes(): void {
    if (!this.gameState) return;

    const gridWidth = this.config.mapWidth;
    const gridHeight = this.config.mapHeight;

    for (const snake of this.gameState.snakes) {
      if (!snake.isAlive) continue;

      // 更新效果
      const now = Date.now();
      snake.effects = snake.effects.filter(e => e.endTime > now);

      // 计算新头部位置
      const head = snake.segments[0].position;
      const dirVectors: Record<Direction, Position> = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      };

      const vector = dirVectors[snake.direction];
      const hasWallPass = snake.effects.some(e => e.type === 'wall_pass');

      let newHead: Position = {
        x: head.x + vector.x,
        y: head.y + vector.y,
      };

      // 穿墙处理
      if (hasWallPass) {
        newHead.x = (newHead.x + gridWidth) % gridWidth;
        newHead.y = (newHead.y + gridHeight) % gridHeight;
      } else {
        // 边界碰撞
        if (!isWithinBounds(newHead, gridWidth, gridHeight)) {
          this.killSnake(snake);
          continue;
        }
      }

      // 自身碰撞 - 排除蛇头和尾巴（尾巴即将移动）
      const bodySegments = snake.segments.slice(1, -1);
      if (bodySegments.some(seg => isSamePosition(seg.position, newHead))) {
        const hasInvincible = snake.effects.some(e => e.type === 'invincible');
        if (!hasInvincible) {
          this.killSnake(snake);
          continue;
        }
      }

      // 与其他蛇碰撞
      for (const otherSnake of this.gameState.snakes) {
        if (otherSnake.id === snake.id || !otherSnake.isAlive) continue;

        if (otherSnake.segments.some(seg => isSamePosition(seg.position, newHead))) {
          const hasInvincible = snake.effects.some(e => e.type === 'invincible');
          if (!hasInvincible) {
            this.killSnake(snake);
            // 记录击杀
            this.playerKillCounts.set(
              otherSnake.playerId,
              (this.playerKillCounts.get(otherSnake.playerId) || 0) + 1
            );
            continue;
          }
        }
      }

      if (!snake.isAlive) continue;

      // 移动蛇
      snake.segments.unshift({ position: newHead });

      // 检查食物
      const foodIndex = this.gameState.foods.findIndex(f => isSamePosition(f.position, newHead));
      if (foodIndex !== -1) {
        const food = this.gameState.foods[foodIndex];
        const hasDoubleScore = snake.effects.some(e => e.type === 'double_score');
        snake.score += hasDoubleScore ? food.value * 2 : food.value;
        this.gameState.foods.splice(foodIndex, 1);
        // 吃到食物不删除尾巴，蛇变长
      } else {
        snake.segments.pop();
      }

      // 检查道具
      const powerUpIndex = this.gameState.powerUps.findIndex(p => isSamePosition(p.position, newHead));
      if (powerUpIndex !== -1) {
        const powerUp = this.gameState.powerUps[powerUpIndex];
        this.applyPowerUp(snake, powerUp);
        this.gameState.powerUps.splice(powerUpIndex, 1);
      }
    }
  }

  private killSnake(snake: SnakeState): void {
    snake.isAlive = false;
    // 设置复活时间
    snake.respawnTime = Date.now() + DEFAULT_GAME_CONFIG.respawnTime;
    // 清除效果
    snake.effects = [];
  }

  private respawnSnake(snake: SnakeState): void {
    const gridWidth = this.config.mapWidth;
    const gridHeight = this.config.mapHeight;
    const length = DEFAULT_GAME_CONFIG.initialSnakeLength;

    // 找一个安全的复活位置
    const margin = 10;
    const corners = [
      { x: margin + length, y: margin + length, dir: 'right' as Direction },
      { x: gridWidth - margin - length, y: margin + length, dir: 'left' as Direction },
      { x: gridWidth - margin - length, y: gridHeight - margin - length, dir: 'left' as Direction },
      { x: margin + length, y: gridHeight - margin - length, dir: 'right' as Direction },
    ];

    // 根据玩家索引选择角落
    const playerIndex = this.playerIds.indexOf(snake.playerId);
    const corner = corners[playerIndex % 4];

    // 生成新的身体段
    const positions: Position[] = [];
    if (corner.dir === 'right') {
      for (let i = 0; i < length; i++) {
        positions.push({ x: corner.x - i, y: corner.y });
      }
    } else {
      for (let i = 0; i < length; i++) {
        positions.push({ x: corner.x + i, y: corner.y });
      }
    }

    snake.segments = positions.map(pos => ({ position: pos }));
    snake.direction = corner.dir;
    snake.isAlive = true;
    snake.respawnTime = undefined;
    snake.effects = [];
  }

  private applyPowerUp(snake: SnakeState, powerUp: PowerUpState): void {
    snake.score += POWER_UP_SCORE;

    switch (powerUp.type) {
      case 'speed_boost':
      case 'speed_slow':
      case 'wall_pass':
      case 'invincible':
      case 'double_score':
        snake.effects.push({
          type: powerUp.type,
          endTime: Date.now() + powerUp.duration,
        });
        break;

      case 'shrink_opponent':
        // 缩短其他所有活着的蛇
        if (this.gameState) {
          for (const otherSnake of this.gameState.snakes) {
            if (otherSnake.id !== snake.id && otherSnake.isAlive) {
              const newLength = Math.max(3, Math.floor(otherSnake.segments.length / 2));
              otherSnake.segments = otherSnake.segments.slice(0, newLength);
            }
          }
        }
        break;
    }
  }

  private spawnFood(): void {
    if (!this.gameState) return;

    const maxFoods = Math.max(5, this.playerIds.length * 2);
    if (this.gameState.foods.length >= maxFoods) return;

    if (Math.random() < DEFAULT_GAME_CONFIG.foodSpawnRate) {
      const occupiedPositions = [
        ...this.gameState.snakes.flatMap(s => s.segments.map(seg => seg.position)),
        ...this.gameState.foods.map(f => f.position),
        ...this.gameState.powerUps.map(p => p.position),
      ];

      const pos = randomUnoccupiedPosition(
        this.config.mapWidth,
        this.config.mapHeight,
        occupiedPositions
      );

      if (pos) {
        const isSuper = Math.random() < 0.1;
        this.gameState.foods.push({
          id: generateId(),
          position: pos,
          type: isSuper ? 'super' : 'normal',
          value: isSuper ? FOOD_SCORES.super : FOOD_SCORES.normal,
        });
      }
    }
  }

  private spawnPowerUp(): void {
    if (!this.gameState) return;

    const maxPowerUps = 3;
    if (this.gameState.powerUps.length >= maxPowerUps) return;

    const occupiedPositions = [
      ...this.gameState.snakes.flatMap(s => s.segments.map(seg => seg.position)),
      ...this.gameState.foods.map(f => f.position),
      ...this.gameState.powerUps.map(p => p.position),
    ];

    const pos = randomUnoccupiedPosition(
      this.config.mapWidth,
      this.config.mapHeight,
      occupiedPositions
    );

    if (pos) {
      const types: PowerUpType[] = [
        'speed_boost',
        'speed_slow',
        'wall_pass',
        'invincible',
        'double_score',
        'shrink_opponent',
      ];
      const type = types[Math.floor(Math.random() * types.length)];

      this.gameState.powerUps.push({
        id: generateId(),
        type,
        position: pos,
        duration: DEFAULT_GAME_CONFIG.powerUpDuration[type] || 5000,
        spawnTime: Date.now(),
      });
    }
  }

  getGameResults(): GameResult[] {
    if (!this.gameState) return [];

    const results: GameResult[] = this.gameState.snakes.map(snake => ({
      playerId: snake.playerId,
      playerName: `Player_${snake.playerId.substring(0, 4)}`,
      score: snake.score,
      rank: 0,
      killCount: this.playerKillCounts.get(snake.playerId) || 0,
      survivalTime: Date.now() - (this.playerStartTimes.get(snake.playerId) || Date.now()),
    }));

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    // 设置排名
    results.forEach((r, i) => {
      r.rank = i + 1;
    });

    return results;
  }

  private endGame(): void {
    if (!this.gameState) return;

    this.gameState.isRunning = false;
    this.stopGame();
    this.info.status = 'finished';
  }
}
