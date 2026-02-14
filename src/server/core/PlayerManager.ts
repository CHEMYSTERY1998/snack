import type { PlayerInfo, PlayerStatus } from '@shared/types/player';
import { generateId } from '@shared/utils';
import { PLAYER_COLORS } from '@shared/constants';

export class PlayerManager {
  private players: Map<string, PlayerInfo> = new Map();

  createPlayer(name: string, socketId: string): PlayerInfo {
    const player: PlayerInfo = {
      id: socketId || generateId(),
      name: name.trim().substring(0, 12),
      status: 'connected',
      currentRoomId: null,
      color: this.getNextColor(),
      connectedAt: Date.now(),
    };

    this.players.set(player.id, player);
    return player;
  }

  getPlayer(playerId: string): PlayerInfo | undefined {
    return this.players.get(playerId);
  }

  updatePlayer(playerId: string, updates: Partial<PlayerInfo>): PlayerInfo | undefined {
    const player = this.players.get(playerId);
    if (!player) return undefined;

    Object.assign(player, updates);
    return player;
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  setPlayerStatus(playerId: string, status: PlayerStatus): void {
    const player = this.players.get(playerId);
    if (player) {
      player.status = status;
    }
  }

  setPlayerRoom(playerId: string, roomId: string | null): void {
    const player = this.players.get(playerId);
    if (player) {
      player.currentRoomId = roomId;
      player.status = roomId ? 'inRoom' : 'connected';
    }
  }

  getPlayersByRoom(roomId: string): PlayerInfo[] {
    return Array.from(this.players.values()).filter(p => p.currentRoomId === roomId);
  }

  getAllPlayers(): PlayerInfo[] {
    return Array.from(this.players.values());
  }

  isNameExists(name: string): boolean {
    const normalizedName = name.trim().toLowerCase().substring(0, 12);
    return Array.from(this.players.values()).some(
      p => p.name.toLowerCase() === normalizedName
    );
  }

  /**
   * Atomically check if name exists and create player if not.
   * Returns the player if created, or null if name is already taken.
   * This prevents TOCTOU race conditions.
   */
  createPlayerIfNameAvailable(name: string, socketId: string): PlayerInfo | null {
    const normalizedName = name.trim().toLowerCase().substring(0, 12);

    // Check if name exists
    const nameExists = Array.from(this.players.values()).some(
      p => p.name.toLowerCase() === normalizedName
    );

    if (nameExists) {
      return null;
    }

    // Name is available, create the player
    return this.createPlayer(name, socketId);
  }

  private getNextColor(): string {
    const usedColors = new Set(Array.from(this.players.values()).map(p => p.color));
    for (const color of PLAYER_COLORS) {
      if (!usedColors.has(color)) {
        return color;
      }
    }
    // 如果所有颜色都用完了，随机选一个
    return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
  }
}
