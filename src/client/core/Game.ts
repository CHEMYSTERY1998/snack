import type { GameState, Direction, SnakeState, Position } from '@shared/types/game';
import type { NetworkClient } from '../network/NetworkClient';
import { Renderer } from '../renderer/Renderer';
import { InputHandler } from './InputHandler';
import { DEFAULT_GAME_CONFIG } from '@shared/constants';

// 用于插值的状态快照
interface StateSnapshot {
  state: GameState;
  timestamp: number;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: Renderer;
  private inputHandler: InputHandler;
  private networkClient: NetworkClient;

  private gameState: GameState | null = null;
  private previousState: StateSnapshot | null = null;
  private currentState: StateSnapshot | null = null;
  private isRunning = false;
  private lastFrameTime = 0;
  private animationFrameId: number | null = null;

  private localPlayerId: string | null = null;
  private gameStartTime = 0;

  constructor(canvas: HTMLCanvasElement, networkClient: NetworkClient) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(this.ctx, DEFAULT_GAME_CONFIG);
    this.inputHandler = new InputHandler();
    this.networkClient = networkClient;

    this.setupCanvas();
    this.setupInputHandlers();
  }

  private setupCanvas(): void {
    const { gridWidth, gridHeight, cellSize } = DEFAULT_GAME_CONFIG;
    this.canvas.width = gridWidth * cellSize;
    this.canvas.height = gridHeight * cellSize;
  }

  private setupInputHandlers(): void {
    this.inputHandler.onDirectionChange((direction: Direction) => {
      if (this.localPlayerId && this.gameState) {
        const mySnake = this.gameState.snakes.find(s => s.playerId === this.localPlayerId);
        if (mySnake && mySnake.isAlive) {
          this.networkClient.sendInput({
            direction,
            timestamp: Date.now(),
          });
        }
      }
    });
  }

  setLocalPlayerId(playerId: string): void {
    this.localPlayerId = playerId;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.gameStartTime = Date.now();
    this.lastFrameTime = performance.now();

    this.inputHandler.enable();
    this.gameLoop();
  }

  stop(): void {
    this.isRunning = false;
    this.inputHandler.disable();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  reset(): void {
    this.stop();
    this.gameState = null;
    // 不清除 localPlayerId，保持玩家身份
    this.renderer.clear();
  }

  updateState(state: GameState): void {
    // 检查本地蛇的方向是否需要同步（复活后方向可能改变）
    if (this.localPlayerId) {
      const mySnake = state.snakes.find(s => s.playerId === this.localPlayerId);
      if (mySnake && mySnake.isAlive) {
        // 同步客户端方向状态，防止复活后方向不同步导致输入被阻止
        this.inputHandler.setCurrentDirection(mySnake.direction);
      }
    }

    // 保存状态快照用于插值
    const now = performance.now();
    this.previousState = this.currentState;
    this.currentState = { state, timestamp: now };
    this.gameState = state;
    this.updateHUD();
  }

  private gameLoop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  private update(_deltaTime: number): void {
    // 更新 HUD 时间
    if (this.gameState && this.gameState.isRunning) {
      const elapsed = Date.now() - this.gameStartTime;
      this.updateHUDTime(elapsed);
    }
  }

  private render(): void {
    if (!this.gameState) {
      this.renderer.renderWaiting();
      return;
    }

    // 使用插值状态渲染
    const interpolatedState = this.getInterpolatedState();
    this.renderer.render(interpolatedState, this.localPlayerId);
  }

  /**
   * 获取插值后的游戏状态
   */
  private getInterpolatedState(): GameState {
    if (!this.gameState) {
      return this.gameState!;
    }

    // 如果没有前一个状态，直接返回当前状态
    if (!this.previousState || !this.currentState) {
      return this.gameState;
    }

    const now = performance.now();
    const renderTime = now - this.currentState.timestamp;
    const tickInterval = this.currentState.state.tick - this.previousState.state.tick > 0
      ? this.currentState.timestamp - this.previousState.timestamp
      : DEFAULT_GAME_CONFIG.gameSpeed;

    // 计算插值进度 (0-1)，限制最大值为1避免过度预测
    const alpha = Math.min(1, renderTime / tickInterval);

    // 如果状态差异太大（可能是重新开始或大量变化），跳过插值
    if (Math.abs(this.currentState.state.tick - this.previousState.state.tick) > 5) {
      return this.gameState;
    }

    // 对每条蛇进行插值
    const interpolatedSnakes = this.gameState.snakes.map(snake => {
      const prevSnake = this.previousState!.state.snakes.find(s => s.id === snake.id);

      // 如果没有前一个状态或蛇刚复活，不插值
      if (!prevSnake || !prevSnake.isAlive || !snake.isAlive) {
        return snake;
      }

      // 如果蛇身长度变化太大，不插值
      if (Math.abs(prevSnake.segments.length - snake.segments.length) > 2) {
        return snake;
      }

      // 插值每个身体段
      const interpolatedSegments = snake.segments.map((segment, index) => {
        const prevSegment = prevSnake.segments[index];

        if (!prevSegment) {
          return segment;
        }

        return {
          position: {
            x: prevSegment.position.x + (segment.position.x - prevSegment.position.x) * alpha,
            y: prevSegment.position.y + (segment.position.y - prevSegment.position.y) * alpha,
          },
        };
      });

      return {
        ...snake,
        segments: interpolatedSegments,
      };
    });

    return {
      ...this.gameState,
      snakes: interpolatedSnakes,
    };
  }

  private updateHUD(): void {
    if (!this.gameState) return;

    // 更新分数排行榜
    this.updateScoreList();

    // 更新玩家道具属性
    if (this.localPlayerId) {
      const mySnake = this.gameState.snakes.find((s: SnakeState) => s.playerId === this.localPlayerId);
      if (mySnake) {
        this.updatePlayerAttributes(mySnake);

        // 更新复活倒计时显示
        if (mySnake.respawnTime) {
          // 本地玩家正在等待复活
        }
      }
    }
  }

  private updatePlayerAttributes(snake: SnakeState): void {
    const speedBoostEl = document.getElementById('attr-speed-boost');
    const speedSlowEl = document.getElementById('attr-speed-slow');
    const wallPassEl = document.getElementById('attr-wall-pass');
    const invincibleEl = document.getElementById('attr-invincible');
    const magnetEl = document.getElementById('attr-magnet');

    if (speedBoostEl) speedBoostEl.textContent = String(snake.speedBoostCount || 0);
    if (speedSlowEl) speedSlowEl.textContent = String(snake.speedSlowCount || 0);
    if (wallPassEl) wallPassEl.textContent = String(snake.wallPassCount || 0);
    if (invincibleEl) invincibleEl.textContent = String(snake.invincibleCount || 0);
    if (magnetEl) magnetEl.textContent = String(snake.magnetCount || 0);
  }

  private updateScoreList(): void {
    const scoreListElement = document.getElementById('score-list');
    if (!scoreListElement || !this.gameState) return;

    // 按分数排序蛇
    const sortedSnakes = [...this.gameState.snakes].sort((a, b) => b.score - a.score);

    scoreListElement.innerHTML = sortedSnakes.map((snake, index) => {
      const isLocal = snake.playerId === this.localPlayerId;
      const isDead = !snake.isAlive;
      const rank = index + 1;
      const maxLength = snake.maxLength || snake.segments.length;

      return `
        <div class="score-item ${isLocal ? 'local-player' : ''} ${isDead ? 'dead' : ''}">
          <span class="score-rank">#${rank}</span>
          <span class="score-color" style="background: ${snake.color}"></span>
          <span class="score-name">${snake.playerName || (isLocal ? '你' : `玩家${rank}`)}</span>
          <span class="score-value">${snake.score} <span style="font-size:0.7em;color:rgba(255,255,255,0.5)">(${maxLength})</span></span>
        </div>
      `;
    }).join('');
  }

  private updateHUDTime(elapsed: number): void {
    const timeElement = document.getElementById('hud-time');
    if (timeElement) {
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      timeElement.textContent =
        `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }
}
