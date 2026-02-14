import { Game } from './core/Game';
import { NetworkClient } from './network/NetworkClient';
import { UIManager } from './ui/UIManager';
import type { PlayerInfo, RoomInfo, RoomState, GameState, GameResult } from '@shared/types';
import './styles/main.css';

// 全局状态
let game: Game | null = null;
let networkClient: NetworkClient | null = null;
let uiManager: UIManager | null = null;

// 初始化
async function init() {
  // 初始化 UI 管理器
  uiManager = new UIManager();

  // 初始化网络客户端
  networkClient = new NetworkClient();

  // 初始化游戏实例
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  game = new Game(canvas, networkClient);

  // 设置事件监听
  setupEventListeners();

  // 显示登录界面
  uiManager.showScreen('login');
}

// 设置事件监听
function setupEventListeners() {
  if (!uiManager || !networkClient || !game) return;

  // 登录
  uiManager.on('login', async (playerName: string) => {
    try {
      await networkClient!.connect();
      networkClient!.joinPlayer(playerName);
    } catch (error) {
      uiManager!.showError('login', '连接服务器失败');
    }
  });

  // 退出登录
  uiManager.on('logout', () => {
    networkClient!.disconnect();
    uiManager!.showScreen('login');
  });

  // 创建房间
  uiManager.on('createRoom', (roomName: string) => {
    networkClient!.createRoom(roomName);
  });

  // 加入房间
  uiManager.on('joinRoom', (roomId: string) => {
    networkClient!.joinRoom(roomId);
  });

  // 离开房间
  uiManager.on('leaveRoom', () => {
    networkClient!.leaveRoom();
  });

  // 开始游戏
  uiManager.on('startGame', () => {
    networkClient!.startGame();
  });

  // 返回大厅
  uiManager.on('backToLobby', () => {
    game!.reset();
    uiManager!.showScreen('lobby');
  });

  // 刷新房间列表
  uiManager.on('refreshRooms', () => {
    networkClient!.requestRoomList();
  });

  // 网络事件
  networkClient.on('player:joined', (data: { player: PlayerInfo }) => {
    uiManager!.setPlayerInfo(data.player);
    game!.setLocalPlayerId(data.player.id);
    uiManager!.showScreen('lobby');
  });

  networkClient.on('room:list', (data: { rooms: RoomInfo[] }) => {
    uiManager!.updateRoomList(data.rooms);
  });

  networkClient.on('room:created', (data: { room: RoomInfo }) => {
    uiManager!.showScreen('room');
    uiManager!.setRoomInfo(data.room);
  });

  networkClient.on('room:joined', (data: { room: RoomState; players: PlayerInfo[] }) => {
    uiManager!.showScreen('room');
    uiManager!.setRoomInfo(data.room.info);
    uiManager!.updatePlayerList(data.players);
  });

  networkClient.on('room:left', () => {
    uiManager!.showScreen('lobby');
  });

  networkClient.on('room:player_joined', (data: { player: PlayerInfo }) => {
    uiManager!.addPlayerToList(data.player);
  });

  networkClient.on('room:player_left', (data: { playerId: string }) => {
    uiManager!.removePlayerFromList(data.playerId);
  });

  networkClient.on('game:started', () => {
    uiManager!.showScreen('game');
    game!.start();
  });

  networkClient.on('game:state', (data: { state: GameState; timestamp: number }) => {
    game!.updateState(data.state);
  });

  networkClient.on('game:ended', (data: { results: GameResult[] }) => {
    game!.stop();
    uiManager!.showGameOver(data.results);
  });

  networkClient.on('error', (message: string) => {
    uiManager!.showError('generic', message);
  });
}

// 启动应用
init();
