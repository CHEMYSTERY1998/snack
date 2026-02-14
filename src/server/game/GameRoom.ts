import type { RoomInfo, RoomState, RoomConfig } from '@shared/types/room';
import type { GameState, SnakeState, FoodState, PowerUpState, Position, Direction, PlayerInput, PowerUpType, GameResult } from '@shared/types/game';
import { generateId, randomUnoccupiedPosition, isSamePosition, isWithinBounds, getOppositeDirection, isPositionOccupied } from '@shared/utils';
import { DEFAULT_GAME_CONFIG, FOOD_SCORES, POWER_UP_SCORE, PLAYER_COLORS, POWER_UP_NAMES } from '@shared/constants';

export class GameRoom {
  info: RoomInfo;
  config: RoomConfig;
  password?: string;
  playerIds: string[] = [];
  state: RoomState;
  gameState: GameState | null = null;
  gameLoop: NodeJS.Timeout | null = null;

  private playerColors: Map<string, string> = new Map();
  private playerNames: Map<string, string> = new Map();
  private _playerInputs: Map<string, Direction> = new Map();
  private playerKillCounts: Map<string, number> = new Map();
  private playerStartTimes: Map<string, number> = new Map();

  private readonly SPAWN_PROTECTION_TIME = 1000; // 出生/复活保护时间（毫秒）

  private isSpawnProtected(snake: SnakeState): boolean {
    if (!snake.spawnTime) return false;
    return Date.now() - snake.spawnTime < this.SPAWN_PROTECTION_TIME;
  }

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

