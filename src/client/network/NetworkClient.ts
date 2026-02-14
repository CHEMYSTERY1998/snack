import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events';
import type { PlayerInput, GameState } from '@shared/types';
import type { CompressedGameState } from '@shared/types/delta';
import { decompressGameState } from '@shared/utils/stateCompression';

type EventCallback<T = unknown> = (data: T) => void;

export class NetworkClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private isConnected = false;
  private latency = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private previousGameState: GameState | null = null; // 用于解压缩

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io('/', {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.setupEventHandlers();
        this.startPingLoop();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        this.isConnected = false;
        reject(error);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.emit('disconnected', {});
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.stopPingLoop();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.previousGameState = null;
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // 玩家事件
    this.socket.on('player:joined', (data) => {
      this.emit('player:joined', data);
    });

    this.socket.on('player:left', (data) => {
      this.emit('player:left', data);
    });

    this.socket.on('player:error', (data) => {
      this.emit('error', data.message);
    });

    // 房间事件
    this.socket.on('room:created', (data) => {
      this.emit('room:created', data);
    });

    this.socket.on('room:joined', (data) => {
      this.emit('room:joined', data);
    });

    this.socket.on('room:left', () => {
      this.emit('room:left', {});
    });

    this.socket.on('room:list', (data) => {
      this.emit('room:list', data);
    });

    this.socket.on('room:player_joined', (data) => {
      this.emit('room:player_joined', data);
    });

    this.socket.on('room:player_left', (data) => {
      this.emit('room:player_left', data);
    });

    this.socket.on('room:updated', (data) => {
      this.emit('room:updated', data);
    });

    this.socket.on('room:error', (data) => {
      this.emit('error', data.message);
    });

    // 游戏事件
    this.socket.on('game:state', (data) => {
      this.previousGameState = data.state; // 保存用于解压缩
      this.emit('game:state', data);
    });

    this.socket.on('game:compressed_state', (data: { compressed: CompressedGameState; timestamp: number }) => {
      // 解压缩状态
      const state = decompressGameState(data.compressed, this.previousGameState || undefined);
      this.previousGameState = state;
      this.emit('game:state', { state, timestamp: data.timestamp });
    });

    this.socket.on('game:started', () => {
      this.emit('game:started', {});
    });

    this.socket.on('game:ended', (data) => {
      this.previousGameState = null; // 重置状态缓存
      this.emit('game:ended', data);
    });

    this.socket.on('game:pause_changed', (data) => {
      this.emit('game:pause_changed', data);
    });

    this.socket.on('game:input_ack', (data) => {
      this.emit('game:input_ack', data);
    });

    // 排行榜事件
    this.socket.on('leaderboard:data', (data) => {
      this.emit('leaderboard:data', data);
    });

    // 延时测量
    this.socket.on('pong', (data) => {
      this.latency = Math.round((Date.now() - data.timestamp) / 2);
      this.emit('latency', { latency: this.latency });
    });
  }

  // 事件订阅
  on<T = unknown>(event: string, callback: EventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback as EventCallback);
  }

  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // 玩家 API
  joinPlayer(name: string): void {
    if (!this.socket) return;
    this.socket.emit('player:join', { name });
  }

  leavePlayer(): void {
    if (!this.socket) return;
    this.socket.emit('player:leave');
  }

  // 房间 API
  createRoom(name: string, password?: string): void {
    if (!this.socket) return;
    this.socket.emit('room:create', { name, password });
  }

  joinRoom(roomId: string, password?: string): void {
    if (!this.socket) return;
    this.socket.emit('room:join', { roomId, password });
  }

  leaveRoom(): void {
    if (!this.socket) return;
    this.socket.emit('room:leave');
  }

  requestRoomList(): void {
    if (!this.socket) return;
    this.socket.emit('room:list');
  }

  // 游戏 API
  startGame(): void {
    if (!this.socket) return;
    this.socket.emit('game:start');
  }

  sendInput(input: PlayerInput): void {
    if (!this.socket) return;
    this.socket.emit('game:input', input);
  }

  ready(): void {
    if (!this.socket) return;
    this.socket.emit('game:ready');
  }

  togglePause(): void {
    if (!this.socket) return;
    this.socket.emit('game:pause');
  }

  // 排行榜 API
  requestLeaderboard(limit?: number): void {
    if (!this.socket) return;
    this.socket.emit('leaderboard:get', { limit });
  }

  // 状态
  get connected(): boolean {
    return this.isConnected;
  }

  get currentLatency(): number {
    return this.latency;
  }

  // 延时测量
  private startPingLoop(): void {
    this.stopPingLoop();
    // 每 2 秒发送一次 ping
    this.pingInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('ping', { timestamp: Date.now() });
      }
    }, 2000);
    // 立即发送一次
    if (this.socket && this.isConnected) {
      this.socket.emit('ping', { timestamp: Date.now() });
    }
  }

  private stopPingLoop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
