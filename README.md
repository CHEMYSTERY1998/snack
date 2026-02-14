# 🐍 贪吃蛇联机对战

局域网多人联机贪吃蛇游戏，支持 2-8 人同时游戏。

## 功能特性

- 🎮 **多人对战**: 支持 2-8 人同时游戏
- 🏠 **房间系统**: 创建/加入房间，支持密码保护
- ⚡ **道具系统**: 加速、减速、穿墙、无敌、双倍积分、缩短对手
- 🏆 **排行榜**: 自动记录游戏成绩
- 🌐 **局域网部署**: 支持局域网内多设备访问

## 技术栈

- **前端**: HTML5 Canvas + TypeScript + Vite
- **后端**: Node.js + Socket.io
- **存储**: JSON 文件

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

| 道具 | 图标 | 效果 | 持续时间 |
|------|------|------|----------|
| 加速 | ⚡ | 移动速度 +50% | 5秒 |
| 减速 | 🐌 | 移动速度 -50% | 5秒 |
| 穿墙 | 👻 | 可穿越墙壁 | 8秒 |
| 无敌 | 🛡️ | 免疫死亡 | 5秒 |
| 双倍积分 | ✨ | 分数 x2 | 10秒 |
| 缩短对手 | ✂️ | 其他玩家长度减半 | 即时 |

## 项目结构

```
snack/
├── src/
│   ├── shared/          # 前后端共享代码
│   │   ├── types/       # 类型定义
│   │   ├── constants/   # 常量配置
│   │   └── utils/       # 工具函数
│   ├── client/          # 客户端代码
│   │   ├── core/        # 游戏核心逻辑
│   │   ├── renderer/    # Canvas 渲染器
│   │   ├── network/     # 网络通信
│   │   └── ui/          # UI 管理
│   ├── server/          # 服务端代码
│   │   ├── core/        # 玩家/房间管理
│   │   ├── game/        # 游戏逻辑
│   │   ├── network/     # Socket 处理
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
  gridWidth: 60,        // 地图宽度
  gridHeight: 40,       // 地图高度
  cellSize: 15,         // 格子大小
  gameSpeed: 200,       // 游戏速度 (ms)，越小越快
  maxPlayers: 8,        // 最大玩家数
  initialSnakeLength: 3,// 初始蛇长度
  // ...
};
```

## License

MIT
