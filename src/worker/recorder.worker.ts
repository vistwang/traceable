import * as Comlink from 'comlink';
import { zipSync } from 'fflate';
import { CircularBuffer } from '../utils/buffer';
import type { eventWithTime } from 'rrweb';

// 初始化环形缓冲区，设置 30 秒的数据保留时长
// Worker 独立线程维护这个 Buffer，避免阻塞主线程 UI
let buffer = new CircularBuffer(30000);

let userInfo: any = null;

/**
 * Worker 暴露的 API 对象
 * 主线程通过 Comlink 远程调用这些方法
 */
const api = {
  /**
   * 设置缓冲区大小
   */
  setBufferSize(ms: number) {
      // 如果需要调整大小，这里简单地重新创建一个 buffer
      // 注意：这会丢失当前数据。如果需要保留，需要将旧数据迁移。
      // MVP 阶段简单处理。
      buffer = new CircularBuffer(ms);
  },

  /**
   * 设置用户信息
   */
  setUserInfo(info: any) {
      userInfo = info;
  },

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
   * @param reason - 导出原因
   * @returns 压缩后的 Uint8Array 二进制数据
   */
  exportData(reason: string = 'unknown'): Uint8Array {
    const events = buffer.getAll();
    
    // 构造包含元数据的对象
    const exportData = {
        meta: {
            timestamp: Date.now(),
            reason,
            userInfo,
            userAgent: navigator.userAgent,
            url: self.location.href // Worker 里的 location 可能不是主页面的，但 rrweb 事件里有
        },
        events
    };

    const jsonStr = JSON.stringify(exportData.events); // 保持兼容性，viewer 目前只读 events 数组
    // 如果 viewer 支持 meta，我们可以导出整个 exportData
    // 为了兼容现有的 viewer (rrweb-player)，我们还是主要导出 events。
    // 但我们可以把 meta 作为一个单独的文件放在 zip 里。

    const eventsBuf = new TextEncoder().encode(jsonStr);
    const metaBuf = new TextEncoder().encode(JSON.stringify(exportData.meta, null, 2));
    
    // 使用 zipSync 同步压缩（在 Worker 中同步是安全的，不会卡顿主线程）
    // 压缩级别默认，通常能达到不错的压缩率
    const compressed = zipSync({
      'recording.json': eventsBuf,
      'meta.json': metaBuf
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
