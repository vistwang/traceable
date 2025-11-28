import type { eventWithTime } from 'rrweb';
import { EventType } from 'rrweb';

/**
 * 环形缓冲区 (Circular Buffer)
 * 
 * 用于存储 rrweb 录制的事件数据。
 * 核心功能：
 * 1. 存储最新的录屏数据。
 * 2. 自动修剪超过指定时间窗口（maxAgeMs）的旧数据。
 * 3. **关键逻辑**：在修剪旧数据时，必须保留被修剪掉的数据中**最后一个 FullSnapshot**。
 *    这是因为 rrweb 回放必须从一个 FullSnapshot 开始。如果直接按时间切断，
 *    可能导致回放开始时缺少 DOM 快照，从而无法正确渲染后续的增量变动。
 */
export class CircularBuffer {
  private buffer: eventWithTime[] = [];
  private maxAgeMs: number;

  /**
   * @param maxAgeMs - 数据保留的最大时长（毫秒），默认为 30 秒。
   */
  constructor(maxAgeMs: number = 30000) {
    this.maxAgeMs = maxAgeMs;
  }

  /**
   * 添加一个新的事件到缓冲区，并触发修剪逻辑。
   * @param event - rrweb 生成的事件对象
   */
  add(event: eventWithTime) {
    this.buffer.push(event);
    this.prune();
  }

  /**
   * 修剪逻辑：移除超出时间窗口的旧事件，但确保回放可用性。
   */
  private prune() {
    if (this.buffer.length === 0) return;

    const now = Date.now();
    const cutoff = now - this.maxAgeMs; // 计算截止时间戳

    // 1. 找到第一个在时间窗口内的事件索引
    //    即：timestamp >= cutoff 的第一个事件
    let firstValidIndex = this.buffer.findIndex(e => e.timestamp >= cutoff);

    // 情况 A: 所有事件都在时间窗口内 (firstValidIndex === 0)
    // 无需修剪。
    if (firstValidIndex === 0) return;

    // 情况 B: 所有事件都过期了 (firstValidIndex === -1)
    if (firstValidIndex === -1) {
      // 此时缓冲区内全是旧数据。
      // 我们不能清空所有数据，因为如果用户此刻点击“上报”，我们需要最近的一个快照作为基准。
      // 策略：保留缓冲区中最后一个 FullSnapshot，并清除它之前的所有数据。
      // 如果没有快照，则清空（极端情况，通常会有）。
      this.keepLastSnapshotAndClearOthers(this.buffer.length);
      return;
    }

    // 情况 C: 部分事件过期 (firstValidIndex > 0)
    // 我们需要移除索引 [0, firstValidIndex - 1] 的数据。
    // 但是！我们必须检查被移除的数据中是否包含 FullSnapshot。
    // 如果被移除的数据中有 FullSnapshot，我们需要保留**离 firstValidIndex 最近的一个**。
    // 这样回放器才能在回放开始时重建 DOM。

    // 从 firstValidIndex - 1 开始向前查找最近的 FullSnapshot
    let snapshotIndex = -1;
    for (let i = firstValidIndex - 1; i >= 0; i--) {
      if (this.buffer[i].type === EventType.FullSnapshot) {
        snapshotIndex = i;
        break;
      }
    }

    if (snapshotIndex !== -1) {
      // 找到了快照。
      // 我们保留从该快照开始的所有数据。
      // 移除 [0, snapshotIndex - 1] 的数据。
      // 这样 buffer[0] 就是一个 FullSnapshot，后续是增量数据。
      if (snapshotIndex > 0) {
          this.buffer.splice(0, snapshotIndex);
      }
    } else {
      // 在被移除的旧数据中没有找到快照。
      // 这意味着最近的一个快照可能还在更早之前（已经被移除了？），或者
      // 缓冲区里现存的有效数据（从 firstValidIndex 开始）里包含快照。
      // 如果有效数据里没有快照，且旧数据里也没快照，那这段录屏可能无法独立回放。
      // 但基于 rrweb 的机制，通常会定期生成快照。
      // 简单的策略：直接移除旧数据。
      this.buffer.splice(0, firstValidIndex);
    }
  }
  
  /**
   * 辅助方法：保留指定范围内的最后一个快照，清除其他。
   * 用于“所有数据都过期”的情况。
   */
  private keepLastSnapshotAndClearOthers(endIndex: number) {
      // 从 endIndex - 1 向前搜索快照
      let snapshotIndex = -1;
      for (let i = endIndex - 1; i >= 0; i--) {
          if (this.buffer[i].type === EventType.FullSnapshot) {
              snapshotIndex = i;
              break;
          }
      }
      
      if (snapshotIndex !== -1) {
          // 只保留这一个快照事件
          // 注意：这里我们丢弃了快照后的所有增量数据，因为它们都过期了。
          // 当新数据进来时，会接在这个快照后面。
          this.buffer = [this.buffer[snapshotIndex]];
      } else {
          // 没有任何快照，只能清空
          this.buffer = [];
      }
  }

  /**
   * 获取当前缓冲区的所有事件。
   */
  getAll(): eventWithTime[] {
    return [...this.buffer];
  }

  /**
   * 清空缓冲区。
   */
  clear() {
    this.buffer = [];
  }
}
