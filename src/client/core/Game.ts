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
    if (!this.gameState || !this.localPlayerId) return;

    const mySnake = this.gameState.snakes.find((s: SnakeState) => s.playerId === this.localPlayerId);
    if (!mySnake) return;

    const scoreElement = document.getElementById('hud-score');
    const lengthElement = document.getElementById('hud-length');

    if (scoreElement) {
      scoreElement.textContent = mySnake.score.toString();
    }
    if (lengthElement) {
      lengthElement.textContent = mySnake.segments.length.toString();
    }
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
