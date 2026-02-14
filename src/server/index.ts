import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { SocketHandler } from './network/SocketHandler';
import { RoomManager } from './core/RoomManager';
import { PlayerManager } from './core/PlayerManager';
import { Database } from './persistence/Database';
import { SERVER_PORT } from '@shared/constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  // 初始化数据库
  const db = new Database();
  await db.init();

  // 初始化管理器
  const playerManager = new PlayerManager();
  const roomManager = new RoomManager(db);

  // 创建 Express 应用
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  // 静态文件服务（生产环境）
  app.use(express.static(resolve(__dirname, '../../dist')));

  // API 路由
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Socket 处理
  const socketHandler = new SocketHandler(io, playerManager, roomManager, db);
  socketHandler.setup();

  // 启动服务器
  httpServer.listen(SERVER_PORT, () => {
    console.log(`🎮 贪吃蛇服务器已启动`);
    console.log(`📡 WebSocket: ws://localhost:${SERVER_PORT}`);
    console.log(`🌐 HTTP: http://localhost:${SERVER_PORT}`);
  });
}

main().catch(console.error);
