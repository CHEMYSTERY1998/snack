import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events';
import type { PlayerInput } from '@shared/types';

type EventCallback<T = unknown> = (data: T) => void;

export class NetworkClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private isConnected = false;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io('/', {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.setupEventHandlers();
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
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
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
      this.emit('game:state', data);
    });

    this.socket.on('game:started', () => {
      this.emit('game:started', {});
    });

    this.socket.on('game:ended', (data) => {
      this.emit('game:ended', data);
    });

    this.socket.on('game:input_ack', (data) => {
      this.emit('game:input_ack', data);
    });

    // 排行榜事件
    this.socket.on('leaderboard:data', (data) => {
      this.emit('leaderboard:data', data);
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

  // 排行榜 API
  requestLeaderboard(limit?: number): void {
    if (!this.socket) return;
    this.socket.emit('leaderboard:get', { limit });
  }

  // 状态
  get connected(): boolean {
    return this.isConnected;
  }
}
