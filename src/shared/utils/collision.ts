import type { Position, Direction } from '../types/game';
import { DIRECTION_VECTORS, OPPOSITE_DIRECTIONS } from '../constants';

// 检查两个位置是否相同
export function isSamePosition(pos1: Position, pos2: Position): boolean {
  return pos1.x === pos2.x && pos1.y === pos2.y;
}

// 检查位置是否在网格范围内
export function isWithinBounds(pos: Position, width: number, height: number): boolean {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}

// 计算两个位置之间的曼哈顿距离
export function manhattanDistance(pos1: Position, pos2: Position): number {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

// 获取方向的向量
export function getDirectionVector(direction: Direction): Position {
  return DIRECTION_VECTORS[direction];
}

// 获取相反方向
export function getOppositeDirection(direction: Direction): Direction {
  return OPPOSITE_DIRECTIONS[direction] as Direction;
}

// 检查是否是相反方向
export function isOppositeDirection(current: Direction, newDir: Direction): boolean {
  return OPPOSITE_DIRECTIONS[current] === newDir;
}

// 移动位置
export function movePosition(pos: Position, direction: Direction, gridWidth: number, gridHeight: number): Position {
  const vector = getDirectionVector(direction);
  return {
    x: (pos.x + vector.x + gridWidth) % gridWidth,
    y: (pos.y + vector.y + gridHeight) % gridHeight,
  };
}

// 移动位置（带边界检查，不穿墙）
export function movePositionWithBounds(
  pos: Position,
  direction: Direction,
  gridWidth: number,
  gridHeight: number
): Position | null {
  const vector = getDirectionVector(direction);
  const newX = pos.x + vector.x;
  const newY = pos.y + vector.y;

  if (newX < 0 || newX >= gridWidth || newY < 0 || newY >= gridHeight) {
    return null;
  }

  return { x: newX, y: newY };
}

// 生成随机位置
export function randomPosition(width: number, height: number): Position {
  return {
    x: Math.floor(Math.random() * width),
    y: Math.floor(Math.random() * height),
  };
}

// 检查位置是否被占用
export function isPositionOccupied(pos: Position, occupiedPositions: Position[]): boolean {
  return occupiedPositions.some(p => isSamePosition(p, pos));
}

// 生成未占用的随机位置
export function randomUnoccupiedPosition(
  width: number,
  height: number,
  occupiedPositions: Position[],
  maxAttempts: number = 100
): Position | null {
  for (let i = 0; i < maxAttempts; i++) {
    const pos = randomPosition(width, height);
    if (!isPositionOccupied(pos, occupiedPositions)) {
      return pos;
    }
  }
  return null;
}
