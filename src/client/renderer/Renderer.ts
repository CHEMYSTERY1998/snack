import type { GameConfig, GameState, SnakeState, FoodState, PowerUpState } from '@shared/types/game';
import { POWER_UP_ICONS } from '@shared/constants';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;
  private cellSize: number;

  constructor(ctx: CanvasRenderingContext2D, config: GameConfig) {
    this.ctx = ctx;
    this.config = config;
    this.cellSize = config.cellSize;
  }

  clear(): void {
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  renderWaiting(): void {
    this.clear();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.font = '24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('等待游戏开始...', this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
  }

  render(state: GameState, localPlayerId: string | null): void {
    this.clear();
    this.drawGrid();
    this.drawFoods(state.foods);
    this.drawPowerUps(state.powerUps);
    this.drawSnakes(state.snakes, localPlayerId);
  }

  private drawGrid(): void {
    const { gridWidth, gridHeight } = this.config;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;

    // 绘制垂直线
    for (let x = 0; x <= gridWidth; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.cellSize, 0);
      this.ctx.lineTo(x * this.cellSize, gridHeight * this.cellSize);
      this.ctx.stroke();
    }

    // 绘制水平线
    for (let y = 0; y <= gridHeight; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.cellSize);
      this.ctx.lineTo(gridWidth * this.cellSize, y * this.cellSize);
      this.ctx.stroke();
    }
  }

  private drawSnakes(snakes: SnakeState[], localPlayerId: string | null): void {
    // 先绘制其他蛇，再绘制本地玩家的蛇（确保在最上层）
    const sortedSnakes = [...snakes].sort((a, b) => {
      if (a.playerId === localPlayerId) return 1;
      if (b.playerId === localPlayerId) return -1;
      return 0;
    });

    for (const snake of sortedSnakes) {
      if (snake.isAlive) {
        this.drawSnake(snake, snake.playerId === localPlayerId);
      }
    }
  }

  private drawSnake(snake: SnakeState, isLocal: boolean): void {
    const { segments, color, effects } = snake;

    // 检查是否有无敌效果
    const hasInvincible = effects.some(e => e.type === 'invincible');

    segments.forEach((segment, index) => {
      const x = segment.position.x * this.cellSize;
      const y = segment.position.y * this.cellSize;
      const padding = 1;

      // 设置颜色
      if (index === 0) {
        // 蛇头
        this.ctx.fillStyle = this.lightenColor(color, 20);
      } else {
        this.ctx.fillStyle = color;
      }

      // 无敌效果 - 添加光环
      if (hasInvincible) {
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 10;
      }

      // 绘制圆角矩形
      this.roundRect(
        x + padding,
        y + padding,
        this.cellSize - padding * 2,
        this.cellSize - padding * 2,
        4
      );

      this.ctx.shadowBlur = 0;

      // 绘制蛇头眼睛
      if (index === 0) {
        this.drawSnakeHead(segment.position, snake.direction);
      }
    });

    // 如果是本地玩家，绘制边框高亮
    if (isLocal) {
      this.drawSnakeHighlight(snake);
    }
  }

  private drawSnakeHead(position: { x: number; y: number }, direction: string): void {
    const x = position.x * this.cellSize + this.cellSize / 2;
    const y = position.y * this.cellSize + this.cellSize / 2;
    const eyeSize = 3;
    const eyeOffset = 4;

    this.ctx.fillStyle = '#fff';

    // 根据方向绘制眼睛
    let eye1X, eye1Y, eye2X, eye2Y;

    switch (direction) {
      case 'up':
        eye1X = x - eyeOffset;
        eye1Y = y - 2;
        eye2X = x + eyeOffset;
        eye2Y = y - 2;
        break;
      case 'down':
        eye1X = x - eyeOffset;
        eye1Y = y + 2;
        eye2X = x + eyeOffset;
        eye2Y = y + 2;
        break;
      case 'left':
        eye1X = x - 2;
        eye1Y = y - eyeOffset;
        eye2X = x - 2;
        eye2Y = y + eyeOffset;
        break;
      case 'right':
      default:
        eye1X = x + 2;
        eye1Y = y - eyeOffset;
        eye2X = x + 2;
        eye2Y = y + eyeOffset;
        break;
    }

    this.ctx.beginPath();
    this.ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawSnakeHighlight(snake: SnakeState): void {
    // 在蛇周围绘制轻微的高亮效果
    const headPos = snake.segments[0].position;
    const x = headPos.x * this.cellSize;
    const y = headPos.y * this.cellSize;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 2;
    this.roundRect(x, y, this.cellSize, this.cellSize, 4, true);
  }

  private drawFoods(foods: FoodState[]): void {
    for (const food of foods) {
      const x = food.position.x * this.cellSize + this.cellSize / 2;
      const y = food.position.y * this.cellSize + this.cellSize / 2;
      const radius = (this.cellSize / 2) - 2;

      // 根据类型选择颜色
      const color = food.type === 'super' ? '#FFD700' : '#4ECDC4';

      // 绘制发光效果
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 8;

      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.shadowBlur = 0;
    }
  }

  private drawPowerUps(powerUps: PowerUpState[]): void {
    for (const powerUp of powerUps) {
      const x = powerUp.position.x * this.cellSize;
      const y = powerUp.position.y * this.cellSize;
      const icon = POWER_UP_ICONS[powerUp.type] || '?';

      // 背景光晕
      this.ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
      this.ctx.beginPath();
      this.ctx.arc(x + this.cellSize / 2, y + this.cellSize / 2, this.cellSize / 2, 0, Math.PI * 2);
      this.ctx.fill();

      // 绘制图标
      this.ctx.font = `${this.cellSize - 4}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(icon, x + this.cellSize / 2, y + this.cellSize / 2);
    }
  }

  private roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    strokeOnly = false
  ): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();

    if (strokeOnly) {
      this.ctx.stroke();
    } else {
      this.ctx.fill();
    }
  }

  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
  }
}
