import type { RoomInfo, PlayerInfo, GameResult } from '@shared/types';

type UIEventCallback<T = unknown> = (data: T) => void;

export class UIManager {
  private playerInfo: PlayerInfo | null = null;
  private currentRoomInfo: RoomInfo | null = null;
  private eventListeners: Map<string, Set<UIEventCallback>> = new Map();

  constructor() {
    this.setupDOMListeners();
  }

  private setupDOMListeners(): void {
    // 登录按钮
    const btnJoin = document.getElementById('btn-join');
    const playerNameInput = document.getElementById('player-name') as HTMLInputElement;

    btnJoin?.addEventListener('click', () => {
      const name = playerNameInput?.value.trim();
      if (name && name.length >= 2) {
        this.emit('login', name);
      } else {
        this.showError('login', '请输入至少2个字符的名称');
      }
    });

    playerNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnJoin?.click();
      }
    });

    // 创建房间按钮
    const btnCreateRoom = document.getElementById('btn-create-room');
    btnCreateRoom?.addEventListener('click', () => {
      const roomName = `${this.playerInfo?.name || 'Player'}的房间`;
      this.emit('createRoom', roomName);
    });

    // 刷新房间列表
    const btnRefreshRooms = document.getElementById('btn-refresh-rooms');
    btnRefreshRooms?.addEventListener('click', () => {
      this.emit('refreshRooms', null);
    });

    // 离开房间
    const btnLeaveRoom = document.getElementById('btn-leave-room');
    btnLeaveRoom?.addEventListener('click', () => {
      this.emit('leaveRoom', null);
    });

    // 开始游戏
    const btnStartGame = document.getElementById('btn-start-game');
    btnStartGame?.addEventListener('click', () => {
      this.emit('startGame', null);
    });

    // 返回大厅
    const btnBackLobby = document.getElementById('btn-back-lobby');
    btnBackLobby?.addEventListener('click', () => {
      this.emit('backToLobby', null);
    });

    // 退出登录
    const btnLogout = document.getElementById('btn-logout');
    btnLogout?.addEventListener('click', () => {
      this.emit('logout', null);
    });

    // 暂停按钮
    const btnPause = document.getElementById('btn-pause');
    btnPause?.addEventListener('click', () => {
      this.emit('togglePause', null);
    });

    // 键盘暂停 (P键)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        // 只在游戏界面响应
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen && !gameScreen.classList.contains('hidden')) {
          this.emit('togglePause', null);
        }
      }
    });
  }

  // 事件系统
  on<T = unknown>(event: string, callback: UIEventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback as UIEventCallback);
  }

  off(event: string, callback: UIEventCallback): void {
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

  // 屏幕管理
  showScreen(screen: string): void {
    const screens = ['login', 'lobby', 'room', 'game', 'gameover'];
    screens.forEach(s => {
      const element = document.getElementById(`${s}-screen`);
      if (element) {
        element.classList.toggle('hidden', s !== screen);
      }
    });
  }

  showError(screen: string, message: string): void {
    const errorElement = document.getElementById(`${screen}-error`);
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
      setTimeout(() => {
        errorElement.classList.add('hidden');
      }, 3000);
    } else {
      // 通用错误提示
      alert(message);
    }
  }

  // 玩家信息
  setPlayerInfo(player: PlayerInfo): void {
    this.playerInfo = player;
  }

  // 房间信息
  setRoomInfo(room: RoomInfo): void {
    this.currentRoomInfo = room;
    const titleElement = document.getElementById('room-title');
    if (titleElement) {
      titleElement.textContent = room.name;
    }

    // 更新开始游戏按钮状态
    const startButton = document.getElementById('btn-start-game');
    if (startButton) {
      const isHost = this.playerInfo?.id === room.hostId;
      startButton.classList.toggle('hidden', !isHost);
    }
  }

  // 房间列表
  updateRoomList(rooms: RoomInfo[]): void {
    const roomListElement = document.getElementById('room-list');
    if (!roomListElement) return;

    if (rooms.length === 0) {
      roomListElement.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">暂无可加入的房间</div>';
      return;
    }

    roomListElement.innerHTML = rooms.map(room => `
      <div class="room-item" data-room-id="${room.id}">
        <div class="room-info">
          <span class="room-name">${room.name}</span>
          <span class="room-meta">${room.playerCount}/${room.maxPlayers} 玩家${room.hasPassword ? ' 🔒' : ''}</span>
        </div>
        <span class="room-status ${room.status}">${this.getStatusText(room.status)}</span>
      </div>
    `).join('');

    // 绑定点击事件
    roomListElement.querySelectorAll('.room-item').forEach(item => {
      item.addEventListener('click', () => {
        const roomId = (item as HTMLElement).dataset.roomId;
        if (roomId) {
          this.emit('joinRoom', roomId);
        }
      });
    });
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'waiting': return '等待中';
      case 'playing': return '游戏中';
      case 'finished': return '已结束';
      default: return status;
    }
  }

  // 玩家列表
  updatePlayerList(players: PlayerInfo[]): void {
    const playerListElement = document.getElementById('player-list');
    if (!playerListElement) return;

    playerListElement.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="margin-bottom: 8px; font-size: 0.9rem; color: rgba(255,255,255,0.8);">玩家列表 (${players.length})</h3>
        ${players.map(p => `
          <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 4px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${p.color};"></div>
            <span>${p.name}${p.id === this.currentRoomInfo?.hostId ? ' (房主)' : ''}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  addPlayerToList(_player: PlayerInfo): void {
    // 重新请求房间信息
    this.emit('refreshRooms', null);
  }

  removePlayerFromList(_playerId: string): void {
    this.emit('refreshRooms', null);
  }

  // 游戏结束
  showGameOver(results: GameResult[]): void {
    this.showScreen('gameover');

    const resultsElement = document.getElementById('game-results');
    if (!resultsElement) return;

    resultsElement.innerHTML = `
      <h2 style="text-align: center; margin-bottom: 16px;">游戏结束</h2>
      <div style="margin-bottom: 16px;">
        ${results.map((r, i) => `
          <div style="display: flex; justify-content: space-between; padding: 12px; background: ${i === 0 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)'}; border-radius: 8px; margin-bottom: 8px;">
            <div>
              <span style="font-weight: bold;">#${r.rank} ${r.playerName}</span>
              ${i === 0 ? ' 👑' : ''}
            </div>
            <div style="text-align: right;">
              <div>分数: ${r.score}</div>
              <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6);">击杀: ${r.killCount}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 延时显示
  updateLatency(latency: number): void {
    const indicator = document.getElementById('latency-indicator');
    const valueElement = document.getElementById('latency-value');
    if (!indicator || !valueElement) return;

    indicator.classList.remove('hidden', 'good', 'medium', 'bad');

    let status: 'good' | 'medium' | 'bad';
    if (latency < 100) {
      status = 'good';
    } else if (latency < 200) {
      status = 'medium';
    } else {
      status = 'bad';
    }

    indicator.classList.add(status);
    valueElement.textContent = `${latency} ms`;
  }

  hideLatency(): void {
    const indicator = document.getElementById('latency-indicator');
    indicator?.classList.add('hidden');
  }

  showLatency(): void {
    const indicator = document.getElementById('latency-indicator');
    indicator?.classList.remove('hidden');
  }

  // 暂停遮罩
  showPauseOverlay(): void {
    const overlay = document.getElementById('pause-overlay');
    overlay?.classList.remove('hidden');

    // 更新暂停按钮状态
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.textContent = '继续';
      btnPause.classList.add('paused');
    }
  }

  hidePauseOverlay(): void {
    const overlay = document.getElementById('pause-overlay');
    overlay?.classList.add('hidden');

    // 更新暂停按钮状态
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.textContent = '暂停';
      btnPause.classList.remove('paused');
    }
  }

  // 游戏消息
  private lastMessageCount = 0;
  private messageTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  updateGameMessages(messages: string[]): void {
    const container = document.getElementById('game-messages');
    if (!container) return;

    // 计算新消息数量（处理服务器裁剪旧消息的情况）
    // 服务器最多保留5条消息，如果新消息比上次多，说明有新消息
    // 如果数量相同或更少，可能是服务器重启或重置，需要检查最后一条消息
    let newMessageCount = 0;

    if (messages.length > this.lastMessageCount) {
      // 明显有新消息
      newMessageCount = messages.length - this.lastMessageCount;
    } else if (messages.length > 0 && messages.length <= this.lastMessageCount) {
      // 检查是否有新消息添加（服务器可能裁剪了旧消息）
      // 通过比较最后几条消息来判断
      const recentMessages = messages.slice(-Math.min(messages.length, 3));
      const lastKnownMessage = this.lastMessageCount > 0 ?
        this.lastDisplayedMessages[this.lastDisplayedMessages.length - 1] : null;

      if (lastKnownMessage && !recentMessages.includes(lastKnownMessage)) {
        // 服务器消息列表已被重置或大幅更新，显示最新的消息
        newMessageCount = 1; // 只显示最新一条
      }
    }

    if (newMessageCount === 0) {
      this.lastMessageCount = messages.length;
      return;
    }

    // 记录当前显示的消息
    this.lastDisplayedMessages = [...messages];
    this.lastMessageCount = messages.length;

    // 显示消息容器
    container.classList.remove('hidden');

    // 显示新消息（从最新的newMessageCount条）
    const newMessages = messages.slice(-newMessageCount);

    newMessages.forEach((msg, index) => {
      const timeoutId = setTimeout(() => {
        this.messageTimeouts.delete(timeoutId);

        const msgElement = document.createElement('div');
        msgElement.className = 'game-message';
        msgElement.textContent = msg;
        container.appendChild(msgElement);

        // 5秒后移除
        const fadeTimeoutId = setTimeout(() => {
          this.messageTimeouts.delete(fadeTimeoutId);
          msgElement.style.opacity = '0';
          msgElement.style.transition = 'opacity 0.5s';
          const removeTimeoutId = setTimeout(() => {
            this.messageTimeouts.delete(removeTimeoutId);
            msgElement.remove();
          }, 500);
          this.messageTimeouts.add(removeTimeoutId);
        }, 5000);
        this.messageTimeouts.add(fadeTimeoutId);
      }, index * 300); // 错开显示时间
      this.messageTimeouts.add(timeoutId);
    });
  }

  private lastDisplayedMessages: string[] = [];

  clearGameMessages(): void {
    // 清除所有待处理的定时器
    this.messageTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.messageTimeouts.clear();

    const container = document.getElementById('game-messages');
    if (container) {
      container.innerHTML = '';
      container.classList.add('hidden');
    }
    this.lastMessageCount = 0;
    this.lastDisplayedMessages = [];
  }
}
