import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events';
import type { Socket } from 'socket.io';
import type { PlayerManager } from '../core/PlayerManager';
import type { RoomManager } from '../core/RoomManager';
import type { Database } from '../persistence/Database';
import { compressGameState } from '@shared/utils/stateCompression';

export class SocketHandler {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private playerManager: PlayerManager;
  private roomManager: RoomManager;
  private db: Database;
  private socketPlayerMap: Map<string, string> = new Map(); // socketId -> playerId
  private gameIntervals: Map<string, NodeJS.Timeout> = new Map(); // roomId -> interval

  constructor(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    playerManager: PlayerManager,
    roomManager: RoomManager,
    db: Database
  ) {
    this.io = io;
    this.playerManager = playerManager;
    this.roomManager = roomManager;
    this.db = db;
  }

  setup(): void {
    this.io.on('connection', (socket) => {
      console.log(`客户端连接: ${socket.id}`);

      // 玩家加入
      socket.on('player:join', (data) => {
        this.handlePlayerJoin(socket, data.name);
      });

      // 玩家离开
      socket.on('player:leave', () => {
        this.handlePlayerLeave(socket);
      });

      // 创建房间
      socket.on('room:create', (data) => {
        this.handleCreateRoom(socket, data.name, data.password, data.config);
      });

      // 加入房间
      socket.on('room:join', (data) => {
        this.handleJoinRoom(socket, data.roomId, data.password);
      });

      // 离开房间
      socket.on('room:leave', () => {
        this.handleLeaveRoom(socket);
      });

      // 获取房间列表
      socket.on('room:list', () => {
        this.handleRoomList(socket);
      });

      // 开始游戏
      socket.on('game:start', () => {
        this.handleStartGame(socket);
      });

      // 游戏输入
      socket.on('game:input', (data) => {
        this.handleGameInput(socket, data);
      });

      // 准备
      socket.on('game:ready', () => {
        this.handleGameReady(socket);
      });

      // 暂停/继续
      socket.on('game:pause', () => {
        this.handleGamePause(socket);
      });

      // 获取排行榜
      socket.on('leaderboard:get', (data) => {
        this.handleGetLeaderboard(socket, data?.limit);
      });

      // 延时测量
      socket.on('ping', (data) => {
        socket.emit('pong', { timestamp: data.timestamp });
      });

      // 断开连接
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private handlePlayerJoin(socket: Socket<ClientToServerEvents, ServerToClientEvents>, name: string): void {
    const trimmedName = name.trim();

    if (!trimmedName || trimmedName.length < 2) {
      socket.emit('player:error', { message: '名称至少需要2个字符' });
      return;
    }

    if (trimmedName.length > 12) {
      socket.emit('player:error', { message: '名称不能超过12个字符' });
      return;
    }

    // 检查该 socket 是否已经有关联的玩家（防止重复登录）
    const existingPlayerId = this.socketPlayerMap.get(socket.id);
    if (existingPlayerId) {
      // 清理旧的玩家实例
      const existingPlayer = this.playerManager.getPlayer(existingPlayerId);
      if (existingPlayer?.currentRoomId) {
        const roomId = existingPlayer.currentRoomId;
        this.roomManager.leaveRoom(roomId, existingPlayerId);
        socket.leave(roomId);
        socket.to(roomId).emit('room:player_left', { playerId: existingPlayerId });
        // 更新房间状态
        const roomState = this.roomManager.getRoomState(roomId);
        if (roomState) {
          this.io.to(roomId).emit('room:updated', { room: roomState });
        }
      }
      this.playerManager.removePlayer(existingPlayerId);
      this.socketPlayerMap.delete(socket.id);
    }

    // 原子操作：检查名称并创建玩家（防止竞态条件）
    const player = this.playerManager.createPlayerIfNameAvailable(trimmedName, socket.id);
    if (!player) {
      socket.emit('player:error', { message: '该名称已被使用' });
      return;
    }

    this.socketPlayerMap.set(socket.id, player.id);

    socket.emit('player:joined', { player });
    console.log(`玩家加入: ${player.name} (${player.id})`);
  }

  private handlePlayerLeave(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    const playerId = this.socketPlayerMap.get(socket.id);
    if (!playerId) return;

    // 离开房间
    this.handleLeaveRoom(socket);

    // 移除玩家
    this.playerManager.removePlayer(playerId);
    this.socketPlayerMap.delete(socket.id);

    socket.emit('player:left', { playerId });
    console.log(`玩家离开: ${playerId}`);
  }

  private handleCreateRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    name: string,
    password?: string,
    config?: any
  ): void {
    const playerId = this.socketPlayerMap.get(socket.id);
    if (!playerId) {
      socket.emit('room:error', { message: '请先登录' });
      return;
    }

    const player = this.playerManager.getPlayer(playerId);
    const roomInfo = this.roomManager.createRoom(playerId, name, password, config);

    // 自动加入房间
    this.roomManager.joinRoom(roomInfo.id, playerId, password, player?.name);
    this.playerManager.setPlayerRoom(playerId, roomInfo.id);
    socket.join(roomInfo.id);

    const roomState = this.roomManager.getRoomState(roomInfo.id);
    const players = this.playerManager.getPlayersByRoom(roomInfo.id);

    socket.emit('room:created', { room: roomInfo });
    socket.emit('room:joined', { room: roomState!, players });

    console.log(`房间创建: ${roomInfo.name} (${roomInfo.id})`);
  }

  private handleJoinRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    roomId: string,
    password?: string
  ): void {
    const playerId = this.socketPlayerMap.get(socket.id);
    if (!playerId) {
      socket.emit('room:error', { message: '请先登录' });
      return;
    }

    const player = this.playerManager.getPlayer(playerId);
    const result = this.roomManager.joinRoom(roomId, playerId, password, player?.name);
    if (!result.success) {
      socket.emit('room:error', { message: result.error || '加入失败' });
      return;
    }

    this.playerManager.setPlayerRoom(playerId, roomId);
    socket.join(roomId);

    const roomState = this.roomManager.getRoomState(roomId);
    const players = this.playerManager.getPlayersByRoom(roomId);
    const gameRoom = this.roomManager.getRoom(roomId);

    socket.emit('room:joined', { room: roomState!, players });

    // 如果游戏正在进行，立即发送游戏状态并通知开始游戏
    if (gameRoom && gameRoom.info.status === 'playing' && gameRoom.gameState) {
      socket.emit('game:started');
      socket.emit('game:state', {
        state: gameRoom.gameState,
        timestamp: Date.now(),
      });
    }

    // 通知房间内其他人
    if (player) {
      socket.to(roomId).emit('room:player_joined', { player });
    }

    console.log(`玩家 ${player?.name} 加入房间 ${roomId}`);
  }

  private handleLeaveRoom(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    const playerId = this.socketPlayerMap.get(socket.id);
    if (!playerId) return;

    const player = this.playerManager.getPlayer(playerId);
    const roomId = player?.currentRoomId;

    if (roomId) {
      this.roomManager.leaveRoom(roomId, playerId);
      this.playerManager.setPlayerRoom(playerId, null);
      socket.leave(roomId);

      // 通知房间内其他人
      socket.to(roomId).emit('room:player_left', { playerId });

      // 更新房间状态
      const roomState = this.roomManager.getRoomState(roomId);
      if (roomState) {
        this.io.to(roomId).emit('room:updated', { room: roomState });
      }
    }

    socket.emit('room:left');
  }

  private handleRoomList(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    const rooms = this.roomManager.getRoomList();
    socket.emit('room:list', { rooms });
  }

  private handleStartGame(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    const playerId = this.socketPlayerMap.get(socket.id);
    if (!playerId) return;

    const player = this.playerManager.getPlayer(playerId);
    const roomId = player?.currentRoomId;

    if (!roomId) {
      socket.emit('room:error', { message: '不在房间中' });
      return;
    }

    const roomInfo = this.roomManager.getRoomInfo(roomId);
    if (!roomInfo || roomInfo.hostId !== playerId) {
      socket.emit('room:error', { message: '只有房主可以开始游戏' });
      return;
    }

    const gameRoom = this.roomManager.getRoom(roomId);
    if (!gameRoom) return;

    // 开始游戏
    gameRoom.startGame();

    // 通知所有玩家游戏开始
    this.io.to(roomId).emit('game:started');

    // 状态广播优化：每10帧发送一次完整状态，其余发送压缩状态
    const FULL_SYNC_INTERVAL = 10; // 每10帧完整同步一次（约500ms）
    let tickCount = 0;

    const interval = setInterval(() => {
      if (gameRoom.gameState) {
        const timestamp = Date.now();
        tickCount++;

        // 每 N 帧发送完整状态，其余发送压缩状态
        if (tickCount % FULL_SYNC_INTERVAL === 0) {
          // 发送完整状态
          this.io.to(roomId).emit('game:state', {
            state: gameRoom.gameState,
            timestamp,
          });
        } else {
          // 发送压缩状态
          const compressed = compressGameState(gameRoom.gameState, timestamp);
          this.io.to(roomId).emit('game:compressed_state', {
            compressed,
            timestamp,
          });
        }

        // 检查游戏是否结束
        if (!gameRoom.gameState.isRunning) {
          const results = gameRoom.getGameResults();
          this.io.to(roomId).emit('game:ended', { results });

          // 保存排行榜
          results.forEach(r => {
            this.db.addLeaderboardEntry(r);
          });

          clearInterval(interval);
          this.gameIntervals.delete(roomId);
        }
      }
    }, 50); // 20 Hz

    this.gameIntervals.set(roomId, interval);
  }

  private handleGameInput(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    input: any
  ): void {
    const playerId = this.socketPlayerMap.get(socket.id);
    if (!playerId) return;

    const player = this.playerManager.getPlayer(playerId);
    const roomId = player?.currentRoomId;

    if (!roomId) return;

    const gameRoom = this.roomManager.getRoom(roomId);
    if (!gameRoom || !gameRoom.gameState?.isRunning) return;

    gameRoom.handleInput(playerId, input);

    // 确认输入
    socket.emit('game:input_ack', {
      tick: gameRoom.gameState.tick,
      direction: input.direction,
    });
  }

  private handleGameReady(_socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    // 可以用于同步所有玩家准备状态
  }

  private handleGamePause(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    const playerId = this.socketPlayerMap.get(socket.id);
    if (!playerId) return;

    const player = this.playerManager.getPlayer(playerId);
    const roomId = player?.currentRoomId;

    if (!roomId) return;

    const gameRoom = this.roomManager.getRoom(roomId);
    if (!gameRoom || !gameRoom.gameState?.isRunning) return;

    const isPaused = gameRoom.togglePause(playerId);

    // 通知玩家暂停状态变化
    socket.emit('game:pause_changed', { isPaused });
  }

  private handleGetLeaderboard(socket: Socket<ClientToServerEvents, ServerToClientEvents>, limit?: number): void {
    const entries = this.db.getLeaderboard(limit || 10);
    socket.emit('leaderboard:data', { entries });
  }

  private handleDisconnect(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    const playerId = this.socketPlayerMap.get(socket.id);
    console.log(`客户端断开: ${socket.id}`);

    if (playerId) {
      // 离开房间
      const player = this.playerManager.getPlayer(playerId);
      const roomId = player?.currentRoomId;

      if (roomId) {
        this.roomManager.leaveRoom(roomId, playerId);
        socket.leave(roomId);
        socket.to(roomId).emit('room:player_left', { playerId });

        // 更新房间状态
        const roomState = this.roomManager.getRoomState(roomId);
        if (roomState) {
          this.io.to(roomId).emit('room:updated', { room: roomState });
        }
      }

      // 移除玩家
      this.playerManager.removePlayer(playerId);
      this.socketPlayerMap.delete(socket.id);
    }
  }
}
