import type { Direction } from '@shared/types/game';
import { isOppositeDirection } from '@shared/utils/collision';

type DirectionCallback = (direction: Direction) => void;

export class InputHandler {
  private enabled = false;
  private currentDirection: Direction = 'right';
  private callback: DirectionCallback | null = null;
  private boundKeyDownHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
  }

  onDirectionChange(callback: DirectionCallback): void {
    this.callback = callback;
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    window.addEventListener('keydown', this.boundKeyDownHandler);
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    window.removeEventListener('keydown', this.boundKeyDownHandler);
  }

  setCurrentDirection(direction: Direction): void {
    this.currentDirection = direction;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled || !this.callback) return;

    const newDirection = this.getDirectionFromKey(e.key);
    if (!newDirection) return;

    // 防止 180° 转向
    if (isOppositeDirection(this.currentDirection, newDirection)) {
      return;
    }

    // 相同方向不需要处理
    if (this.currentDirection === newDirection) {
      return;
    }

    this.currentDirection = newDirection;
    this.callback(newDirection);

    // 阻止默认行为（如页面滚动）
    e.preventDefault();
  }

  private getDirectionFromKey(key: string): Direction | null {
    const keyMap: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      W: 'up',
      s: 'down',
      S: 'down',
      a: 'left',
      A: 'left',
      d: 'right',
      D: 'right',
    };

    return keyMap[key] || null;
  }
}
