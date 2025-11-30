import * as rrweb from 'rrweb';
import * as Comlink from 'comlink';
import FeedbackModal from '../ui/FeedbackModal.svelte';
import RecorderWorker from '../worker/recorder.worker.ts?worker';

export interface TraceableOptions {
  /**
   * 录制缓冲区时长（毫秒），默认 30000 (30秒)
   */
  bufferSizeMs?: number;
  /**
   * 是否自动开始录制，默认 false
   */
  autoStart?: boolean;
}

/**
 * TraceableSDK 主类
 * 负责初始化录制、管理 Worker 通信以及挂载 UI 组件。
 */
export class TraceableSDK {
  private worker: Worker;
  private remote: any; // Comlink 包装后的远程 Worker 对象
  private stopFn: (() => void) | null = null; // rrweb 停止录制的函数
  private options: TraceableOptions = {
    bufferSizeMs: 30000,
    autoStart: false
  };

  constructor(options?: TraceableOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // 实例化 Web Worker
    // 使用 Vite 的 ?worker 后缀导入，确保正确打包
    this.worker = new RecorderWorker();
    // 使用 Comlink 包装 Worker，实现 RPC 调用
    this.remote = Comlink.wrap(this.worker);

    // 如果配置了 bufferSizeMs，通知 Worker 更新配置
    // 注意：Worker 初始化是异步的，这里只是发送指令，Worker 内部会处理
    if (this.options.bufferSizeMs) {
        this.remote.setBufferSize(this.options.bufferSizeMs);
    }

    if (this.options.autoStart) {
      this.init();
    }
  }

  /**
   * 初始化 SDK
   * 1. 开启 rrweb 录制
   * 2. 挂载反馈 UI
   */
  public async init() {
    if (this.stopFn) return; // 避免重复初始化

    // 启动 rrweb 录制
    const recordFn = rrweb.record({
      emit: (event) => {
        // 将录制到的事件直接转发给 Worker 处理
        // 避免在主线程进行复杂的数据处理或存储，减少对业务页面的性能影响
        this.remote.addEvent(event);
      },
      // 每 5 秒生成一个关键帧 (Full Snapshot)
      // 这对于切片非常重要，确保我们随时截取的一段数据都能找到最近的快照进行回放
      checkoutEveryNms: 5000, 
    });
    
    this.stopFn = recordFn || null;

    this.mountUI();
    console.log('[TraceableSDK] Initialized');
  }

  /**
   * 设置用户身份信息
   * @param userId 用户唯一标识
   * @param context 其他上下文信息 (如 role, plan 等)
   */
  public identify(userId: string, context?: Record<string, any>) {
      this.remote.setUserInfo({ userId, context });
      console.log('[TraceableSDK] User identified:', userId);
  }

  /**
   * 手动触发上报
   * @param reason 上报原因 (如 "manual", "error", "feedback")
   */
  public async capture(reason: string = 'manual') {
      console.log(`[TraceableSDK] Capturing recording (reason: ${reason})...`);
      try {
          // 获取压缩后的 ZIP 数据 (Uint8Array)
          // 传递 reason 给 worker，worker 可以将其打包进 metadata
          const compressedData = await this.remote.exportData(reason);
          this.download(compressedData);
      } catch (e) {
          console.error('[TraceableSDK] Capture failed:', e);
      }
  }

  /**
   * 挂载 UI 组件
   * 使用 Shadow DOM 技术，确保 SDK 的样式不会污染宿主页面，
   * 同时宿主页面的样式也不会影响 SDK UI。
   */
  private mountUI() {
    if (document.getElementById('traceable-sdk-host')) return;

    const host = document.createElement('div');
    host.id = 'traceable-sdk-host';
    document.body.appendChild(host);

    // 创建 Shadow Root
    const shadow = host.attachShadow({ mode: 'open' });
    
    // 将 Svelte 组件挂载到 Shadow Root 中
    new FeedbackModal({
      target: shadow,
    }).$on('export', () => {
        // 监听组件内部抛出的 export 事件
        this.capture('feedback_button');
    });
  }

  /**
   * 导出数据 (兼容旧 API，建议使用 capture)
   */
  public async export() {
    return this.capture('legacy_export');
  }

  /**
   * 辅助方法：触发二进制数据的下载
   */
  private download(data: Uint8Array) {
    const blob = new Blob([data as any], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traceable-recording-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('[TraceableSDK] Download started');
  }
  
  /**
   * 停止录制并清理资源
   */
  public stop() {
      if (this.stopFn) {
          this.stopFn();
          this.stopFn = null;
      }
      // TODO: 可以进一步销毁 Worker 和 UI
  }
}

// 如果在浏览器环境中，自动挂载到 window 对象，方便直接调用
if (typeof window !== 'undefined') {
    (window as any).TraceableSDK = TraceableSDK;
}
