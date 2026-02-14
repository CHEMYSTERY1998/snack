import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { LeaderboardEntry, GameResult } from '@shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StoredEntry {
  playerName: string;
  score: number;
  killCount: number;
  survivalTime: number;
  playedAt: number;
}

export class Database {
  private dataPath: string = '';
  private entries: StoredEntry[] = [];
  private maxEntries = 1000;

  async init(): Promise<void> {
    // 确保数据目录存在
    const dataDir = resolve(__dirname, '../../../data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.dataPath = resolve(dataDir, 'leaderboard.json');

    // 加载现有数据
    this.loadData();

    console.log(`📊 数据库已初始化: ${this.dataPath}`);
  }

  private loadData(): void {
    try {
      if (existsSync(this.dataPath)) {
        const data = readFileSync(this.dataPath, 'utf-8');
        this.entries = JSON.parse(data);
      }
    } catch (error) {
      console.warn('加载数据失败，使用空数据:', error);
      this.entries = [];
    }
  }

  private saveData(): void {
    try {
      writeFileSync(this.dataPath, JSON.stringify(this.entries, null, 2));
    } catch (error) {
      console.error('保存数据失败:', error);
    }
  }

  // 添加排行榜记录
  addLeaderboardEntry(result: GameResult): void {
    const entry: StoredEntry = {
      playerName: result.playerName,
      score: result.score,
      killCount: result.killCount,
      survivalTime: result.survivalTime,
      playedAt: Date.now(),
    };

    this.entries.push(entry);

    // 排序并限制数量
    this.entries.sort((a, b) => b.score - a.score);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    this.saveData();
  }

  // 获取排行榜
  getLeaderboard(limit: number = 10): LeaderboardEntry[] {
    return this.entries.slice(0, limit).map((entry, index) => ({
      rank: index + 1,
      playerName: entry.playerName,
      score: entry.score,
      killCount: entry.killCount,
      survivalTime: entry.survivalTime,
      playedAt: entry.playedAt,
    }));
  }

  // 获取玩家最佳成绩
  getPlayerBestScore(playerName: string): LeaderboardEntry | null {
    const sortedEntries = [...this.entries].sort((a, b) => b.score - a.score);
    const index = sortedEntries.findIndex(e => e.playerName === playerName);

    if (index === -1) return null;

    const entry = sortedEntries[index];
    return {
      rank: index + 1,
      playerName: entry.playerName,
      score: entry.score,
      killCount: entry.killCount,
      survivalTime: entry.survivalTime,
      playedAt: entry.playedAt,
    };
  }

  // 清理旧记录
  cleanupOldRecords(): void {
    this.entries.sort((a, b) => b.score - a.score);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }
    this.saveData();
  }

  close(): void {
    this.saveData();
  }
}
