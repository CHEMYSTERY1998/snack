// 从 collision.ts 重新导出
export {
  isSamePosition,
  isWithinBounds,
  manhattanDistance,
  getDirectionVector,
  getOppositeDirection,
  isOppositeDirection,
  movePosition,
  movePositionWithBounds,
  randomPosition,
  isPositionOccupied,
  randomUnoccupiedPosition,
} from './collision';

// 生成唯一ID
export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// 生成房间代码（6位大写字母数字）
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 深拷贝对象
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// 限制数值在范围内
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// 线性插值
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// 格式化时间（毫秒转为 mm:ss）
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
