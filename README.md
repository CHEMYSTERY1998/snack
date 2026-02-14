# 🐍 贪吃蛇联机对战

局域网多人联机贪吃蛇游戏，支持 2-8 人同时游戏。

## 功能特性

- 🎮 **多人对战**: 支持 2-8 人同时游戏，随时加入正在进行中的游戏
- 🏠 **房间系统**: 创建/加入房间，支持密码保护
- ⚡ **道具系统**: 加速、减速、穿墙、无敌、缩短对手（道具占据2x2格子）
- 🏆 **排行榜**: 自动记录游戏成绩，显示玩家名称和最长长度
- 🌐 **局域网部署**: 支持局域网内多设备访问
- 📡 **网络优化**: 增量状态压缩，减少50-70%网络流量

## 技术栈

- **前端**: HTML5 Canvas + TypeScript + Vite
- **后端**: Node.js + Socket.io
- **存储**: JSON 文件
- **网络优化**: 状态压缩传输，每10帧完整同步一次

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:client   # 客户端 http://localhost:5173
npm run dev:server   # 服务端 ws://localhost:8080
```

### 生产构建

```bash
npm run build
```

## 局域网部署

### 1. 获取本机 IP

**Windows:**
```bash
ipconfig
```
查找 "IPv4 地址"，例如 `192.168.1.100`

**Mac/Linux:**
```bash
ifconfig
# 或
ip addr
```

### 2. 启动服务器

```bash
npm run dev
```

### 3. 局域网访问

其他设备通过浏览器访问：
```
http://你的IP地址:5173
```

例如：`http://192.168.1.100:5173`

### 4. 防火墙设置

如果其他设备无法访问，需要开放端口：

**Windows 防火墙:**
```bash
# 管理员权限运行
netsh advfirewall firewall add rule name="Snake Game" dir=in action=allow protocol=tcp localport=5173
netsh advfirewall firewall add rule name="Snake Game" dir=in action=allow protocol=tcp localport=8080
```

**Linux (ufw):**
```bash
sudo ufw allow 5173
sudo ufw allow 8080
```

## 游戏操作

- **方向键** 或 **WASD**: 控制蛇的移动方向
- 吃到食物增加长度和分数
- 撞墙或撞到自己会死亡

## 道具说明

道具占据 2x2 格子，吃到道具后会有提示消息。

| 道具 | 图标 | 效果 | 类型 |
|------|------|------|------|
| 加速 | ⚡ | 移动速度 +50% | 永久（可叠加） |
| 减速 | 🐌 | 移动速度 -50% | 永久（可叠加） |
| 穿墙 | 👻 | 可穿越墙壁 | 次数（吃一个+1次） |
| 无敌 | 🛡️ | 免疫死亡 | 次数（吃一个+1次） |
| 缩短对手 | ✂️ | 随机缩短其他玩家 | 即时（公屏广播） |

## 游戏机制

- **出生保护**: 新出生/复活的蛇有1秒无敌时间
- **碰撞规则**: A碰到B的身体，A死亡，B不受影响
- **复活机制**: 死亡后等待3秒复活
- **穿墙使用**: 穿墙时自动消耗一次次数
- **无敌使用**: 受到致命伤害时自动消耗一次次数

## 项目结构

```
snack/
├── src/
│   ├── shared/          # 前后端共享代码
│   │   ├── types/       # 类型定义 (game, delta, room, player, events)
│   │   ├── constants/   # 常量配置
│   │   └── utils/       # 工具函数 (stateCompression 状态压缩)
│   ├── client/          # 客户端代码
│   │   ├── core/        # 游戏核心逻辑
│   │   ├── renderer/    # Canvas 渲染器
│   │   ├── network/     # 网络通信 (压缩状态解压)
│   │   └── ui/          # UI 管理
│   ├── server/          # 服务端代码
│   │   ├── core/        # 玩家/房间管理
│   │   ├── game/        # 游戏逻辑
│   │   ├── network/     # Socket 处理 (压缩状态传输)
│   │   └── persistence/ # 数据存储
│   └── index.html
├── data/                # 数据库文件
├── package.json
└── vite.config.ts
```

## 配置修改

游戏配置位于 `src/shared/constants/index.ts`：

```typescript
export const DEFAULT_GAME_CONFIG = {
  gridWidth: 80,        // 地图宽度
  gridHeight: 50,       // 地图高度
  cellSize: 12,         // 格子大小
  gameSpeed: 100,       // 游戏速度 (ms)，越小越快
  maxPlayers: 8,        // 最大玩家数
  initialSnakeLength: 3,// 初始蛇长度
  respawnTime: 3000,    // 复活等待时间 (ms)
  // ...
};
```

## 网络优化说明

为了减少网络流量，游戏采用了状态压缩传输：

1. **压缩策略**: 蛇数据只发送头部位置+方向+长度，客户端重建身体
2. **完整同步**: 每10帧（约500ms）发送一次完整状态，确保同步
3. **增量传输**: 其余帧发送压缩状态，减少约50-70%流量
4. **数据格式**: 食物/道具使用紧凑数组格式而非对象

## License

MIT
