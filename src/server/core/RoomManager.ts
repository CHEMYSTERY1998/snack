import type { RoomInfo, RoomState, RoomConfig } from '@shared/types/room';
import type { Database } from '../persistence/Database';
import { generateRoomCode } from '@shared/utils';
import { DEFAULT_GAME_CONFIG } from '@shared/constants';
import { GameRoom } from '../game/GameRoom';

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private _db: Database;

  constructor(db: Database) {
    this._db = db;
  }

  createRoom(hostId: string, name: string, password?: string, config?: Partial<RoomConfig>): RoomInfo {
    const roomId = generateRoomCode();
    const roomConfig: RoomConfig = {
      maxPlayers: config?.maxPlayers ?? DEFAULT_GAME_CONFIG.maxPlayers,
      gameSpeed: config?.gameSpeed ?? DEFAULT_GAME_CONFIG.gameSpeed,
      hasPassword: !!password,
      mapWidth: config?.mapWidth ?? DEFAULT_GAME_CONFIG.gridWidth,
      mapHeight: config?.mapHeight ?? DEFAULT_GAME_CONFIG.gridHeight,
    };

    const roomInfo: RoomInfo = {
      id: roomId,
      name: name.trim().substring(0, 20),
      hostId,
      status: 'waiting',
      playerCount: 0,
      maxPlayers: roomConfig.maxPlayers,
      hasPassword: !!password,
      createdAt: Date.now(),
    };

    const gameRoom = new GameRoom(roomInfo, roomConfig, password);
    this.rooms.set(roomId, gameRoom);

    return roomInfo;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  getRoomInfo(roomId: string): RoomInfo | undefined {
    return this.rooms.get(roomId)?.info;
  }

  getRoomState(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId)?.state;
  }

  joinRoom(roomId: string, playerId: string, password?: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: '房间不存在' };
    }

    if (room.info.status !== 'waiting') {
      return { success: false, error: '游戏已开始' };
    }

    if (room.info.hasPassword && room.password !== password) {
      return { success: false, error: '密码错误' };
    }

    if (room.info.playerCount >= room.info.maxPlayers) {
      return { success: false, error: '房间已满' };
    }

    room.addPlayer(playerId);
    return { success: true };
  }

  leaveRoom(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.removePlayer(playerId);

    // 如果房间空了，删除房间
    if (room.info.playerCount === 0) {
      this.rooms.delete(roomId);
    } else if (room.info.hostId === playerId) {
      // 如果房主离开，转移房主
      const remainingPlayers = room.playerIds;
      if (remainingPlayers.length > 0) {
        room.info.hostId = remainingPlayers[0];
      }
    }
  }

  getRoomList(): RoomInfo[] {
    return Array.from(this.rooms.values())
      .filter(room => room.info.status === 'waiting') // 只显示等待中的房间
      .map(room => room.info);
  }

  updateRoomConfig(roomId: string, config: Partial<RoomConfig>): void {
    const room = this.rooms.get(roomId);
    if (room) {
      Object.assign(room.config, config);
      room.info.maxPlayers = room.config.maxPlayers;
    }
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}