  addPlayer(playerId: string, playerName?: string): void {
    if (!this.playerIds.includes(playerId)) {
      this.playerIds.push(playerId);
      this.info.playerCount = this.playerIds.length;
      this.state.playerIds = this.playerIds;

      // 分配颜色
      const colorIndex = this.playerIds.length - 1;
      this.playerColors.set(playerId, PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]);

      // 存储玩家名称
      if (playerName) {
        this.playerNames.set(playerId, playerName);
      }
    }
  }

  removePlayer(playerId: string): void {
    const index = this.playerIds.indexOf(playerId);
    if (index !== -1) {
      this.playerIds.splice(index, 1);
      this.info.playerCount = this.playerIds.length;
      this.state.playerIds = this.playerIds;
      this.playerColors.delete(playerId);
      this.playerNames.delete(playerId);
      this.playerKillCounts.delete(playerId);
      this.playerStartTimes.delete(playerId);
      this._playerInputs.delete(playerId);

      // 移除玩家的蛇（如果游戏正在进行）
      if (this.gameState) {
        const snakeIndex = this.gameState.snakes.findIndex(s => s.playerId === playerId);
        if (snakeIndex !== -1) {
          this.gameState.snakes.splice(snakeIndex, 1);
        }
      }
    }
  }

  // 生成随机出生位置和方向
  private getRandomSpawnPosition(): { headPos: Position; direction: Direction; segments: Position[] } | null {
    if (!this.gameState) return null;

    const gridWidth = this.config.mapWidth;
    const gridHeight = this.config.mapHeight;
    const length = DEFAULT_GAME_CONFIG.initialSnakeLength;
    const margin = 5;

    // 获取所有已占用的位置（排除死亡蛇，包括道具的所有格子）
    const occupiedPositions = [
      ...this.gameState.snakes.filter(s => s.isAlive).flatMap(s => s.segments.map(seg => seg.position)),
      ...this.gameState.foods.map(f => f.position),
      ...this.gameState.powerUps.flatMap(p => {
        const positions: Position[] = [];
        const size = p.size || 1;
        for (let dx = 0; dx < size; dx++) {
          for (let dy = 0; dy < size; dy++) {
            positions.push({ x: p.position.x + dx, y: p.position.y + dy });
          }
        }
        return positions;
      }),
    ];

    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    const dirVectors: Record<Direction, Position> = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };

    // 尝试多次找到合适的位置
    for (let attempt = 0; attempt < 100; attempt++) {
      const direction = directions[Math.floor(Math.random() * directions.length)];
      const vector = dirVectors[direction];

      // 确保蛇头位置留有足够空间放置整个身体
      const minX = margin + (vector.x > 0 ? 0 : length - 1);
      const maxX = gridWidth - margin - 1 - (vector.x < 0 ? 0 : length - 1);
      const minY = margin + (vector.y > 0 ? 0 : length - 1);
      const maxY = gridHeight - margin - 1 - (vector.y < 0 ? 0 : length - 1);

      if (maxX < minX || maxY < minY) continue;

      const headX = minX + Math.floor(Math.random() * (maxX - minX + 1));
      const headY = minY + Math.floor(Math.random() * (maxY - minY + 1));
      const headPos = { x: headX, y: headY };

      // 生成身体段（尾巴在方向的反方向）
      const segments: Position[] = [];
      let valid = true;

      for (let i = 0; i < length; i++) {
        const segX = headX - vector.x * i;
        const segY = headY - vector.y * i;
        const segPos = { x: segX, y: segY };

        // 检查是否与已占用位置冲突
        if (isPositionOccupied(segPos, occupiedPositions)) {
          valid = false;
          break;
        }
        segments.push(segPos);
      }

      if (valid) {
        return { headPos, direction, segments };
      }
    }

    return null;
  }

  // 为游戏中加入的玩家创建蛇
  addSnakeForPlayer(playerId: string): void {
    if (!this.gameState) return;

    const length = DEFAULT_GAME_CONFIG.initialSnakeLength;
    const spawn = this.getRandomSpawnPosition();

    if (!spawn) {
      // 如果找不到随机位置，使用备用方案（固定向右方向，确保安全）
      const gridWidth = this.config.mapWidth;
      const gridHeight = this.config.mapHeight;
      const margin = 5;
      const direction: Direction = 'right';

      // 向右方向：确保头部右边有空间
      const minX = margin + length - 1;
      const maxX = gridWidth - margin - 1;
      const minY = margin;
      const maxY = gridHeight - margin - 1;

      const x = minX + Math.floor(Math.random() * (maxX - minX + 1));
      const y = minY + Math.floor(Math.random() * (maxY - minY + 1));

      const segments: Position[] = [];
      for (let i = 0; i < length; i++) {
        segments.push({ x: x - i, y: y });
      }

      const snake: SnakeState = {
        id: generateId(),
        playerId,
        playerName: this.playerNames.get(playerId) || '玩家',
        segments: segments.map(pos => ({ position: pos })),
        direction,
        speed: 1,
        score: 0,
        isAlive: true,
        isPaused: false,
        effects: [],
        color: this.playerColors.get(playerId) || '#FF6B6B',
        spawnTime: Date.now(),
        speedBoostCount: 0,
        speedSlowCount: 0,
        wallPassCount: 0,
        invincibleCount: 0,
        maxLength: segments.length,
      };

      this.gameState.snakes.push(snake);
      this.playerStartTimes.set(playerId, Date.now());
      this.playerKillCounts.set(playerId, 0);
      return;
    }

    const snake: SnakeState = {
      id: generateId(),
      playerId,
      playerName: this.playerNames.get(playerId) || '玩家',
      segments: spawn.segments.map(pos => ({ position: pos })),
      direction: spawn.direction,
      speed: 1,
      score: 0,
      isAlive: true,
      isPaused: false,
      effects: [],
      color: this.playerColors.get(playerId) || '#FF6B6B',
      spawnTime: Date.now(),
      speedBoostCount: 0,
      speedSlowCount: 0,
      wallPassCount: 0,
      invincibleCount: 0,
      maxLength: spawn.segments.length,
    };

    this.gameState.snakes.push(snake);

    // 初始化玩家数据
    this.playerStartTimes.set(playerId, Date.now());
    this.playerKillCounts.set(playerId, 0);
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
    if (!snake || !snake.isAlive || snake.isPaused) return;

    // 防止 180° 转向
    if (getOppositeDirection(snake.direction) !== input.direction) {
      snake.direction = input.direction;
    }
  }

  // 切换暂停状态
  togglePause(playerId: string): boolean {
    if (!this.gameState) return false;

    const snake = this.gameState.snakes.find(s => s.playerId === playerId);
    if (!snake) return false;

    snake.isPaused = !snake.isPaused;

    // 如果暂停，清除复活时间（停止复活）
    if (snake.isPaused && snake.respawnTime) {
      snake.respawnTime = undefined;
    }

    return snake.isPaused;
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
        playerName: this.playerNames.get(playerId) || '玩家',
        segments: startPositions.map(pos => ({ position: pos })),
        direction,
        speed: 1,
        score: 0,
        isAlive: true,
        isPaused: false,
        effects: [],
        color: this.playerColors.get(playerId) || '#FF6B6B',
        spawnTime: Date.now(),
        speedBoostCount: 0,
        speedSlowCount: 0,
        wallPassCount: 0,
        invincibleCount: 0,
        maxLength: startPositions.length,
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
      messages: [],
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
      // 如果蛇死亡且到达复活时间（暂停时不复活）
      if (!snake.isAlive && snake.respawnTime && now >= snake.respawnTime && !snake.isPaused) {
        this.respawnSnake(snake);
      }
    }
  }

  private updateSnakes(): void {
    if (!this.gameState) return;

    const gridWidth = this.config.mapWidth;
    const gridHeight = this.config.mapHeight;

    for (const snake of this.gameState.snakes) {
      if (!snake.isAlive || snake.isPaused) continue;

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
      const hasWallPass = snake.wallPassCount > 0;

      let newHead: Position = {
        x: head.x + vector.x,
        y: head.y + vector.y,
      };

      // 穿墙处理（次数制）
      if (hasWallPass && !isWithinBounds(newHead, gridWidth, gridHeight)) {
        newHead.x = (newHead.x + gridWidth) % gridWidth;
        newHead.y = (newHead.y + gridHeight) % gridHeight;
        snake.wallPassCount--; // 使用一次穿墙
      } else if (!isWithinBounds(newHead, gridWidth, gridHeight)) {
        // 边界碰撞（没有穿墙次数）
        this.killSnake(snake);
        continue;
      }

      // 检查是否有无敌次数
      const hasInvincible = snake.invincibleCount > 0;

      // 自身碰撞 - 排除蛇头和尾巴（尾巴即将移动）
      const bodySegments = snake.segments.slice(1, -1);
      if (bodySegments.some(seg => isSamePosition(seg.position, newHead))) {
        if (hasInvincible) {
          snake.invincibleCount--; // 使用一次无敌
        } else {
          this.killSnake(snake);
          continue;
        }
      }

      // 与其他蛇碰撞
      for (const otherSnake of this.gameState.snakes) {
        if (otherSnake.id === snake.id || !otherSnake.isAlive) continue;

        // 检查是否撞到其他蛇的头部
        const hitOtherHead = isSamePosition(otherSnake.segments[0].position, newHead);
        // 检查是否撞到其他蛇的身体
        const hitOtherBody = otherSnake.segments.slice(1).some(seg => isSamePosition(seg.position, newHead));

        if (hitOtherHead || hitOtherBody) {
          const otherHasInvincible = otherSnake.invincibleCount > 0;
          const snakeProtected = this.isSpawnProtected(snake);
          const otherProtected = this.isSpawnProtected(otherSnake);

          // 如果任何一方在保护期内，跳过碰撞（穿透效果）
          if (snakeProtected || otherProtected) {
            continue;
          }

          if (hitOtherHead) {
            // 撞头：双方都死（除非无敌）
            if (!hasInvincible) {
              this.killSnake(snake);
            } else {
              snake.invincibleCount--; // 使用一次无敌
            }
            if (!otherHasInvincible) {
              this.killSnake(otherSnake);
            } else {
              otherSnake.invincibleCount--; // 使用一次无敌
            }
          } else {
            // 撞到身体：撞人的蛇死亡，被撞的蛇不受影响
            if (!hasInvincible) {
              this.killSnake(snake);
            } else {
              snake.invincibleCount--; // 使用一次无敌
            }
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
        snake.score += food.value;
        this.gameState.foods.splice(foodIndex, 1);
        // 吃到食物不删除尾巴，蛇变长
        // 更新最长长度
        if (snake.segments.length > snake.maxLength) {
          snake.maxLength = snake.segments.length;
        }
      } else {
        snake.segments.pop();
      }

      // 检查道具（道具占据多个格子）
      const powerUpIndex = this.gameState.powerUps.findIndex(p => {
        const size = p.size || 1;
        for (let dx = 0; dx < size; dx++) {
          for (let dy = 0; dy < size; dy++) {
            if (isSamePosition({ x: p.position.x + dx, y: p.position.y + dy }, newHead)) {
              return true;
            }
          }
        }
        return false;
      });
      if (powerUpIndex !== -1) {
        const powerUp = this.gameState.powerUps[powerUpIndex];
        this.applyPowerUp(snake, powerUp);
        this.gameState.powerUps.splice(powerUpIndex, 1);
      }
    }
  }

  private killSnake(snake: SnakeState): void {
    // 将蛇的身体转换为食物
    if (this.gameState) {
      for (const segment of snake.segments) {
        // 每个身体段变成一个食物
        this.gameState.foods.push({
          id: generateId(),
          position: { ...segment.position },
          type: 'normal',
          value: FOOD_SCORES.normal,
        });
      }
    }

    snake.isAlive = false;
    // 设置复活时间
    snake.respawnTime = Date.now() + DEFAULT_GAME_CONFIG.respawnTime;
    // 清除效果
    snake.effects = [];
  }

  private respawnSnake(snake: SnakeState): void {
    const spawn = this.getRandomSpawnPosition();

    if (spawn) {
      snake.segments = spawn.segments.map(pos => ({ position: pos }));
      snake.direction = spawn.direction;
    } else {
      // 备用方案：固定向右方向，确保安全
      const gridWidth = this.config.mapWidth;
      const gridHeight = this.config.mapHeight;
      const length = DEFAULT_GAME_CONFIG.initialSnakeLength;
      const margin = 5;
      const direction: Direction = 'right';

      const minX = margin + length - 1;
      const maxX = gridWidth - margin - 1;
      const minY = margin;
      const maxY = gridHeight - margin - 1;

      const x = minX + Math.floor(Math.random() * (maxX - minX + 1));
      const y = minY + Math.floor(Math.random() * (maxY - minY + 1));

      const segments: Position[] = [];
      for (let i = 0; i < length; i++) {
        segments.push({ x: x - i, y: y });
      }

      snake.segments = segments.map(pos => ({ position: pos }));
      snake.direction = direction;
    }

    snake.isAlive = true;
    snake.respawnTime = undefined;
    snake.spawnTime = Date.now();
    snake.effects = [];
  }

  private applyPowerUp(snake: SnakeState, powerUp: PowerUpState): void {
    snake.score += POWER_UP_SCORE;

    // 获取玩家名称
    const playerName = this.playerNames.get(snake.playerId) || '玩家';
    const powerUpName = POWER_UP_NAMES[powerUp.type] || '道具';

    switch (powerUp.type) {
      case 'speed_boost':
        // 永久加速
        snake.speedBoostCount++;
        this.addGameMessage(`${playerName} 获得了 ${powerUpName}！`);
        break;

      case 'speed_slow':
        // 永久减速
        snake.speedSlowCount++;
        this.addGameMessage(`${playerName} 获得了 ${powerUpName}！`);
        break;

      case 'wall_pass':
        // 增加穿墙次数
        snake.wallPassCount++;
        this.addGameMessage(`${playerName} 获得了 ${powerUpName}（剩余${snake.wallPassCount}次）！`);
        break;

      case 'invincible':
        // 增加无敌次数
        snake.invincibleCount++;
        this.addGameMessage(`${playerName} 获得了 ${powerUpName}（剩余${snake.invincibleCount}次）！`);
        break;

      case 'shrink_opponent':
        // 随机选择一个其他活着的玩家缩短
        if (this.gameState) {
          const otherSnakes = this.gameState.snakes.filter(
            s => s.id !== snake.id && s.isAlive
          );
          if (otherSnakes.length > 0) {
            const targetSnake = otherSnakes[Math.floor(Math.random() * otherSnakes.length)];
            const oldLength = targetSnake.segments.length;
            const newLength = Math.max(3, Math.floor(oldLength / 2));
            targetSnake.segments = targetSnake.segments.slice(0, newLength);

            // 记录公屏消息
            const attackerName = this.playerNames.get(snake.playerId) || '玩家';
            const targetName = this.playerNames.get(targetSnake.playerId) || '玩家';
            this.addGameMessage(`${attackerName} 对 ${targetName} 使用了缩短效果！(${oldLength} → ${newLength})`);
          } else {
            // 没有目标可缩短，仍然显示提示
            const noTargetName = this.playerNames.get(snake.playerId) || '玩家';
            this.addGameMessage(`${noTargetName} 获得了 ${powerUpName}，但没有目标！`);
          }
        }
        break;
    }
  }

  // 游戏消息列表
  private readonly MAX_MESSAGES = 5;

  private addGameMessage(message: string): void {
    if (!this.gameState) return;
    const formattedMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.gameState.messages.push(formattedMessage);
    if (this.gameState.messages.length > this.MAX_MESSAGES) {
      this.gameState.messages.shift();
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

    const powerUpSize = 2; // 2x2 格子

    // 获取所有已占用的位置（包括现有道具的所有格子）
    const occupiedPositions = [
      ...this.gameState.snakes.flatMap(s => s.segments.map(seg => seg.position)),
      ...this.gameState.foods.map(f => f.position),
      ...this.gameState.powerUps.flatMap(p => {
        const positions: Position[] = [];
        for (let dx = 0; dx < (p.size || 1); dx++) {
          for (let dy = 0; dy < (p.size || 1); dy++) {
            positions.push({ x: p.position.x + dx, y: p.position.y + dy });
          }
        }
        return positions;
      }),
    ];

    // 找一个可以容纳 2x2 道具的位置
    const gridWidth = this.config.mapWidth;
    const gridHeight = this.config.mapHeight;
    let validPos: Position | null = null;

    for (let attempt = 0; attempt < 50; attempt++) {
      const x = Math.floor(Math.random() * (gridWidth - powerUpSize + 1));
      const y = Math.floor(Math.random() * (gridHeight - powerUpSize + 1));

      // 检查 2x2 区域是否都被占用
      let allFree = true;
      for (let dx = 0; dx < powerUpSize && allFree; dx++) {
        for (let dy = 0; dy < powerUpSize && allFree; dy++) {
          if (isPositionOccupied({ x: x + dx, y: y + dy }, occupiedPositions)) {
            allFree = false;
          }
        }
      }

      if (allFree) {
        validPos = { x, y };
        break;
      }
    }

    if (validPos) {
      const types: PowerUpType[] = [
        'speed_boost',
        'speed_slow',
        'wall_pass',
        'invincible',
        'shrink_opponent',
      ];
      const type = types[Math.floor(Math.random() * types.length)];

      this.gameState.powerUps.push({
        id: generateId(),
        type,
        position: validPos,
        duration: DEFAULT_GAME_CONFIG.powerUpDuration[type] || 5000,
        spawnTime: Date.now(),
        size: powerUpSize,
      });
    }
  }

  getGameResults(): GameResult[] {
    if (!this.gameState) return [];

    const results: GameResult[] = this.gameState.snakes.map(snake => ({
      playerId: snake.playerId,
      playerName: this.playerNames.get(snake.playerId) || `Player_${snake.playerId.substring(0, 4)}`,
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
