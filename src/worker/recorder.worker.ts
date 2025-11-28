import * as Comlink from 'comlink';
import { zipSync } from 'fflate';
import { CircularBuffer } from '../utils/buffer';
import type { eventWithTime } from 'rrweb';

// 初始化环形缓冲区，设置 30 秒的数据保留时长
// Worker 独立线程维护这个 Buffer，避免阻塞主线程 UI
const buffer = new CircularBuffer(30000);

/**
 * Worker 暴露的 API 对象
 * 主线程通过 Comlink 远程调用这些方法
 */
const api = {
  /**
   * 接收主线程转发的 rrweb 事件
   * @param event - 单个 rrweb 事件
   */
  addEvent(event: eventWithTime) {
    // 将事件存入环形缓冲区，内部会自动处理过期数据的修剪
    buffer.add(event);
  },

  /**
   * 导出当前缓冲区的数据
   * 1. 获取所有事件
   * 2. 序列化为 JSON 字符串
   * 3. 使用 fflate 进行 ZIP 压缩
   * @returns 压缩后的 Uint8Array 二进制数据
   */
  exportData(): Uint8Array {
    const events = buffer.getAll();
    const jsonStr = JSON.stringify(events);
    const buf = new TextEncoder().encode(jsonStr);
    
    // 使用 zipSync 同步压缩（在 Worker 中同步是安全的，不会卡顿主线程）
    // 压缩级别默认，通常能达到不错的压缩率
    const compressed = zipSync({
      'recording.json': buf
    });
    
    return compressed;
  },
  
  /**
   * 清空缓冲区
   */
  clear() {
      buffer.clear();
  }
};

// 使用 Comlink 暴露 API，使主线程可以像调用本地对象一样调用 Worker 方法
Comlink.expose(api);
