import type { GameState, Direction, SnakeState } from '@shared/types/game';
import type { NetworkClient } from '../network/NetworkClient';
import { Renderer } from '../renderer/Renderer';
import { InputHandler } from './InputHandler';
import { DEFAULT_GAME_CONFIG } from '@shared/constants';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: Renderer;
  private inputHandler: InputHandler;
  private networkClient: NetworkClient;

  private gameState: GameState | null = null;
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

    this.renderer.render(this.gameState, this.localPlayerId);
  }

  private updateHUD(): void {
    if (!this.gameState) return;

    // 更新分数排行榜
    this.updateScoreList();

    // 更新复活倒计时显示
    if (this.localPlayerId) {
      const mySnake = this.gameState.snakes.find((s: SnakeState) => s.playerId === this.localPlayerId);
      if (mySnake && mySnake.respawnTime) {
        // 本地玩家正在等待复活
      }
    }
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
