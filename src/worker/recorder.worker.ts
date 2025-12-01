import * as Comlink from 'comlink';
import { zipSync } from 'fflate';
import { CircularBuffer } from '../utils/buffer';
import type { eventWithTime } from 'rrweb';

// 初始化环形缓冲区，设置 30 秒的数据保留时长
// Worker 独立线程维护这个 Buffer，避免阻塞主线程 UI
const buffer = new CircularBuffer(30000);

let userInfo: any = null;
let tags: Record<string, string> = {};
let breadcrumbs: any[] = [];

/**
 * Worker 暴露的 API 对象
 */
const api = {
  setBufferSize(ms: number) {
      // MVP: Reset buffer on size change
      // buffer = new CircularBuffer(ms);
      // For now, keep using the same instance or implement resize logic in CircularBuffer
      // To avoid complexity, we just log warning if resizing isn't fully supported
      console.warn('Buffer resize not fully implemented in worker, using default or initial size');
  },

  setUserInfo(info: any) {
      userInfo = info;
  },

  setTag(key: string, value: string) {
      tags[key] = value;
  },

  addBreadcrumb(breadcrumb: any) {
      breadcrumbs.push(breadcrumb);
      // Keep only last 100 breadcrumbs to avoid memory issues
      if (breadcrumbs.length > 100) {
          breadcrumbs.shift();
      }
  },

  addEvent(event: eventWithTime) {
    buffer.add(event);
  },

  exportData(reason: string = 'unknown'): Uint8Array {
    const events = buffer.getAll();
    
    const exportData = {
        meta: {
            timestamp: Date.now(),
            reason,
            userInfo,
            tags,
            breadcrumbs,
            userAgent: navigator.userAgent,
            url: self.location.href
        },
        events
    };

    const jsonStr = JSON.stringify(exportData.events);
    const metaStr = JSON.stringify(exportData.meta, null, 2);

    const eventsBuf = new TextEncoder().encode(jsonStr);
    const metaBuf = new TextEncoder().encode(metaStr);
    
    const compressed = zipSync({
      'recording.json': eventsBuf,
      'meta.json': metaBuf
    });
    
    return compressed;
  },
  
  clear() {
      buffer.clear();
      breadcrumbs = [];
      tags = {};
  }
};

// 使用 Comlink 暴露 API，使主线程可以像调用本地对象一样调用 Worker 方法
Comlink.expose(api);
