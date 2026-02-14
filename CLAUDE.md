# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

局域网多人联机贪吃蛇游戏（2-8人），使用 HTML5 Canvas + TypeScript + Socket.io 构建。

## 常用命令

```bash
# 开发模式（同时启动前后端）
npm run dev

# 分别启动
npm run dev:client   # 前端 http://localhost:5173
npm run dev:server   # 后端 ws://localhost:8080

# 生产构建
npm run build

# 运行测试
npm run test
```

## 架构

### 目录结构

```
src/
├── shared/          # 前后端共享代码（类型、常量、工具函数）
├── client/          # 浏览器客户端
│   ├── core/        # Game（游戏循环）、InputHandler
│   ├── network/     # NetworkClient（Socket.io 封装）
│   ├── renderer/    # Renderer（Canvas 渲染）
│   └── ui/          # UIManager
└── server/          # Node.js 服务端
    ├── core/        # PlayerManager、RoomManager
    ├── game/        # GameRoom（游戏逻辑、碰撞检测、道具系统）
    ├── network/     # SocketHandler
    └── persistence/ # Database（JSON 文件存储）
```

### 路径别名

- `@shared/*` → `src/shared/*`
- `@client/*` → `src/client/*`
- `@server/*` → `src/server/*`

### 核心数据流

1. **客户端输入** → `InputHandler` 捕获键盘 → `NetworkClient.sendInput()` 发送到服务器
2. **服务端处理** → `SocketHandler` 接收 → `GameRoom.handleInput()` 更新方向 → `tick()` 游戏循环更新状态
3. **状态同步** → `GameRoom.gameState` → 广播 `game:state` → 客户端 `Renderer.render()` 渲染

### Socket.io 事件

定义在 `src/shared/types/events.ts`：
- `ClientToServerEvents`: 客户端→服务器（player:join, room:create, game:input 等）
- `ServerToClientEvents`: 服务器→客户端（game:state, room:joined 等）

### 游戏状态

- `GameState`: 包含 tick、snakes、foods、powerUps
- `SnakeState`: 蛇的完整状态（segments、direction、effects、isAlive、respawnTime）
- 死亡后 3 秒自动复活，蛇身变为食物

### 配置

游戏参数在 `src/shared/constants/index.ts`：
- `SERVER_PORT`: 服务器端口（当前 8080）
- `DEFAULT_GAME_CONFIG`: 地图大小、游戏速度、道具持续时间等

## 注意事项

- Windows Hyper-V 可能保留端口 3000-5000，如遇 `EACCES` 错误需更换端口
- Vite 代理使用 `127.0.0.1` 而非 `localhost` 以避免 IPv6 解析问题

## 开发规范

- **分步提交**：完成一个功能后立即提交一次代码
- **代码审查**：每次修改后进行代码审核和检视
- **循环审核**：如果审查发现问题需要修改代码，修改后再次审查，直到没有问题为止
- **文档更新**：所有功能完成后更新 README 文档
